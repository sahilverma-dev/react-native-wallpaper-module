package expo.modules.wallpaper

import android.content.Context
import android.graphics.BitmapFactory
import android.media.MediaExtractor
import android.media.MediaFormat
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.CopyOnWriteArraySet

internal enum class LiveWallpaperKind(val value: String) {
  IMAGE("image"),
  VIDEO("video");

  companion object {
    fun fromValue(value: String?): LiveWallpaperKind? = entries.firstOrNull { it.value == value }
  }
}

/**
 * Persisted configuration for the bundled live wallpaper.
 *
 * Only one media item is active at a time: configuring an image removes the
 * video and vice versa. This keeps storage bounded and makes "what is the live
 * wallpaper showing?" unambiguous.
 */
internal object LiveWallpaperConfigStore {
  private const val PREFS_NAME = "expo_wallpaper_live"
  private const val KEY_KIND = "kind"
  private const val KEY_MOTION = "motion"
  private const val KEY_LOOP = "loop"
  private const val KEY_MUTED = "muted"
  private const val KEY_SPEED = "speed"
  private const val KEY_SCALING = "scaling"
  private const val KEY_UPDATED_AT = "updatedAt"

  private const val IMAGE_DIRECTORY = "live_wallpaper/images"
  private const val VIDEO_DIRECTORY = "live_wallpaper/videos"
  private const val IMAGE_FILE_NAME = "current.img"
  private const val VIDEO_FILE_NAME = "current.video"

  const val MOTION_PAN = "pan"
  const val MOTION_NONE = "none"
  const val SCALING_FILL = "fill"
  const val SCALING_FIT = "fit"
  const val SCALING_CROP = "crop"

  const val MIN_VIDEO_SPEED = 0.25f
  const val MAX_VIDEO_SPEED = 3.0f

  /** Hard cap for the copied image file (compressed bytes). */
  const val MAX_IMAGE_BYTES = 50L * 1024L * 1024L

  /** Hard cap for the decoded image dimensions (~32 MP). */
  const val MAX_IMAGE_PIXELS = 32_000_000L

  /** Hard cap for the copied video file. */
  const val MAX_VIDEO_BYTES = 200L * 1024L * 1024L

  private val listeners = CopyOnWriteArraySet<() -> Unit>()

  fun addListener(listener: () -> Unit) {
    listeners.add(listener)
  }

  fun removeListener(listener: () -> Unit) {
    listeners.remove(listener)
  }

  fun notifyChanged() {
    listeners.forEach { listener -> runCatching { listener() } }
  }

  private fun imageDirectory(context: Context) = File(context.filesDir, IMAGE_DIRECTORY)

  private fun videoDirectory(context: Context) = File(context.filesDir, VIDEO_DIRECTORY)

  fun imageFile(context: Context) = File(imageDirectory(context), IMAGE_FILE_NAME)

  fun videoFile(context: Context) = File(videoDirectory(context), VIDEO_FILE_NAME)

  /**
   * Reads the current configuration. A missing or empty media file is treated
   * as "no media" so the wallpaper falls back to the gradient instead of
   * showing a broken surface (for example after the user clears app data).
   */
  fun read(context: Context): LiveWallpaperConfig {
    val preferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val kind = LiveWallpaperKind.fromValue(preferences.getString(KEY_KIND, null))
    val motion = when (preferences.getString(KEY_MOTION, MOTION_PAN)) {
      MOTION_NONE -> MOTION_NONE
      else -> MOTION_PAN
    }
    val scaling = when (preferences.getString(KEY_SCALING, SCALING_CROP)) {
      SCALING_FILL -> SCALING_FILL
      SCALING_FIT -> SCALING_FIT
      else -> SCALING_CROP
    }

    val file = when (kind) {
      LiveWallpaperKind.IMAGE -> imageFile(context).takeIf { it.isFile && it.length() > 0L }
      LiveWallpaperKind.VIDEO -> videoFile(context).takeIf { it.isFile && it.length() > 0L }
      null -> null
    }

    val activeKind = if (file == null) null else kind

    return LiveWallpaperConfig(
      kind = activeKind,
      file = file,
      motion = motion,
      loop = preferences.getBoolean(KEY_LOOP, true),
      muted = preferences.getBoolean(KEY_MUTED, true),
      speed = preferences.getFloat(KEY_SPEED, 1f)
        .coerceIn(MIN_VIDEO_SPEED, MAX_VIDEO_SPEED),
      scaling = scaling
    )
  }

  /**
   * Streams a supported image into app storage, validates its dimensions and
   * atomically replaces any previous media. Nothing is committed unless every
   * step succeeds.
   */
  @Synchronized
  fun saveImage(context: Context, uri: String, motion: String) {
    val directory = imageDirectory(context)
    val temporary = File(directory, "$IMAGE_FILE_NAME.tmp")
    val source = WallpaperMediaSourceResolver.openImage(context, uri)

    try {
      prepareDirectory(directory)
      source.use { mediaSource ->
        FileOutputStream(temporary).use { output ->
          copyWithLimit(mediaSource.stream, output, MAX_IMAGE_BYTES, "image", 50)
          output.fd.sync()
        }
      }

      validateImageDimensions(temporary)
      replaceFile(temporary, imageFile(context))
      deleteQuietly(videoFile(context))

      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_KIND, LiveWallpaperKind.IMAGE.value)
        .putString(KEY_MOTION, motion)
        .putLong(KEY_UPDATED_AT, System.currentTimeMillis())
        .commit()
    } catch (error: WallpaperException) {
      temporary.delete()
      throw error
    } catch (error: IOException) {
      temporary.delete()
      throw WallpaperException(
        WallpaperErrorCode.WALLPAPER_FAILED,
        "Could not save the live wallpaper image. Storage may be full.",
        error
      )
    } catch (error: SecurityException) {
      temporary.delete()
      throw WallpaperException(
        WallpaperErrorCode.WALLPAPER_FAILED,
        "Could not save the live wallpaper image: permission denied.",
        error
      )
    }

    notifyChanged()
  }

  /**
   * Streams a video into app storage, verifies that it contains a video track
   * and atomically replaces any previous media.
   */
  @Synchronized
  fun saveVideo(
    context: Context,
    uri: String,
    loop: Boolean,
    muted: Boolean,
    speed: Float,
    scaling: String
  ) {
    val directory = videoDirectory(context)
    val temporary = File(directory, "$VIDEO_FILE_NAME.tmp")
    val source = WallpaperMediaSourceResolver.open(context, uri)

    try {
      prepareDirectory(directory)
      source.use { mediaSource ->
        FileOutputStream(temporary).use { output ->
          copyWithLimit(mediaSource.stream, output, MAX_VIDEO_BYTES, "video", 200)
          output.fd.sync()
        }
      }

      validateVideo(temporary)
      replaceFile(temporary, videoFile(context))
      deleteQuietly(imageFile(context))

      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_KIND, LiveWallpaperKind.VIDEO.value)
        .putBoolean(KEY_LOOP, loop)
        .putBoolean(KEY_MUTED, muted)
        .putFloat(KEY_SPEED, speed.coerceIn(MIN_VIDEO_SPEED, MAX_VIDEO_SPEED))
        .putString(KEY_SCALING, scaling)
        .putLong(KEY_UPDATED_AT, System.currentTimeMillis())
        .commit()
    } catch (error: WallpaperException) {
      temporary.delete()
      throw error
    } catch (error: IOException) {
      temporary.delete()
      throw WallpaperException(
        WallpaperErrorCode.WALLPAPER_FAILED,
        "Could not save the live wallpaper video. Storage may be full.",
        error
      )
    } catch (error: SecurityException) {
      temporary.delete()
      throw WallpaperException(
        WallpaperErrorCode.WALLPAPER_FAILED,
        "Could not save the live wallpaper video: permission denied.",
        error
      )
    }

    notifyChanged()
  }

  /** Removes all configured media; the service falls back to the gradient. */
  @Synchronized
  fun clear(context: Context) {
    val image = imageFile(context)
    val video = videoFile(context)

    if (image.exists() && !image.delete()) {
      throw WallpaperException(
        WallpaperErrorCode.WALLPAPER_FAILED,
        "Could not delete the live wallpaper image."
      )
    }
    if (video.exists() && !video.delete()) {
      throw WallpaperException(
        WallpaperErrorCode.WALLPAPER_FAILED,
        "Could not delete the live wallpaper video."
      )
    }

    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .clear()
      .commit()

    notifyChanged()
  }

  private fun prepareDirectory(directory: File) {
    if (!directory.exists() && !directory.mkdirs()) {
      throw WallpaperException(
        WallpaperErrorCode.WALLPAPER_FAILED,
        "Could not create the live wallpaper storage directory."
      )
    }
  }

  private fun replaceFile(temporary: File, target: File) {
    if (!temporary.renameTo(target)) {
      // Fall back to a copy for file systems where rename cannot replace.
      temporary.copyTo(target, overwrite = true)
      temporary.delete()
    }
  }

  private fun deleteQuietly(file: File) {
    if (file.exists()) {
      file.delete()
    }
  }

  private fun copyWithLimit(
    source: java.io.InputStream,
    output: FileOutputStream,
    limitBytes: Long,
    label: String,
    limitMb: Int
  ) {
    val buffer = ByteArray(64 * 1024)
    var total = 0L

    while (true) {
      val read = source.read(buffer)
      if (read < 0) {
        break
      }
      total += read
      if (total > limitBytes) {
        throw WallpaperException(
          WallpaperErrorCode.IMAGE_TOO_LARGE,
          "The live wallpaper $label is larger than $limitMb MB. Use a smaller file."
        )
      }
      output.write(buffer, 0, read)
    }

    if (total == 0L) {
      throw WallpaperException(
        WallpaperErrorCode.UNSUPPORTED_FORMAT,
        "The live wallpaper $label is empty."
      )
    }
  }

  private fun validateImageDimensions(file: File) {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.absolutePath, bounds)

    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
      throw WallpaperException(
        WallpaperErrorCode.UNSUPPORTED_FORMAT,
        "The live wallpaper image could not be decoded."
      )
    }

    val pixels = bounds.outWidth.toLong() * bounds.outHeight.toLong()
    if (pixels > MAX_IMAGE_PIXELS) {
      throw WallpaperException(
        WallpaperErrorCode.IMAGE_TOO_LARGE,
        "The live wallpaper image is too large (${bounds.outWidth}x${bounds.outHeight}). " +
          "Use an image under 32 megapixels."
      )
    }
  }

  private fun validateVideo(file: File) {
    val extractor = MediaExtractor()

    try {
      extractor.setDataSource(file.absolutePath)
      var hasVideoTrack = false
      var durationUs = 0L

      for (index in 0 until extractor.trackCount) {
        val format = extractor.getTrackFormat(index)
        val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
        if (mime.startsWith("video/")) {
          hasVideoTrack = true
          if (format.containsKey(MediaFormat.KEY_DURATION)) {
            durationUs = maxOf(durationUs, format.getLong(MediaFormat.KEY_DURATION))
          }
        }
      }

      if (!hasVideoTrack) {
        throw WallpaperException(
          WallpaperErrorCode.UNSUPPORTED_FORMAT,
          "The file does not contain a video track. Use an MP4, WebM or MKV video."
        )
      }

      if (durationUs in 1 until MIN_VIDEO_DURATION_US) {
        throw WallpaperException(
          WallpaperErrorCode.UNSUPPORTED_FORMAT,
          "The video is too short to loop. Use a video longer than 0.25 seconds."
        )
      }
    } catch (error: WallpaperException) {
      throw error
    } catch (error: IOException) {
      throw WallpaperException(
        WallpaperErrorCode.UNSUPPORTED_FORMAT,
        "The video could not be read. Use an MP4, WebM or MKV video.",
        error
      )
    } catch (error: RuntimeException) {
      throw WallpaperException(
        WallpaperErrorCode.UNSUPPORTED_FORMAT,
        "The video could not be read. Use an MP4, WebM or MKV video.",
        error
      )
    } finally {
      extractor.release()
    }
  }

  private const val MIN_VIDEO_DURATION_US = 250_000L
}

internal data class LiveWallpaperConfig(
  val kind: LiveWallpaperKind?,
  val file: File?,
  val motion: String,
  val loop: Boolean,
  val muted: Boolean,
  val speed: Float,
  val scaling: String
) {
  val animated: Boolean
    get() = kind == LiveWallpaperKind.IMAGE && motion != LiveWallpaperConfigStore.MOTION_NONE

  val isVideo: Boolean
    get() = kind == LiveWallpaperKind.VIDEO && file != null
}
