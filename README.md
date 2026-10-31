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
- Bundled live wallpaper service with configurable image, slow pan/zoom, and gradient fallback.
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

## Live wallpapers

Android **never allows apps to activate a live wallpaper silently**. The module
ships a `WallpaperService` (shown as “Animated wallpaper” in the system picker)
and exposes the user-driven flow around it.

```ts
import {
  setLiveWallpaperImage,
  openLiveWallpaperPicker,
  getCurrentLiveWallpaper,
  clearLiveWallpaperImage,
} from '@sahilverma-dev/wallpaper-module';

// 1. Choose the image the service renders (optional).
await setLiveWallpaperImage({ uri: imageUri, motion: 'pan' });

// 2. Open the system preview. The user must confirm there.
await openLiveWallpaperPicker();

// 3. When the app becomes active again, check what was applied.
const current = await getCurrentLiveWallpaper();
if (current?.isOurs) {
  // the bundled service is now the active live wallpaper
}

// 4. Revert to the animated gradient at any time.
await clearLiveWallpaperImage();
```

`setLiveWallpaperImage` copies the image into the app's private storage, so the
original file can be deleted afterwards. The service keeps rendering while the
app is in the background; animation pauses whenever the wallpaper is not visible.

### Live wallpaper limits and caveats

- **Activation is always user-confirmed.** `openLiveWallpaperPicker()` resolves
  when the picker activity starts, not when the user confirms. Android provides
  no result for this flow — re-check with `getCurrentLiveWallpaper()`.
- **Static and live wallpapers are mutually exclusive per screen.** Applying
  `setWallpaper()` replaces an active live wallpaper (standard Android behavior).
- **Storage:** images are capped at 50 MB compressed and 32 megapixels decoded,
  then downsampled to at most 2560 px on the long edge.
- **Missing image:** if the configured file disappears (for example after
  clearing app data), the service falls back to the gradient instead of crashing.
- **`motion: 'none'`** renders a still image and avoids per-frame work — useful
  for battery-sensitive apps.
- **Device support:** some Android Go / heavily customized ROMs do not expose
  live wallpapers. `isLiveWallpaperSupported()` returns `false` and the picker
  throws `E_LIVE_WALLPAPER_UNAVAILABLE`.
- **Lock screen:** whether a live wallpaper also covers the lock screen is
  controlled by the OS and varies by version/OEM.
- **Uninstalling the app** removes the service; Android reverts to the default
  wallpaper.

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

### `setLiveWallpaperImage(options): Promise<void>`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `uri` | `string` | — | Same URI formats as `setWallpaper`. |
| `motion` | `'pan' \| 'none'` | `'pan'` | Slow pan/zoom, or a still image. |

Copies the image into app storage and updates a running live wallpaper
immediately. Does **not** activate the live wallpaper.

### `clearLiveWallpaperImage(): Promise<void>`

Deletes the configured image. The active live wallpaper falls back to its
animated gradient; it stays active.

### `isLiveWallpaperSupported(): Promise<boolean>`

Whether the device supports live wallpapers and the bundled service is
declared. Returns `false` on non-Android platforms.

### `getCurrentLiveWallpaper(): Promise<LiveWallpaperInfo | null>`

Resolves to `null` when a static wallpaper is active (or the platform is not
Android). Otherwise:

```ts
{
  packageName: string;
  className: string;
  isOurs: boolean; // true when it is this module's service
}
```

### `openLiveWallpaperPicker(): Promise<void>`

Opens the system preview for the bundled service. Resolves when the picker
starts; Android gives no confirmation result.

### Live wallpaper types

```ts
type LiveWallpaperMotion = 'pan' | 'none';

interface SetLiveWallpaperImageOptions {
  uri: string;
  motion?: LiveWallpaperMotion;
}
```

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
| `E_IMAGE_TOO_LARGE` | Live wallpaper image exceeds 50 MB compressed or 32 megapixels decoded. |
| `E_WALLPAPER_NOT_ALLOWED` | Device/policy does not allow changing wallpapers. |
| `E_WALLPAPER_FAILED` | Android rejected the operation, or the native module is missing. |
| `E_UNSUPPORTED_TARGET` | Invalid target value (`getWallpaperId` rejects `'both'`). |
| `E_UNSUPPORTED_PLATFORM` | Called on iOS/web. |
| `E_INVALID_ARGUMENT` | An option has the wrong type or an invalid crop/motion. |
| `E_LIVE_WALLPAPER_UNAVAILABLE` | Device lacks live wallpaper support or a picker. |

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

Live wallpaper images follow the same rule: the file is copied to app storage,
validated, and decoded with sampling (max 2560 px on the long edge). Decoded
frames are released when the service is destroyed, and the service falls back to
a gradient if decoding fails or memory is exhausted.

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
It also configures the bundled live wallpaper and opens the system picker.

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
| Live wallpaper configured + picker confirmed | `getCurrentLiveWallpaper().isOurs === true` |
| Live picker cancelled | Picker closes, wallpaper unchanged |
| Live image deleted / app data cleared | Service falls back to gradient, no crash |
| 60 MB live image | `E_IMAGE_TOO_LARGE` |
| 40 MP live image | `E_IMAGE_TOO_LARGE` |
| Motion `'none'` | Static rendering, no frame loop |
| Setting a static wallpaper while live is active | Static wallpaper replaces the live one |
| Expo Go | `E_WALLPAPER_FAILED` with development-build hint |

Test on at least one physical device; emulator behavior for lock screens is not representative of OEM devices.

---

## Roadmap

- `0.1.0` — Android implementation, URI handling, typed errors, Expo + CLI support.
- `0.2.0` — Live wallpaper service, picker flow, reliability improvements.
- `1.0.0` — Stable public API.

Out of scope: iOS wallpapers, scheduling/rotation, gallery UI, custom per-frame
live wallpaper rendering driven from JavaScript.

---

## License

MIT © Sahil Verma
