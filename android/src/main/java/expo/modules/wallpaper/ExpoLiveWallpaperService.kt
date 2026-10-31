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
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.service.wallpaper.WallpaperService
import android.view.SurfaceHolder
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
 * system preview/picker. It either renders a configured image with a slow
 * pan/zoom or, when no image is configured (or the file disappeared), an
 * animated gradient.
 */
class ExpoLiveWallpaperService : WallpaperService() {
  override fun onCreateEngine(): Engine = LiveWallpaperEngine()

  private inner class LiveWallpaperEngine : Engine() {
    private val handler = Handler(Looper.getMainLooper())
    private val loader = Executors.newSingleThreadExecutor()
    private val photoPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG or Paint.DITHER_FLAG)
    private val gradientPaint = Paint(Paint.ANTI_ALIAS_FLAG)

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

    private val frameRunnable = object : Runnable {
      override fun run() {
        frameScheduled = false
        if (destroyed || !visible) {
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
      startedAt = SystemClock.elapsedRealtime()
      reloadConfig(force = true)
    }

    override fun onDestroy() {
      destroyed = true
      handler.removeCallbacksAndMessages(null)
      LiveWallpaperConfigStore.removeListener(configListener)
      loader.shutdownNow()
      recycleBitmap()
      super.onDestroy()
    }

    override fun onVisibilityChanged(visible: Boolean) {
      super.onVisibilityChanged(visible)
      this.visible = visible

      if (visible) {
        startedAt = SystemClock.elapsedRealtime()
        drawFrame()
        scheduleNextFrame()
      } else {
        handler.removeCallbacks(frameRunnable)
        frameScheduled = false
      }
    }

    override fun onSurfaceCreated(holder: SurfaceHolder) {
      super.onSurfaceCreated(holder)
      drawFrame()
      scheduleNextFrame()
    }

    override fun onSurfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
      super.onSurfaceChanged(holder, format, width, height)

      if (width != surfaceWidth || height != surfaceHeight) {
        surfaceWidth = width
        surfaceHeight = height
        gradient = null
        gradientWidth = 0
        gradientHeight = 0
      }

      drawFrame()
      scheduleNextFrame()
    }

    override fun onSurfaceDestroyed(holder: SurfaceHolder) {
      super.onSurfaceDestroyed(holder)
      handler.removeCallbacks(frameRunnable)
      frameScheduled = false
    }

    override fun onSurfaceRedrawNeeded(holder: SurfaceHolder) {
      super.onSurfaceRedrawNeeded(holder)
      drawFrame()
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
      if (destroyed || !visible || !animate || frameScheduled) {
        return
      }
      frameScheduled = true
      handler.postDelayed(frameRunnable, FRAME_DELAY_MS)
    }

    private fun drawFrame() {
      if (destroyed) {
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
        // Ping-pong between 0 and 1 so the zoom loops without a jump.
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

    private fun reloadConfig(force: Boolean) {
      if (destroyed) {
        return
      }

      val config = LiveWallpaperConfigStore.read(this@ExpoLiveWallpaperService)
      animate = config.animated
      val file = config.imageFile
      val key = file?.let { "${it.absolutePath}:${it.length()}:${it.lastModified()}" }

      if (!force && key == bitmapKey) {
        drawFrame()
        scheduleNextFrame()
        return
      }

      bitmapKey = key
      recycleBitmap()

      if (file == null) {
        drawFrame()
        scheduleNextFrame()
        return
      }

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
        // Fall back to the gradient rather than letting the service crash.
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
