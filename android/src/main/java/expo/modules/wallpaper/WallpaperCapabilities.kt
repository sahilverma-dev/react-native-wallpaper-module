package expo.modules.wallpaper

import android.app.WallpaperManager
import android.content.Context
import android.content.Intent
import android.media.MediaCodecList
import android.os.Build

/**
 * Device and package capability snapshot consumed by `Wallpaper.device.getCapabilities()`.
 */
internal object WallpaperCapabilities {
  fun build(context: Context): Map<String, Any> {
    val manager = WallpaperManager.getInstance(context)
    val apiLevel = Build.VERSION.SDK_INT
    val liveSupported = LiveWallpaperSupport.isSupported(context)

    return mapOf(
      "apiLevel" to apiLevel,
      "staticWallpapers" to manager.isWallpaperSupported,
      "wallpaperSettingAllowed" to manager.isSetWallpaperAllowed,
      "liveWallpapers" to liveSupported,
      "liveWallpaperPicker" to canResolveLiveWallpaperPicker(context),
      "videoLiveWallpapers" to (liveSupported && hasVideoDecoder()),
      "lockScreenWallpapers" to (apiLevel >= Build.VERSION_CODES.N),
      "maxImageBytes" to LiveWallpaperConfigStore.MAX_IMAGE_BYTES.toDouble(),
      "maxImagePixels" to LiveWallpaperConfigStore.MAX_IMAGE_PIXELS.toDouble(),
      "maxVideoBytes" to LiveWallpaperConfigStore.MAX_VIDEO_BYTES.toDouble(),
      "minVideoSpeed" to LiveWallpaperConfigStore.MIN_VIDEO_SPEED.toDouble(),
      "maxVideoSpeed" to LiveWallpaperConfigStore.MAX_VIDEO_SPEED.toDouble()
    )
  }

  private fun canResolveLiveWallpaperPicker(context: Context): Boolean {
    val intent = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER)
    return intent.resolveActivity(context.packageManager) != null
  }

  private fun hasVideoDecoder(): Boolean {
    return try {
      MediaCodecList(MediaCodecList.REGULAR_CODECS).codecInfos.any { info ->
        !info.isEncoder && info.supportedTypes.any { type -> type.startsWith("video/") }
      }
    } catch (_: Exception) {
      false
    }
  }
}
