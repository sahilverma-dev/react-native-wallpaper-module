# PRD — @sahilverma-dev/wallpaper-module

**Version:** 0.2.0
**Status:** Implemented (Android), pending real-device validation
**Platform:** Android
**Language:** TypeScript + Kotlin
**License:** MIT

---

## 1. Overview

A React Native native module that applies images as Android home screen, lock screen, or both wallpapers using Android's `WallpaperManager` API.

The package must work in Expo projects (development builds and EAS builds) and in bare React Native CLI apps that have Expo Modules installed. Expo Go is explicitly not supported because it cannot load third-party native code.

## 2. Goals

- Apply home screen, lock screen, and both-screen wallpapers.
- Support local `file://` URIs, Android `content://` URIs, and remote `http(s)://` URLs.
- Bundle a live wallpaper service with a user-driven picker flow.
- Provide a fully typed TypeScript API with stable error codes.
- Avoid base64 and unnecessary image copies in JavaScript.
- Ship one Kotlin implementation consumable by Expo and bare React Native.

## 3. Non-goals

- iOS wallpaper support.
- JavaScript-driven per-frame live wallpaper rendering.
- Scheduling or automatic rotation.
- Wallpaper gallery/download management UI.
- Expo Go support.

## 4. Technology stack

| Layer | Technology |
| --- | --- |
| Public API | TypeScript |
| Native implementation | Kotlin |
| Native module framework | Expo Modules API |
| Android API | `android.app.WallpaperManager` |
| Package manager | npm |
| Build | Gradle |
| Tests | Jest (JS) + Android build + manual device matrix |
| CI/CD | GitHub Actions |

## 5. Public API

### `setWallpaper(options): Promise<SetWallpaperResult>`

Options:

- `uri: string` — `file://`, `content://`, `http(s)://`, or an absolute path.
- `target?: 'home' | 'lock' | 'both'` — defaults to `'home'`.
- `allowBackup?: boolean` — defaults to `true`.
- `crop?: { x, y, width, height }` — optional source rectangle.

Returns `{ success: boolean; wallpaperId: number }`.

### `isWallpaperSupported(): Promise<boolean>`

Returns `false` on non-Android platforms.

### `isSetWallpaperAllowed(): Promise<boolean>`

Returns `false` on non-Android platforms.

### `getWallpaperId(target?: 'home' | 'lock'): Promise<number>`

Defaults to `'home'`. `'both'` is rejected because ids are per screen.

### Live wallpapers

- `setLiveWallpaperImage({ uri, motion?: 'pan' | 'none' }): Promise<void>` — copies the image into app storage and configures the bundled service. Does not activate it.
- `clearLiveWallpaperImage(): Promise<void>` — removes the image; the service falls back to a gradient.
- `isLiveWallpaperSupported(): Promise<boolean>`.
- `getCurrentLiveWallpaper(): Promise<{ packageName, className, isOurs } | null>`.
- `openLiveWallpaperPicker(): Promise<void>` — launches the system preview for the bundled service.

Activation is always user-confirmed because Android does not allow apps to set
live wallpapers programmatically.

## 6. Native implementation

### Static wallpapers

- `WallpaperManager.setStream(InputStream, Rect?, Boolean, Int)`.
- Targets: `FLAG_SYSTEM`, `FLAG_LOCK`, or both.
- Manifest permission: `android.permission.SET_WALLPAPER` (normal, install-time).
- `INTERNET` is merged for remote URL support.
- Minimum Android API: 24.
- URI resolution:
  - `file://` → `FileInputStream`
  - `content://` → `ContentResolver.openInputStream`
  - `http(s)://` → `HttpURLConnection` (streamed, redirects followed, timeouts set)
- I/O runs on the Expo modules background queue; streams and connections are always closed.
- Image formats: JPEG, PNG, WebP, validated by magic bytes before decode.

### Live wallpaper

- `ExpoLiveWallpaperService` (`WallpaperService`) declared with
  `BIND_WALLPAPER`, shown as “Animated wallpaper”.
- Renders the configured image with slow pan/zoom (EXIF-aware, cover-scaled) or
  an animated gradient fallback.
- Frames only run while visible; `motion: 'none'` renders a still image.
- Image is copied atomically into `filesDir/live_wallpaper/` and limited to
  50 MB / 32 MP; decoding is sampled to 2560 px max edge.
- Configuration changes are pushed to running engines in-process; preferences
  and files survive process restarts.
- Missing image, decode failure and OOM fall back to the gradient instead of
  crashing the service.

## 7. Compatibility

### Expo

- Prebuild, development builds, EAS development/production builds.
- Config plugin ensures the permission.
- Tested locally with SDK 58 / React Native 0.88 / Android API 36 build tools.

### Bare React Native CLI

- Requires Expo Modules infrastructure (`npx install-expo-modules@latest`).
- Autolinking via `expo-module.config.json`.
- New Architecture supported; legacy architecture supported by Expo Modules.

### iOS / web

Not supported. Public functions fail with `E_UNSUPPORTED_PLATFORM` or return `false` for capability checks.

## 8. Error handling

All rejections are `WallpaperError` instances with a stable `code`:

| Code | Meaning |
| --- | --- |
| `E_INVALID_URI` | Malformed URI, unsupported scheme, base64 input. |
| `E_IMAGE_NOT_FOUND` | Missing/unreadable file or content URI. |
| `E_DOWNLOAD_FAILED` | Remote download failed. |
| `E_UNSUPPORTED_FORMAT` | Image is not JPEG/PNG/WebP. |
| `E_IMAGE_TOO_LARGE` | Live image exceeds 50 MB or 32 MP. |
| `E_WALLPAPER_NOT_ALLOWED` | Device policy or hardware restriction. |
| `E_WALLPAPER_FAILED` | Android failure or missing native module. |
| `E_UNSUPPORTED_TARGET` | Invalid target. |
| `E_UNSUPPORTED_PLATFORM` | Called on iOS/web. |
| `E_INVALID_ARGUMENT` | Invalid option, crop or motion. |
| `E_LIVE_WALLPAPER_UNAVAILABLE` | No live wallpaper support/picker. |

Unknown native codes are mapped to `E_WALLPAPER_FAILED` while preserving the original `cause`.

## 9. Non-functional requirements

- No extra native dependencies beyond Expo Modules and the Android SDK.
- No base64 requirement.
- No unnecessary full-resolution decoding on the JS side.
- Deterministic Promise behavior; every path resolves or rejects once.
- Small package footprint (build output, Kotlin sources, plugin).

## 10. Repository layout

```
android/            Kotlin module, live wallpaper service, library manifest + resources
src/                TypeScript API, validation, errors, tests
plugin/             Expo config plugin (compiled to plugin/build)
app.plugin.js       Plugin entry for Expo
example/            Expo example app (static, gallery, remote and live wallpapers)
internal/           Template build/test scripts
```

## 11. Acceptance criteria

- [x] Home wallpaper can be applied.
- [x] Lock wallpaper can be applied (emulator/device validation pending).
- [x] Both wallpapers can be applied (emulator/device validation pending).
- [x] Local file URI supported.
- [x] Content URI supported.
- [x] Remote image URL supported.
- [x] Unsupported inputs return meaningful typed errors.
- [x] Large images are streamed, not base64-encoded.
- [x] Bundled live wallpaper service declared and picker flow available.
- [x] Live wallpaper image can be configured/cleared; missing images fall back safely.
- [ ] Live wallpaper picker verified on a physical device.
- [x] Expo project builds (prebuild + `assembleDebug` verified).
- [ ] Expo production/EAS build verified.
- [ ] Bare React Native CLI app verified end to end.
- [x] README documents installation and usage.
- [ ] npm package published.

## 12. Release plan

- `0.1.0` — Initial static wallpaper functionality, URI handling, typed errors, docs.
- `0.2.0` — Live wallpaper service and picker flow.
- `1.0.0` — Stable API and production documentation.

## 13. Validation plan

| Environment | Purpose |
| --- | --- |
| Expo development build | Expo compatibility |
| Expo production/EAS build | Production compatibility |
| Bare RN CLI app | CLI compatibility |
| Android API 24 emulator | Minimum supported version |
| Latest Android emulator | Current Android compatibility |
| Physical Android device | OEM-specific lock screen behavior |

Known device caveat: some OEMs do not support separate lock-screen wallpapers even when `FLAG_LOCK` is available, so lock-screen behavior must be tested independently of home-screen success.
