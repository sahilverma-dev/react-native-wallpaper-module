package expo.modules.wallpaper

import android.app.WallpaperManager

/**
 * Maps the readable JavaScript targets to Android's wallpaper flags.
 */
internal enum class WallpaperTarget(val flags: Int) {
  HOME(WallpaperManager.FLAG_SYSTEM),
  LOCK(WallpaperManager.FLAG_LOCK),
  BOTH(WallpaperManager.FLAG_SYSTEM or WallpaperManager.FLAG_LOCK);

  companion object {
    fun fromString(value: String): WallpaperTarget = when (value.lowercase()) {
      "home" -> HOME
      "lock" -> LOCK
      "both" -> BOTH
      else -> throw WallpaperException(
        WallpaperErrorCode.UNSUPPORTED_TARGET,
        "Invalid wallpaper target \"$value\". Expected \"home\", \"lock\" or \"both\"."
      )
    }

    fun screenFromString(value: String): Int = when (value.lowercase()) {
      "home" -> WallpaperManager.FLAG_SYSTEM
      "lock" -> WallpaperManager.FLAG_LOCK
      else -> throw WallpaperException(
        WallpaperErrorCode.UNSUPPORTED_TARGET,
        "Invalid wallpaper target \"$value\". Expected \"home\" or \"lock\"."
      )
    }
  }
}
