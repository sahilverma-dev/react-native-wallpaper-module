# @sahilverma-dev/wallpaper-module

Apply images as Android **home screen**, **lock screen** or **both** wallpapers from React Native and Expo.

Built with Kotlin + the Expo Modules API, so a single implementation works in Expo development builds, EAS builds and bare React Native CLI apps (with Expo Modules installed).

| Platform | Support |
| --- | --- |
| Android | ✅ API 24+ (Android 7.0) |
| iOS | ❌ Not implemented |
| Web | ❌ Not implemented |
| Expo Go | ❌ Custom native module — use a development build |

---

## Features

- Set home, lock or both wallpapers.
- Local `file://` URIs, Android `content://` URIs, and remote `http(s)://` URLs.
- Optional crop rectangle.
- Typed TypeScript API with stable error codes.
- Streams images natively — no base64, no full-size copies in JS memory.
- New Architecture and legacy architecture compatible.
- Expo config plugin for the required permission.

---

## Installation

### Expo (development build / EAS Build)

```bash
npx expo install @sahilverma-dev/wallpaper-module
```

Add the plugin to `app.json` (optional — the library manifest already declares the permission, the plugin makes it explicit and survives manifest stripping):

```json
{
  "expo": {
    "plugins": ["@sahilverma-dev/wallpaper-module"]
  }
}
```

Create a new development build after installing:

```bash
npx expo prebuild
npx expo run:android
# or: eas build --profile development --platform android
```

> **Expo Go is not supported.** Expo Go cannot contain third-party native code. The JS API still imports safely, but native calls reject with `E_WALLPAPER_FAILED` and a message explaining that a development build is required.

### Bare React Native CLI

Bare apps can consume this package after installing Expo Modules infrastructure:

```bash
npm install @sahilverma-dev/wallpaper-module
npx install-expo-modules@latest
cd android && ./gradlew clean
npx react-native run-android
```

Then rebuild the native app. Autolinking picks the module up from `expo-module.config.json`; no manual registration is needed. The `SET_WALLPAPER` and `INTERNET` permissions are merged from the library manifest.

### Requirements

- Expo SDK 54+ (tested on SDK 58, React Native 0.88).
- Android 7.0 (API 24) or newer.
- A development or production build — not Expo Go.

---

## Usage

```tsx
import {
  setWallpaper,
  isWallpaperSupported,
  isSetWallpaperAllowed,
  getWallpaperId,
} from '@sahilverma-dev/wallpaper-module';

// Home screen (default target)
await setWallpaper({ uri: imageUri });

// Lock screen
await setWallpaper({ uri: imageUri, target: 'lock' });

// Both screens
await setWallpaper({ uri: imageUri, target: 'both' });

// Remote image, downloaded natively
await setWallpaper({
  uri: 'https://example.com/wallpaper.jpg',
  target: 'home',
});

// Crop while applying
await setWallpaper({
  uri: imageUri,
  crop: { x: 0, y: 0, width: 1080, height: 1920 },
});
```

### Picking an image with `expo-image-picker`

```tsx
const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
if (!result.canceled) {
  await setWallpaper({ uri: result.assets[0].uri, target: 'home' });
}
```

### Capability checks

```ts
const supported = await isWallpaperSupported(); // device can display wallpapers
const allowed = await isSetWallpaperAllowed(); // policy allows changing it

const homeId = await getWallpaperId('home');
const lockId = await getWallpaperId('lock');
```

Both capability helpers resolve to `false` on non-Android platforms instead of throwing.

### Error handling

```ts
import { isWallpaperError } from '@sahilverma-dev/wallpaper-module';

try {
  await setWallpaper({ uri });
} catch (error) {
  if (isWallpaperError(error)) {
    switch (error.code) {
      case 'E_DOWNLOAD_FAILED':
        // offer a retry
        break;
      case 'E_WALLPAPER_NOT_ALLOWED':
        // device policy
        break;
    }
  }
}
```

---

## API

### `setWallpaper(options): Promise<SetWallpaperResult>`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `uri` | `string` | — | `file://`, `content://`, `http(s)://`, or a bare absolute path. |
| `target` | `'home' \| 'lock' \| 'both'` | `'home'` | Screen(s) to update. |
| `allowBackup` | `boolean` | `true` | Let Android keep a backup copy so the wallpaper can be restored. |
| `crop` | `{ x, y, width, height }` | — | Source rectangle in image pixels. Must fit inside the image. |

Resolves with:

```ts
{
  success: boolean;   // true when Android accepted the wallpaper
  wallpaperId: number; // wallpaper id reported by Android, or -1
}
```

### `isWallpaperSupported(): Promise<boolean>`

Returns `false` on non-Android platforms.

### `isSetWallpaperAllowed(): Promise<boolean>`

Returns whether device policy currently permits changing the wallpaper. Returns `false` on non-Android platforms.

### `getWallpaperId(target?): Promise<number>`

`target` is `'home'` (default) or `'lock'`. Resolves to `-1` when Android does not expose an id.

### Types

```ts
type WallpaperTarget = 'home' | 'lock' | 'both';
type WallpaperScreen = 'home' | 'lock';
```

---

## Error codes

| Code | Meaning |
| --- | --- |
| `E_INVALID_URI` | Malformed URI, unsupported scheme, or a base64 `data:` URI. |
| `E_IMAGE_NOT_FOUND` | File missing, unreadable, or content URI without permission. |
| `E_DOWNLOAD_FAILED` | Remote download failed, timed out, or returned a non-2xx status. |
| `E_UNSUPPORTED_FORMAT` | Not a JPEG, PNG or WebP image. |
| `E_WALLPAPER_NOT_ALLOWED` | Device/policy does not allow changing wallpapers. |
| `E_WALLPAPER_FAILED` | Android rejected the operation, or the native module is missing. |
| `E_UNSUPPORTED_TARGET` | Invalid target value (`getWallpaperId` rejects `'both'`). |
| `E_UNSUPPORTED_PLATFORM` | Called on iOS/web. |
| `E_INVALID_ARGUMENT` | An option has the wrong type or an invalid crop. |

All rejections are `WallpaperError` instances with a `code`, a readable `message`, and the original native `cause`.

---

## Behavior and limits

### Supported image formats

JPEG, PNG and WebP. The native layer sniffs the magic bytes before calling `WallpaperManager`, so a `.jpg` extension on an HTML error page is rejected early.

### URI handling

| URI | Native handling |
| --- | --- |
| `file://` | `FileInputStream` |
| `content://` | `ContentResolver.openInputStream` |
| `http(s)://` | `HttpURLConnection`, streamed directly into `WallpaperManager` |

Files are closed and HTTP connections are disconnected after the operation, including on failure. Network I/O runs on the Expo modules background queue, never the UI thread.

### Memory

Images are streamed, but Android still decodes the bitmap internally to apply it. Very large images can be memory-heavy on low-end devices; pass a `crop` rectangle to reduce the decoded region when needed.

### Lock screen caveats

Some Android manufacturers do not support a separate lock-screen wallpaper, even on supported API levels. `target: 'lock'` may update both screens, be ignored, or fail. Test on real devices — a successful home-screen change does not guarantee lock-screen behavior.

### Permissions

- `android.permission.SET_WALLPAPER` — normal permission, granted at install time, no runtime dialog.
- `android.permission.INTERNET` — merged from the library manifest, needed for remote URLs.

Some OEM ROMs (Xiaomi/MIUI, Oppo, Vivo) add their own wallpaper restrictions on top of Android. Surface `E_WALLPAPER_NOT_ALLOWED` to the user instead of assuming the call always succeeds.

---

## Development

```bash
npm install
npm run build       # TypeScript + plugin
npm test            # Jest unit tests
npm run lint
```

### Example app

```bash
cd example
npm install
npx expo prebuild --platform android
npx expo run:android
```

The example applies a bundled 1080×1920 PNG, a gallery image, and a remote image.

### Manual Android test matrix

| Scenario | Expected |
| --- | --- |
| Home wallpaper from local file | Home screen changes, `wallpaperId` > 0 |
| Lock wallpaper | Lock screen changes (device dependent) |
| Both | Both screens change |
| Remote HTTPS image | Downloads and applies |
| Remote HTTP image on Android 9+ | `E_DOWNLOAD_FAILED` with cleartext hint |
| Missing file | `E_IMAGE_NOT_FOUND` |
| PDF/text file renamed to `.jpg` | `E_UNSUPPORTED_FORMAT` |
| Airplane mode + remote URL | `E_DOWNLOAD_FAILED` |
| Device with wallpaper policy | `E_WALLPAPER_NOT_ALLOWED` |
| Expo Go | `E_WALLPAPER_FAILED` with development-build hint |

Test on at least one physical device; emulator behavior for lock screens is not representative of OEM devices.

---

## Roadmap

- `0.1.0` — Android implementation, URI handling, typed errors, Expo + CLI support.
- `0.2.0` — Reliability improvements and broader device testing.
- `1.0.0` — Stable public API.

Out of scope: iOS wallpapers, live wallpapers, scheduling/rotation, gallery UI.

---

## License

MIT © Sahil Verma
