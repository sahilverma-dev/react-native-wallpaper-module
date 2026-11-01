package expo.modules.wallpaper

import java.util.concurrent.atomic.AtomicInteger

/**
 * Tracks live wallpaper engines running in this process.
 *
 * `WallpaperManager.getWallpaperInfo()` is the only public way to identify a
 * live wallpaper on Android 7–13, and some OEM builds return null even when a
 * live wallpaper is active. When that happens we can still recognise our own
 * service because its engine runs in this process.
 */
internal object LiveWallpaperRuntime {
  private val activeEngines = AtomicInteger(0)
  private val previewEngines = AtomicInteger(0)

  fun onEngineCreated(isPreview: Boolean) {
    if (isPreview) {
      previewEngines.incrementAndGet()
    } else {
      activeEngines.incrementAndGet()
    }
  }

  fun onEngineDestroyed(isPreview: Boolean) {
    if (isPreview) {
      previewEngines.updateAndGet { current -> maxOf(0, current - 1) }
    } else {
      activeEngines.updateAndGet { current -> maxOf(0, current - 1) }
    }
  }

  fun hasActiveEngine(): Boolean = activeEngines.get() > 0

  fun hasPreviewEngine(): Boolean = previewEngines.get() > 0
}
