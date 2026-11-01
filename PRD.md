# PRD — @sahilverma-dev/wallpaper-module

**Version:** 0.3.0
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

- `setLiveWallpaperImage({ uri, motion?: 'pan' | 'none' }): Promise<void>` — configures the bundled service with an image.
- `setLiveWallpaperVideo({ uri, loop?, muted?, speed?, scaling? }): Promise<void>` — configures it with a video (Media3).
- `applyLiveWallpaperImage(options)` / `applyLiveWallpaperVideo(options)` — configure and open the picker, returning `{ requiresConfirmation: true }`.
- `clearLiveWallpaper(): Promise<void>` — removes all configured media; gradient fallback.
- `isLiveWallpaperSupported()`, `getCurrentLiveWallpaper()`, `openLiveWallpaperPicker()`.
- `getWallpaperCapabilities()` — API level, static/live/video support, picker, limits.
- `getWallpaperInfo()` — home/lock ids, active type and live component.

Activation is always user-confirmed because Android does not allow apps to set
live wallpapers programmatically.

### Namespaced API

`Wallpaper.static`, `Wallpaper.live`, `Wallpaper.info`, `Wallpaper.device` and
`Wallpaper.system` group the same functions. Flat named exports remain.

## 6. Native implementation

### Static wallpapers

- `WallpaperManager.setStream(InputStream, Rect?, Boolean, Int)`.
- `WallpaperManager.clear(which)` on Android 9+; whole-wallpaper clear on 7/8.
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
  a looping video via Media3 ExoPlayer, with an animated gradient fallback.
- Video: loop, mute, speed 0.25–3, fill/fit/crop through Media3 effects;
  playback pauses when hidden and resumes on return.
- Frames only run while visible; `motion: 'none'` renders a still image.
- Image is copied atomically into `filesDir/live_wallpaper/images/` and limited
  to 50 MB / 32 MP; decoding is sampled to 2560 px max edge.
- Video is copied into `filesDir/live_wallpaper/videos/` (200 MB cap), verified
  with `MediaExtractor` for a video track, and decoded directly to the surface.
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
| `E_UNSUPPORTED_FORMAT` | Image is not JPEG/PNG/WebP, or file has no video track. |
| `E_IMAGE_TOO_LARGE` | Live media exceeds limits (image 50 MB/32 MP, video 200 MB). |
| `E_WALLPAPER_NOT_ALLOWED` | Device policy or hardware restriction. |
| `E_WALLPAPER_FAILED` | Android failure or missing native module. |
| `E_UNSUPPORTED_TARGET` | Invalid target. |
| `E_UNSUPPORTED_PLATFORM` | Called on iOS/web. |
| `E_INVALID_ARGUMENT` | Invalid option, crop, motion, speed or scaling. |
| `E_LIVE_WALLPAPER_UNAVAILABLE` | No live wallpaper support/picker. |
| `E_UNSUPPORTED_API_LEVEL` | Operation needs a newer Android version. |

Unknown native codes are mapped to `E_WALLPAPER_FAILED` while preserving the original `cause`.

## 9. Non-functional requirements

- No extra native dependencies beyond Expo Modules, Media3 and the Android SDK.
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
- [x] Video live wallpaper configures a local/remote MP4 with loop, mute, speed and scaling.
- [x] Video playback errors and missing files fall back to the gradient.
- [x] Device capabilities expose static/live/video support and limits.
- [x] Namespaced `Wallpaper` API with backward-compatible flat exports.
- [x] Static wallpaper can be cleared.
- [ ] Live wallpaper picker verified on a physical device.
- [ ] Video live wallpaper rendering verified on a physical device.
- [x] Expo project builds (prebuild + `assembleDebug` verified).
- [ ] Expo production/EAS build verified.
- [ ] Bare React Native CLI app verified end to end.
- [x] README documents installation and usage.
- [ ] npm package published.

## 12. Release plan

- `0.1.0` — Initial static wallpaper functionality, URI handling, typed errors, docs.
- `0.2.0` — Image live wallpaper service and picker flow.
- `0.3.0` — Video live wallpapers, namespaced API, capability detection.
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
