package expo.modules.wallpaper

import android.app.WallpaperManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.service.wallpaper.WallpaperService
import expo.modules.kotlin.AppContext

/**
 * Helpers for querying and launching the live wallpaper flow. Android does not
 * expose an API to activate a live wallpaper silently, so the only activation
 * path is the system preview/picker.
 */
internal object LiveWallpaperSupport {
  fun isSupported(context: Context): Boolean {
    val packageManager = context.packageManager

    if (!packageManager.hasSystemFeature(PackageManager.FEATURE_LIVE_WALLPAPER)) {
      return false
    }

    if (!WallpaperManager.getInstance(context).isWallpaperSupported) {
      return false
    }

    return isServiceDeclared(context)
  }

  /** Guards against apps that remove the bundled service from the manifest. */
  fun isServiceDeclared(context: Context): Boolean {
    val intent = Intent(WallpaperService.SERVICE_INTERFACE).setPackage(context.packageName)
    return context.packageManager
      .queryIntentServices(intent, 0)
      .any { resolveInfo ->
        resolveInfo.serviceInfo?.name == ExpoLiveWallpaperService::class.java.name
      }
  }

  /**
   * Returns the active live wallpaper, or null for static wallpapers/devices
   * where the information is unavailable.
   */
  @Suppress("DEPRECATION")
  fun current(context: Context): Map<String, Any>? {
    val info = try {
      WallpaperManager.getInstance(context).getWallpaperInfo()
    } catch (_: Exception) {
      null
    } ?: return null

    val component = info.component ?: return null
    val isOurs =
      component.packageName == context.packageName &&
        component.className == ExpoLiveWallpaperService::class.java.name

    return mapOf(
      "packageName" to component.packageName,
      "className" to component.className,
      "isOurs" to isOurs
    )
  }

  fun openPicker(appContext: AppContext) {
    val context = appContext.reactContext
      ?: throw WallpaperException(
        WallpaperErrorCode.WALLPAPER_FAILED,
        "React context is not available."
      )

    if (!isSupported(context)) {
      throw WallpaperException(
        WallpaperErrorCode.LIVE_WALLPAPER_UNAVAILABLE,
        "Live wallpapers are not supported on this device."
      )
    }

    val intent = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER).apply {
      putExtra(
        WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT,
        ComponentName(context, ExpoLiveWallpaperService::class.java)
      )
    }

    val activity = appContext.currentActivity

    try {
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    } catch (error: ActivityNotFoundException) {
      throw WallpaperException(
        WallpaperErrorCode.LIVE_WALLPAPER_UNAVAILABLE,
        "This device does not provide a live wallpaper picker.",
        error
      )
    } catch (error: SecurityException) {
      throw WallpaperException(
        WallpaperErrorCode.WALLPAPER_FAILED,
        "The live wallpaper picker could not be opened: permission denied.",
        error
      )
    }
  }
}
