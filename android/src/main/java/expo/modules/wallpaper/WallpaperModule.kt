package expo.modules.wallpaper

import android.app.WallpaperManager
import android.content.Context
import android.graphics.Rect
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.IOException

/**
 * Native bridge for `WallpaperManager`.
 *
 * Every async function runs on the Expo modules queue (a background thread),
 * so file, content provider and network I/O never block the UI thread.
 */
class WallpaperModule : Module() {
  private val context: Context
    get() = appContext.reactContext
      ?: throw WallpaperException(
        WallpaperErrorCode.WALLPAPER_FAILED,
        "React context is not available."
      )

  private val wallpaperManager: WallpaperManager
    get() = WallpaperManager.getInstance(context)

  override fun definition() = ModuleDefinition {
    Name("Wallpaper")

    AsyncFunction("setWallpaper") { uri: String, target: String, allowBackup: Boolean, crop: Map<String, Any?>? ->
      applyWallpaper(uri, target, allowBackup, parseCrop(crop))
    }

    AsyncFunction("isWallpaperSupported") {
      wallpaperManager.isWallpaperSupported
    }

    AsyncFunction("isSetWallpaperAllowed") {
      wallpaperManager.isSetWallpaperAllowed
    }

    AsyncFunction("getWallpaperId") { target: String ->
      wallpaperManager.getWallpaperId(WallpaperTarget.screenFromString(target))
    }

    AsyncFunction("isLiveWallpaperSupported") {
      LiveWallpaperSupport.isSupported(context)
    }

    AsyncFunction("getCurrentLiveWallpaper") {
      LiveWallpaperSupport.current(context)
    }

    AsyncFunction("setLiveWallpaperImage") { uri: String, motion: String ->
      LiveWallpaperConfigStore.saveImage(context, uri, normalizeMotion(motion))
    }

    AsyncFunction("clearLiveWallpaperImage") {
      LiveWallpaperConfigStore.clearImage(context)
    }

    AsyncFunction("openLiveWallpaperPicker") {
      LiveWallpaperSupport.openPicker(appContext)
    }
  }

  private fun normalizeMotion(value: String): String = when (value.lowercase()) {
    LiveWallpaperConfigStore.MOTION_PAN -> LiveWallpaperConfigStore.MOTION_PAN
    LiveWallpaperConfigStore.MOTION_NONE -> LiveWallpaperConfigStore.MOTION_NONE
    else -> throw WallpaperException(
      WallpaperErrorCode.INVALID_ARGUMENT,
      "Invalid motion \"$value\". Expected \"pan\" or \"none\"."
    )
  }

  private fun applyWallpaper(
    uri: String,
    target: String,
    allowBackup: Boolean,
    crop: Rect?
  ): Map<String, Any> {
    val wallpaperTarget = WallpaperTarget.fromString(target)
    ensureWallpaperAllowed()

    val resultId = WallpaperImageSourceResolver.open(context, uri).use { source ->
      try {
        wallpaperManager.setStream(source.stream, crop, allowBackup, wallpaperTarget.flags)
      } catch (error: SecurityException) {
        throw WallpaperException(
          WallpaperErrorCode.WALLPAPER_NOT_ALLOWED,
          "The app is not allowed to set the wallpaper. Make sure SET_WALLPAPER is declared in AndroidManifest.xml.",
          error
        )
      } catch (error: IOException) {
        throw WallpaperException(
          WallpaperErrorCode.WALLPAPER_FAILED,
          "Android could not apply the wallpaper: ${error.message ?: "unknown error"}",
          error
        )
      } catch (error: IllegalArgumentException) {
        throw WallpaperException(
          WallpaperErrorCode.INVALID_ARGUMENT,
          "Android rejected the crop rectangle. Make sure it fits inside the image.",
          error
        )
      } catch (error: RuntimeException) {
        throw WallpaperException(
          WallpaperErrorCode.WALLPAPER_FAILED,
          "Android could not apply the wallpaper: ${error.message ?: "unknown error"}",
          error
        )
      }
    }

    val wallpaperId = if (resultId > 0) {
      resultId
    } else {
      val flag = if (wallpaperTarget == WallpaperTarget.LOCK) {
        WallpaperManager.FLAG_LOCK
      } else {
        WallpaperManager.FLAG_SYSTEM
      }
      runCatching { wallpaperManager.getWallpaperId(flag) }.getOrDefault(-1)
    }

    return mapOf(
      "success" to true,
      "wallpaperId" to wallpaperId
    )
  }

  private fun ensureWallpaperAllowed() {
    val manager = wallpaperManager

    if (!manager.isWallpaperSupported) {
      throw WallpaperException(
        WallpaperErrorCode.WALLPAPER_NOT_ALLOWED,
        "Wallpapers are not supported on this device."
      )
    }

    if (!manager.isSetWallpaperAllowed) {
      throw WallpaperException(
        WallpaperErrorCode.WALLPAPER_NOT_ALLOWED,
        "A device policy prevents this app from changing the wallpaper."
      )
    }
  }

  private fun parseCrop(crop: Map<String, Any?>?): Rect? {
    if (crop == null) {
      return null
    }

    fun dimension(key: String): Int {
      val value = crop[key]
        ?: throw WallpaperException(
          WallpaperErrorCode.INVALID_ARGUMENT,
          "`crop.$key` is required."
        )
      val number = value as? Number
        ?: throw WallpaperException(
          WallpaperErrorCode.INVALID_ARGUMENT,
          "`crop.$key` must be a number."
        )
      return number.toInt()
    }

    val x = dimension("x")
    val y = dimension("y")
    val width = dimension("width")
    val height = dimension("height")

    if (x < 0 || y < 0 || width <= 0 || height <= 0) {
      throw WallpaperException(
        WallpaperErrorCode.INVALID_ARGUMENT,
        "Invalid crop rectangle: x and y must be 0 or greater, width and height must be greater than 0."
      )
    }

    return Rect(x, y, x + width, y + height)
  }
}
