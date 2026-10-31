# PRD — @sahilverma-dev/wallpaper-module

**Version:** 0.1.0
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
- Provide a fully typed TypeScript API with stable error codes.
- Avoid base64 and unnecessary image copies in JavaScript.
- Ship one Kotlin implementation consumable by Expo and bare React Native.

## 3. Non-goals (v1)

- iOS wallpaper support.
- Live wallpapers.
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

## 6. Native implementation

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
| `E_WALLPAPER_NOT_ALLOWED` | Device policy or hardware restriction. |
| `E_WALLPAPER_FAILED` | Android failure or missing native module. |
| `E_UNSUPPORTED_TARGET` | Invalid target. |
| `E_UNSUPPORTED_PLATFORM` | Called on iOS/web. |
| `E_INVALID_ARGUMENT` | Invalid option or crop rectangle. |

Unknown native codes are mapped to `E_WALLPAPER_FAILED` while preserving the original `cause`.

## 9. Non-functional requirements

- No extra native dependencies beyond Expo Modules and the Android SDK.
- No base64 requirement.
- No unnecessary full-resolution decoding on the JS side.
- Deterministic Promise behavior; every path resolves or rejects once.
- Small package footprint (build output, Kotlin sources, plugin).

## 10. Repository layout

```
android/            Kotlin module + library manifest
src/                TypeScript API, validation, errors, tests
plugin/             Expo config plugin (compiled to plugin/build)
app.plugin.js       Plugin entry for Expo
example/            Expo example app (bundled, gallery and remote images)
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
- [x] Expo project builds (prebuild + `assembleDebug` verified).
- [ ] Expo production/EAS build verified.
- [ ] Bare React Native CLI app verified end to end.
- [x] README documents installation and usage.
- [ ] npm package published.

## 12. Release plan

- `0.1.0` — Initial native functionality, URI handling, typed errors, docs.
- `0.2.0` — Device matrix hardening, additional reliability work.
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
