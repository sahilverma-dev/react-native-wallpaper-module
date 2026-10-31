package expo.modules.wallpaper

import expo.modules.kotlin.exception.CodedException

/**
 * Error codes shared with the TypeScript API. Keep this list in sync with
 * `src/errors.ts`.
 */
internal object WallpaperErrorCode {
  const val INVALID_URI = "E_INVALID_URI"
  const val IMAGE_NOT_FOUND = "E_IMAGE_NOT_FOUND"
  const val DOWNLOAD_FAILED = "E_DOWNLOAD_FAILED"
  const val UNSUPPORTED_FORMAT = "E_UNSUPPORTED_FORMAT"
  const val WALLPAPER_NOT_ALLOWED = "E_WALLPAPER_NOT_ALLOWED"
  const val WALLPAPER_FAILED = "E_WALLPAPER_FAILED"
  const val UNSUPPORTED_TARGET = "E_UNSUPPORTED_TARGET"
  const val INVALID_ARGUMENT = "E_INVALID_ARGUMENT"
  const val IMAGE_TOO_LARGE = "E_IMAGE_TOO_LARGE"
  const val LIVE_WALLPAPER_UNAVAILABLE = "E_LIVE_WALLPAPER_UNAVAILABLE"
}

internal class WallpaperException(
  code: String,
  message: String,
  cause: Throwable? = null
) : CodedException(code, message, cause)
