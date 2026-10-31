# Changelog

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
