# Changelog

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
