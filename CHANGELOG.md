# Changelog

## 0.3.0

### Added

- Video live wallpapers powered by Media3 ExoPlayer: MP4/WebM/MKV, loop, mute and playback speed.
- `fill`, `fit` and `crop` video scaling through the Media3 effects pipeline.
- `Wallpaper.live.applyVideo()` / `applyImage()` — configure and open the system picker in one call.
- Namespaced `Wallpaper` API (`static`, `live`, `info`, `device`, `system`) alongside the existing flat exports.
- `Wallpaper.device.getCapabilities()` with API level, static/live/video support, picker and size limits.
- `Wallpaper.info.get()` snapshot with wallpaper ids, active type and live wallpaper info.
- `clearWallpaper(target)` to restore the system default (single-screen clear requires Android 9+).
- New error code: `E_UNSUPPORTED_API_LEVEL`.
- Bundled 4-second test video in the example app.

### Changed

- Live wallpaper media is now stored per kind (`images/`, `videos/`); configuring one kind removes the other.
- `clearLiveWallpaperImage()` is now an alias for clearing all configured media.
- Image and video URIs share one streaming resolver with a 200 MB video cap.

### Fixed

- Video previews were black because Media3's effects pipeline received a raw `Surface` without an output size. The engine now uses `setVideoSurfaceHolder`, which reports the surface size and the effects chain (fill/fit/crop) renders correctly.
- On OEM Android 13 builds where `WallpaperManager.getWallpaperInfo()` returns `null`, the active live wallpaper is now detected from the running service engine; `getWallpaperInfo(FLAG_SYSTEM)` is used on Android 14+.
- Video is attached to the surface only after effects and dimensions are known, preventing dropped frames.

### Safety

- Video decode/playback errors, missing files and unsupported devices fall back to the gradient.
- Video playback pauses when the wallpaper is not visible and resumes on return.
- Unmuted playback is opt-in; the default is muted.

## 0.2.0

### Added

- Bundled `ExpoLiveWallpaperService` (renders a configured image with slow pan/zoom, or an animated gradient fallback).
- `setLiveWallpaperImage({ uri, motion })` and `clearLiveWallpaperImage()`.
- `isLiveWallpaperSupported()`, `getCurrentLiveWallpaper()` and `openLiveWallpaperPicker()`.
- EXIF-aware decoding, sampled downscaling (max 2560 px edge), and a 50 MB / 32 MP input limit.
- In-process config propagation so a running live wallpaper updates immediately.
- New error codes: `E_IMAGE_TOO_LARGE`, `E_LIVE_WALLPAPER_UNAVAILABLE`.

### Safety

- Missing/deleted images, decode failures and OOM fall back to the gradient instead of crashing the wallpaper service.
- Animation stops when the wallpaper is not visible; `motion: 'none'` avoids per-frame work.

## 0.1.0

Initial release.

### Added

- `setWallpaper({ uri, target, allowBackup, crop })` for home, lock and both screens.
- `isWallpaperSupported()`, `isSetWallpaperAllowed()` and `getWallpaperId(target)`.
- Native image streaming for `file://`, `content://` and `http(s)://` URIs — no base64 bridge traffic.
- JPEG, PNG and WebP validation before the image reaches `WallpaperManager`.
- Typed `WallpaperError` with stable `E_*` codes.
- Expo config plugin that ensures the `SET_WALLPAPER` permission.
- Support for Expo development/production builds and bare React Native CLI apps with Expo Modules.
- Example app covering bundled, gallery and remote images.
