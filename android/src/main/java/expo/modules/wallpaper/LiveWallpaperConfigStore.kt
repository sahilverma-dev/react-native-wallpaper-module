package expo.modules.wallpaper

import android.content.Context
import android.graphics.BitmapFactory
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Persisted configuration for the bundled live wallpaper.
 *
 * The wallpaper service and the React Native app run in the same process, so
 * configuration changes can be pushed to running engines through in-process
 * listeners. The files and preferences are also the source of truth when the
 * service is restarted after the process was killed.
 */
internal object LiveWallpaperConfigStore {
  private const val PREFS_NAME = "expo_wallpaper_live"
  private const val KEY_HAS_IMAGE = "hasImage"
  private const val KEY_MOTION = "motion"
  private const val KEY_UPDATED_AT = "updatedAt"
  private const val DIRECTORY_NAME = "live_wallpaper"
  private const val IMAGE_FILE_NAME = "current.img"

  const val MOTION_PAN = "pan"
  const val MOTION_NONE = "none"

  /** Hard cap for the copied source file (compressed bytes). */
  const val MAX_FILE_BYTES = 50L * 1024L * 1024L

  /** Hard cap for the decoded image dimensions (~32 MP). */
  const val MAX_PIXELS = 32_000_000L

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

  fun directory(context: Context): File = File(context.filesDir, DIRECTORY_NAME)

  fun imageFile(context: Context): File = File(directory(context), IMAGE_FILE_NAME)

  /**
   * Reads the current configuration. A missing or empty image file is treated
   * as "no image" so the wallpaper falls back to the animated gradient instead
   * of showing a broken surface (for example after the user clears app data).
   */
  fun read(context: Context): LiveWallpaperConfig {
    val preferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val motion = when (preferences.getString(KEY_MOTION, MOTION_PAN)) {
      MOTION_NONE -> MOTION_NONE
      else -> MOTION_PAN
    }
    val hasImage = preferences.getBoolean(KEY_HAS_IMAGE, false)
    val file = imageFile(context)
    val image = if (hasImage && file.isFile && file.length() > 0L) file else null

    return LiveWallpaperConfig(image, motion)
  }

  /**
   * Streams a supported image into app storage, validates its dimensions and
   * atomically replaces the previous image. Nothing is committed unless every
   * step succeeds.
   */
  @Synchronized
  fun saveImage(context: Context, uri: String, motion: String) {
    val directory = directory(context)
    if (!directory.exists() && !directory.mkdirs()) {
      throw WallpaperException(
        WallpaperErrorCode.WALLPAPER_FAILED,
        "Could not create the live wallpaper storage directory."
      )
    }

    val temporary = File(directory, "$IMAGE_FILE_NAME.tmp")
    val source = WallpaperImageSourceResolver.open(context, uri)

    try {
      source.use { imageSource ->
        FileOutputStream(temporary).use { output ->
          copyWithLimit(imageSource.stream, output)
          output.fd.sync()
        }
      }

      validateDimensions(temporary)

      val target = imageFile(context)
      if (!temporary.renameTo(target)) {
        // Fall back to a copy for file systems where rename cannot replace.
        temporary.copyTo(target, overwrite = true)
        temporary.delete()
      }

      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putBoolean(KEY_HAS_IMAGE, true)
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

  /** Removes the configured image; the service falls back to the gradient. */
  @Synchronized
  fun clearImage(context: Context) {
    val file = imageFile(context)
    if (file.exists() && !file.delete()) {
      throw WallpaperException(
        WallpaperErrorCode.WALLPAPER_FAILED,
        "Could not delete the live wallpaper image."
      )
    }

    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .remove(KEY_HAS_IMAGE)
      .remove(KEY_MOTION)
      .remove(KEY_UPDATED_AT)
      .commit()

    notifyChanged()
  }

  private fun copyWithLimit(source: java.io.InputStream, output: FileOutputStream) {
    val buffer = ByteArray(64 * 1024)
    var total = 0L

    while (true) {
      val read = source.read(buffer)
      if (read < 0) {
        break
      }
      total += read
      if (total > MAX_FILE_BYTES) {
        throw WallpaperException(
          WallpaperErrorCode.IMAGE_TOO_LARGE,
          "The live wallpaper image is larger than 50 MB. Use a smaller image."
        )
      }
      output.write(buffer, 0, read)
    }

    if (total == 0L) {
      throw WallpaperException(
        WallpaperErrorCode.UNSUPPORTED_FORMAT,
        "The live wallpaper image is empty."
      )
    }
  }

  private fun validateDimensions(file: File) {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.absolutePath, bounds)

    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
      throw WallpaperException(
        WallpaperErrorCode.UNSUPPORTED_FORMAT,
        "The live wallpaper image could not be decoded."
      )
    }

    val pixels = bounds.outWidth.toLong() * bounds.outHeight.toLong()
    if (pixels > MAX_PIXELS) {
      throw WallpaperException(
        WallpaperErrorCode.IMAGE_TOO_LARGE,
        "The live wallpaper image is too large (${bounds.outWidth}x${bounds.outHeight}). " +
          "Use an image under 32 megapixels."
      )
    }
  }
}

internal data class LiveWallpaperConfig(
  val imageFile: File?,
  val motion: String
) {
  val animated: Boolean
    get() = motion != LiveWallpaperConfigStore.MOTION_NONE
}
