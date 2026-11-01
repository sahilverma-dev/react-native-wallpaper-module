package expo.modules.wallpaper

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Shader
import android.media.ExifInterface
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.service.wallpaper.WallpaperService
import android.view.SurfaceHolder
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.Presentation
import androidx.media3.exoplayer.ExoPlayer
import java.io.File
import java.util.concurrent.Executors
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sin

private const val FRAME_DELAY_MS = 33L
private const val MAX_DECODE_EDGE_PX = 2560
private const val ZOOM_DURATION_SECONDS = 36f
private const val GRADIENT_DURATION_MS = 12_000L

/**
 * Bundled live wallpaper.
 *
 * Android does not let apps switch live wallpapers programmatically, so the
 * module exposes `openLiveWallpaperPicker()` and this service appears in the
 * system preview/picker. It renders either:
 * - a configured image with slow pan/zoom,
 * - a configured video through Media3 ExoPlayer (loop/mute/speed/fill modes),
 * - or an animated gradient when no media is configured or playback fails.
 */
@OptIn(UnstableApi::class)
class ExpoLiveWallpaperService : WallpaperService() {
  override fun onCreateEngine(): Engine = LiveWallpaperEngine()

  private inner class LiveWallpaperEngine : Engine() {
    private val handler = Handler(Looper.getMainLooper())
    private val loader = Executors.newSingleThreadExecutor()
    private val photoPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG or Paint.DITHER_FLAG)
    private val gradientPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    private var config = LiveWallpaperConfig(
      kind = null,
      file = null,
      motion = LiveWallpaperConfigStore.MOTION_PAN,
      loop = true,
      muted = true,
      speed = 1f,
      scaling = LiveWallpaperConfigStore.SCALING_CROP
    )

    private var bitmap: Bitmap? = null
    private var bitmapKey: String? = null
    private var gradient: LinearGradient? = null
    private var gradientWidth = 0
    private var gradientHeight = 0
    private var surfaceWidth = 0
    private var surfaceHeight = 0
    private var visible = false
    private var destroyed = false
    private var frameScheduled = false
    private var startedAt = SystemClock.elapsedRealtime()
    private var animate = true
    private var offsetX = 0f

    private var player: ExoPlayer? = null
    private var videoHolder: SurfaceHolder? = null
    private var previewEngine = false
    private var runtimeRegistered = false
    private var videoMediaKey: String? = null
    private var videoEffectsKey: String? = null
    private var videoActive = false
    private var videoFailed = false

    private val frameRunnable = object : Runnable {
      override fun run() {
        frameScheduled = false
        if (destroyed || !visible || videoActive) {
          return
        }
        drawFrame()
        scheduleNextFrame()
      }
    }

    private val configListener: () -> Unit = {
      handler.post { reloadConfig(force = true) }
    }

    override fun onCreate(holder: SurfaceHolder) {
      super.onCreate(holder)
      setOffsetNotificationsEnabled(true)
      LiveWallpaperConfigStore.addListener(configListener)
      previewEngine = isPreview
      LiveWallpaperRuntime.onEngineCreated(previewEngine)
      runtimeRegistered = true
      startedAt = SystemClock.elapsedRealtime()
      reloadConfig(force = true)
    }

    override fun onDestroy() {
      destroyed = true
      handler.removeCallbacksAndMessages(null)
      LiveWallpaperConfigStore.removeListener(configListener)
      if (runtimeRegistered) {
        LiveWallpaperRuntime.onEngineDestroyed(previewEngine)
        runtimeRegistered = false
      }
      releasePlayer()
      recycleBitmap()
      loader.shutdownNow()
      super.onDestroy()
    }

    override fun onVisibilityChanged(visible: Boolean) {
      super.onVisibilityChanged(visible)
      this.visible = visible

      if (visible) {
        startedAt = SystemClock.elapsedRealtime()
        if (videoActive) {
          player?.play()
        } else {
          drawFrame()
          scheduleNextFrame()
        }
      } else {
        if (videoActive) {
          player?.pause()
        }
        handler.removeCallbacks(frameRunnable)
        frameScheduled = false
      }
    }

    override fun onSurfaceCreated(holder: SurfaceHolder) {
      super.onSurfaceCreated(holder)
      videoHolder = holder

      if (!videoActive) {
        drawFrame()
        scheduleNextFrame()
      }
      // The holder is attached in onSurfaceChanged, once its size (needed by
      // the effects pipeline) is known.
    }

    override fun onSurfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
      super.onSurfaceChanged(holder, format, width, height)
      videoHolder = holder

      if (width != surfaceWidth || height != surfaceHeight) {
        surfaceWidth = width
        surfaceHeight = height
        gradient = null
        gradientWidth = 0
        gradientHeight = 0
        videoEffectsKey = null
      }

      if (videoActive) {
        attachVideoSurface()
      } else {
        drawFrame()
        scheduleNextFrame()
      }
    }

    override fun onSurfaceDestroyed(holder: SurfaceHolder) {
      super.onSurfaceDestroyed(holder)
      player?.clearVideoSurfaceHolder(holder)
      videoHolder = null
      handler.removeCallbacks(frameRunnable)
      frameScheduled = false
    }

    override fun onSurfaceRedrawNeeded(holder: SurfaceHolder) {
      super.onSurfaceRedrawNeeded(holder)
      if (!videoActive) {
        drawFrame()
      }
    }

    override fun onOffsetsChanged(
      xOffset: Float,
      yOffset: Float,
      xOffsetStep: Float,
      yOffsetStep: Float,
      xPixelOffset: Int,
      yPixelOffset: Int
    ) {
      super.onOffsetsChanged(xOffset, yOffset, xOffsetStep, yOffsetStep, xPixelOffset, yPixelOffset)
      offsetX = xOffset
    }

    private fun scheduleNextFrame() {
      if (destroyed || !visible || videoActive || !animate || frameScheduled) {
        return
      }
      frameScheduled = true
      handler.postDelayed(frameRunnable, FRAME_DELAY_MS)
    }

    private fun reloadConfig(force: Boolean) {
      if (destroyed) {
        return
      }

      val next = LiveWallpaperConfigStore.read(this@ExpoLiveWallpaperService)
      config = next
      animate = next.animated
      videoFailed = false
      videoEffectsKey = null

      when {
        next.isVideo -> {
          handler.removeCallbacks(frameRunnable)
          frameScheduled = false
          recycleBitmap()
          videoActive = true
          applyVideo(next.file!!, force)
        }

        next.kind == LiveWallpaperKind.IMAGE && next.file != null -> {
          stopVideo()
          loadImage(next.file, force)
          drawFrame()
          scheduleNextFrame()
        }

        else -> {
          stopVideo()
          recycleBitmap()
          drawFrame()
          scheduleNextFrame()
        }
      }
    }

    // region Video

    private fun applyVideo(file: File, force: Boolean) {
      val exoPlayer = ensurePlayer()
      val key = "${file.absolutePath}:${file.length()}:${file.lastModified()}"

      if (force || key != videoMediaKey) {
        videoMediaKey = key
        exoPlayer.setMediaItem(MediaItem.fromUri(Uri.fromFile(file)))
        exoPlayer.prepare()
      }

      exoPlayer.repeatMode = if (config.loop) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
      exoPlayer.volume = if (config.muted) 0f else 1f
      exoPlayer.setPlaybackSpeed(config.speed)
      updateVideoEffects()
      attachVideoSurface()

      if (visible) {
        exoPlayer.play()
      } else {
        exoPlayer.pause()
      }
    }

    private fun ensurePlayer(): ExoPlayer {
      player?.let { return it }

      val exoPlayer = ExoPlayer.Builder(this@ExpoLiveWallpaperService).build()
      exoPlayer.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(C.USAGE_MEDIA)
          .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
          .build(),
        false
      )
      exoPlayer.addListener(
        object : Player.Listener {
          override fun onPlayerError(error: PlaybackException) {
            onVideoPlaybackError()
          }
        }
      )

      player = exoPlayer
      return exoPlayer
    }

    /**
     * Effects must be configured before the output surface is attached; the
     * Media3 effects pipeline otherwise drops every frame with
     * "Output surface and size not set".
     */
    private fun attachVideoSurface() {
      val exoPlayer = player ?: return
      val holder = videoHolder ?: return
      if (surfaceWidth <= 0 || surfaceHeight <= 0) {
        return
      }
      updateVideoEffects()
      // The holder API reports its surface size to the player; a raw Surface
      // leaves the effects pipeline without an output resolution.
      exoPlayer.setVideoSurfaceHolder(holder)
    }

    private fun updateVideoEffects() {
      val exoPlayer = player ?: return
      val width = surfaceWidth
      val height = surfaceHeight
      if (width <= 0 || height <= 0) {
        return
      }

      val key = "$width:$height:${config.scaling}"
      if (key == videoEffectsKey) {
        return
      }

      val layout = when (config.scaling) {
        LiveWallpaperConfigStore.SCALING_FILL -> Presentation.LAYOUT_STRETCH_TO_FIT
        LiveWallpaperConfigStore.SCALING_FIT -> Presentation.LAYOUT_SCALE_TO_FIT
        else -> Presentation.LAYOUT_SCALE_TO_FIT_WITH_CROP
      }

      exoPlayer.setVideoEffects(
        listOf(Presentation.createForWidthAndHeight(width, height, layout))
      )
      videoEffectsKey = key
    }

    private fun onVideoPlaybackError() {
      videoFailed = true
      videoActive = false
      releasePlayer()
      drawFrame()
      scheduleNextFrame()
    }

    private fun stopVideo() {
      releasePlayer()
      videoActive = false
      videoFailed = false
    }

    private fun releasePlayer() {
      val current = player
      player = null
      videoMediaKey = null
      videoEffectsKey = null

      if (current != null) {
        runCatching {
          current.clearVideoSurfaceHolder(videoHolder)
          current.stop()
          current.release()
        }
      }
    }

    // endregion

    private fun loadImage(file: File, force: Boolean) {
      val key = "${file.absolutePath}:${file.length()}:${file.lastModified()}"
      if (!force && key == bitmapKey) {
        return
      }

      bitmapKey = key
      recycleBitmap()

      loader.execute {
        val decoded = decodePhoto(file)
        handler.post {
          if (destroyed || bitmapKey != key) {
            decoded?.recycle()
            return@post
          }
          bitmap = decoded
          drawFrame()
          scheduleNextFrame()
        }
      }
    }

    private fun recycleBitmap() {
      val previous = bitmap
      bitmap = null
      if (previous != null && !previous.isRecycled) {
        previous.recycle()
      }
    }

    private fun drawFrame() {
      if (destroyed || videoActive) {
        return
      }

      val canvas = try {
        surfaceHolder.lockCanvas()
      } catch (_: Exception) {
        null
      } ?: return

      try {
        val width = canvas.width
        val height = canvas.height
        if (width <= 0 || height <= 0) {
          return
        }

        val current = bitmap
        if (current != null && !current.isRecycled) {
          drawPhoto(canvas, current, width, height)
        } else {
          drawGradient(canvas, width, height)
        }
      } catch (_: Exception) {
        // A drawing failure must never crash the wallpaper service; Android
        // would replace it with the default wallpaper.
      } finally {
        try {
          surfaceHolder.unlockCanvasAndPost(canvas)
        } catch (_: Exception) {
          // The surface can disappear between lockCanvas and unlock.
        }
      }
    }

    private fun drawPhoto(canvas: Canvas, image: Bitmap, width: Int, height: Int) {
      val phase = if (animate) {
        val elapsedSeconds = (SystemClock.elapsedRealtime() - startedAt) / 1000f
        val cycle = (elapsedSeconds % ZOOM_DURATION_SECONDS) / ZOOM_DURATION_SECONDS
        1f - abs(cycle * 2f - 1f)
      } else {
        0f
      }

      val zoom = 1f + 0.06f * phase
      val cover = max(width.toFloat() / image.width, height.toFloat() / image.height) * zoom
      val parallax = if (animate) (offsetX - 0.5f) * width * 0.08f else 0f

      canvas.drawColor(Color.BLACK)
      canvas.save()
      canvas.translate(width / 2f + parallax, height / 2f)
      canvas.scale(cover, cover)
      canvas.translate(-image.width / 2f, -image.height / 2f)
      canvas.drawBitmap(image, 0f, 0f, photoPaint)
      canvas.restore()
    }

    private fun drawGradient(canvas: Canvas, width: Int, height: Int) {
      if (gradient == null || gradientWidth != width || gradientHeight != height) {
        gradient = LinearGradient(
          0f,
          0f,
          width.toFloat(),
          height.toFloat(),
          intArrayOf(0xFF12103A.toInt(), 0xFF6F5BFF.toInt(), 0xFFFF7A59.toInt()),
          floatArrayOf(0f, 0.55f, 1f),
          Shader.TileMode.CLAMP
        )
        gradientWidth = width
        gradientHeight = height
      }

      gradientPaint.shader = gradient

      val shift = if (animate) {
        val cycle = (SystemClock.elapsedRealtime() - startedAt).toFloat() % GRADIENT_DURATION_MS
        sin((cycle / GRADIENT_DURATION_MS) * 2f * Math.PI).toFloat() * width * 0.15f
      } else {
        0f
      }

      canvas.save()
      canvas.translate(shift, 0f)
      canvas.drawRect(-width.toFloat(), 0f, width.toFloat() * 2f, height.toFloat(), gradientPaint)
      canvas.restore()
    }

    private fun decodePhoto(file: File): Bitmap? {
      return try {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
          return null
        }

        var sampleSize = 1
        val longestEdge = max(bounds.outWidth, bounds.outHeight)
        while (longestEdge / sampleSize > MAX_DECODE_EDGE_PX) {
          sampleSize *= 2
        }

        val options = BitmapFactory.Options().apply {
          inSampleSize = sampleSize
          inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        val decoded = BitmapFactory.decodeFile(file.absolutePath, options) ?: return null
        applyExifRotation(file, decoded)
      } catch (_: OutOfMemoryError) {
        null
      } catch (_: Exception) {
        null
      }
    }

    private fun applyExifRotation(file: File, source: Bitmap): Bitmap {
      val orientation = try {
        ExifInterface(file.absolutePath)
          .getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
      } catch (_: Exception) {
        ExifInterface.ORIENTATION_NORMAL
      }

      val matrix = Matrix()
      when (orientation) {
        ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
        ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
        ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
        ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
        ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1f, -1f)
        ExifInterface.ORIENTATION_TRANSPOSE -> {
          matrix.postRotate(90f)
          matrix.postScale(-1f, 1f)
        }

        ExifInterface.ORIENTATION_TRANSVERSE -> {
          matrix.postRotate(270f)
          matrix.postScale(-1f, 1f)
        }

        else -> return source
      }

      return try {
        val rotated = Bitmap.createBitmap(source, 0, 0, source.width, source.height, matrix, true)
        if (rotated != source) {
          source.recycle()
        }
        rotated
      } catch (_: OutOfMemoryError) {
        source
      } catch (_: Exception) {
        source
      }
    }
  }
}
