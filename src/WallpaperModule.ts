import { Platform } from 'react-native';

import type {
  LiveWallpaperApplyResult,
  LiveWallpaperInfo,
  SetLiveWallpaperImageOptions,
  SetLiveWallpaperVideoOptions,
  SetWallpaperOptions,
  SetWallpaperResult,
  WallpaperCapabilities,
  WallpaperInfoSummary,
  WallpaperScreen,
  WallpaperTarget,
} from './Wallpaper.types';
import { getWallpaperNativeModule, type WallpaperNativeModule } from './WallpaperNativeModule';
import { WallpaperError, toWallpaperError } from './errors';
import {
  normalizeClearTarget,
  normalizeScreen,
  normalizeSetLiveWallpaperImageOptions,
  normalizeSetLiveWallpaperVideoOptions,
  normalizeSetWallpaperOptions,
} from './validation';

const UNSUPPORTED_PLATFORM_MESSAGE =
  '@sahilverma-dev/wallpaper-module is only available on Android.';

const MISSING_NATIVE_MODULE_MESSAGE =
  'The native Wallpaper module is not available. Expo Go cannot load custom native modules — ' +
  'use a development build or a production build, and make sure the app was rebuilt after installing the package.';

function isAndroid(): boolean {
  return Platform.OS === 'android';
}

function isMissingNativeModuleError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  const message = (error as { message?: unknown }).message;
  return (
    code === 'ERR_MODULE_NOT_FOUND' ||
    (typeof message === 'string' && message.includes('Cannot find native module'))
  );
}

function native(): WallpaperNativeModule {
  try {
    return getWallpaperNativeModule();
  } catch (error) {
    if (isMissingNativeModuleError(error)) {
      throw new WallpaperError('E_WALLPAPER_FAILED', MISSING_NATIVE_MODULE_MESSAGE, {
        cause: error,
      });
    }
    throw error;
  }
}

function assertAndroid(): void {
  if (!isAndroid()) {
    throw new WallpaperError('E_UNSUPPORTED_PLATFORM', UNSUPPORTED_PLATFORM_MESSAGE);
  }
}

/**
 * Applies an image as the Android home screen, lock screen or both wallpapers.
 *
 * Images are streamed natively, so large photos never need to be base64
 * encoded or loaded into JavaScript memory.
 *
 * @example
 * ```ts
 * await setWallpaper({ uri: imageUri, target: 'home' });
 * ```
 */
export async function setWallpaper(options: SetWallpaperOptions): Promise<SetWallpaperResult> {
  try {
    assertAndroid();
    const normalized = normalizeSetWallpaperOptions(options);
    const result = await native().setWallpaper(
      normalized.uri,
      normalized.target,
      normalized.allowBackup,
      normalized.crop
    );

    return {
      success: result?.success ?? true,
      wallpaperId: typeof result?.wallpaperId === 'number' ? result.wallpaperId : -1,
    };
  } catch (error) {
    throw toWallpaperError(error);
  }
}

/**
 * Whether the device hardware/software supports wallpapers.
 * Returns `false` on platforms other than Android.
 */
export async function isWallpaperSupported(): Promise<boolean> {
  if (!isAndroid()) {
    return false;
  }

  try {
    return (await native().isWallpaperSupported()) === true;
  } catch (error) {
    throw toWallpaperError(error);
  }
}

/**
 * Whether device policy currently allows changing the wallpaper.
 * Returns `false` on platforms other than Android.
 */
export async function isSetWallpaperAllowed(): Promise<boolean> {
  if (!isAndroid()) {
    return false;
  }

  try {
    return (await native().isSetWallpaperAllowed()) === true;
  } catch (error) {
    throw toWallpaperError(error);
  }
}

/**
 * Returns Android's wallpaper id for the given screen, or `-1` when the id is
 * not available.
 */
export async function getWallpaperId(target: WallpaperScreen = 'home'): Promise<number> {
  try {
    assertAndroid();
    const screen = normalizeScreen(target);
    return await native().getWallpaperId(screen);
  } catch (error) {
    throw toWallpaperError(error);
  }
}

/**
 * Sets the image used by the bundled live wallpaper.
 *
 * This does **not** activate the live wallpaper. Android requires the user to
 * confirm it in the system picker; call {@link openLiveWallpaperPicker} after
 * configuring the image.
 *
 * The image is copied into app storage, so the original file can be deleted
 * afterwards. Limits: 50 MB compressed, 32 megapixels decoded.
 */
export async function setLiveWallpaperImage(
  options: SetLiveWallpaperImageOptions
): Promise<void> {
  try {
    assertAndroid();
    const normalized = normalizeSetLiveWallpaperImageOptions(options);
    await native().setLiveWallpaperImage(normalized.uri, normalized.motion);
  } catch (error) {
    throw toWallpaperError(error);
  }
}

/**
 * Removes the configured live wallpaper image. The bundled service falls back
 * to an animated gradient. The live wallpaper itself stays active.
 */
export async function clearLiveWallpaperImage(): Promise<void> {
  try {
    assertAndroid();
    await native().clearLiveWallpaperImage();
  } catch (error) {
    throw toWallpaperError(error);
  }
}

/**
 * Whether the device supports live wallpapers and exposes the bundled
 * `WallpaperService`. Returns `false` on platforms other than Android.
 */
export async function isLiveWallpaperSupported(): Promise<boolean> {
  if (!isAndroid()) {
    return false;
  }

  try {
    return (await native().isLiveWallpaperSupported()) === true;
  } catch (error) {
    throw toWallpaperError(error);
  }
}

/**
 * Returns the active live wallpaper, or `null` when a static wallpaper is in
 * use (or the platform is not Android).
 */
export async function getCurrentLiveWallpaper(): Promise<LiveWallpaperInfo | null> {
  if (!isAndroid()) {
    return null;
  }

  try {
    const info = await native().getCurrentLiveWallpaper();
    if (!info) {
      return null;
    }

    return {
      packageName: typeof info.packageName === 'string' ? info.packageName : '',
      className: typeof info.className === 'string' ? info.className : '',
      isOurs: info.isOurs === true,
    };
  } catch (error) {
    throw toWallpaperError(error);
  }
}

/**
 * Opens the system live wallpaper preview for the bundled service.
 *
 * Resolves as soon as the picker activity starts. Android provides no result
 * for this flow, so the user may cancel; check {@link getCurrentLiveWallpaper}
 * (for example on `AppState` becoming active) to see whether it was applied.
 */
export async function openLiveWallpaperPicker(): Promise<void> {
  try {
    assertAndroid();
    await native().openLiveWallpaperPicker();
  } catch (error) {
    throw toWallpaperError(error);
  }
}

/**
 * Configures the bundled live wallpaper to play a video.
 *
 * This does **not** activate the live wallpaper. Android requires the user to
 * confirm it in the system picker; use {@link applyLiveWallpaperVideo} to
 * configure and open the picker in one call.
 */
export async function setLiveWallpaperVideo(
  options: SetLiveWallpaperVideoOptions
): Promise<void> {
  try {
    assertAndroid();
    const normalized = normalizeSetLiveWallpaperVideoOptions(options);
    await native().setLiveWallpaperVideo(
      normalized.uri,
      normalized.loop,
      normalized.muted,
      normalized.speed,
      normalized.scaling
    );
  } catch (error) {
    throw toWallpaperError(error);
  }
}

/** Removes any configured live wallpaper media (image or video). */
export async function clearLiveWallpaper(): Promise<void> {
  try {
    assertAndroid();
    await native().clearLiveWallpaper();
  } catch (error) {
    throw toWallpaperError(error);
  }
}

/**
 * Clears the static wallpaper, restoring the system default.
 *
 * Defaults to `'both'`. Clearing only one screen requires Android 9+; older
 * devices throw `E_UNSUPPORTED_API_LEVEL` when asked for a single screen.
 */
export async function clearWallpaper(target: WallpaperTarget = 'both'): Promise<void> {
  try {
    assertAndroid();
    const normalized = normalizeClearTarget(target);
    await native().clearWallpaper(normalized);
  } catch (error) {
    throw toWallpaperError(error);
  }
}

function capabilityNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === 'string' ? Number(value) : value;
  return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : fallback;
}

/**
 * Returns a device capability snapshot used to gate UI.
 * Resolves to a conservative snapshot on non-Android platforms.
 */
export async function getWallpaperCapabilities(): Promise<WallpaperCapabilities> {
  if (!isAndroid()) {
    return {
      apiLevel: 0,
      staticWallpapers: false,
      wallpaperSettingAllowed: false,
      liveWallpapers: false,
      liveWallpaperPicker: false,
      videoLiveWallpapers: false,
      lockScreenWallpapers: false,
      maxImageBytes: 0,
      maxImagePixels: 0,
      maxVideoBytes: 0,
      minVideoSpeed: 0.25,
      maxVideoSpeed: 3,
    };
  }

  try {
    const raw = await native().getWallpaperCapabilities();
    return {
      apiLevel: capabilityNumber(raw?.apiLevel, 0),
      staticWallpapers: raw?.staticWallpapers === true,
      wallpaperSettingAllowed: raw?.wallpaperSettingAllowed === true,
      liveWallpapers: raw?.liveWallpapers === true,
      liveWallpaperPicker: raw?.liveWallpaperPicker === true,
      videoLiveWallpapers: raw?.videoLiveWallpapers === true,
      lockScreenWallpapers: raw?.lockScreenWallpapers === true,
      maxImageBytes: capabilityNumber(raw?.maxImageBytes, 0),
      maxImagePixels: capabilityNumber(raw?.maxImagePixels, 0),
      maxVideoBytes: capabilityNumber(raw?.maxVideoBytes, 0),
      minVideoSpeed: capabilityNumber(raw?.minVideoSpeed, 0.25),
      maxVideoSpeed: capabilityNumber(raw?.maxVideoSpeed, 3),
    };
  } catch (error) {
    throw toWallpaperError(error);
  }
}

/** Configures an image, then opens the system picker for confirmation. */
export async function applyLiveWallpaperImage(
  options: SetLiveWallpaperImageOptions
): Promise<LiveWallpaperApplyResult> {
  await setLiveWallpaperImage(options);
  await openLiveWallpaperPicker();
  return { requiresConfirmation: true };
}

/** Configures a video, then opens the system picker for confirmation. */
export async function applyLiveWallpaperVideo(
  options: SetLiveWallpaperVideoOptions
): Promise<LiveWallpaperApplyResult> {
  await setLiveWallpaperVideo(options);
  await openLiveWallpaperPicker();
  return { requiresConfirmation: true };
}

/** One-shot snapshot of wallpaper ids, type and active live wallpaper. */
export async function getWallpaperInfo(): Promise<WallpaperInfoSummary> {
  const [homeId, lockId, live] = await Promise.all([
    getWallpaperId('home').catch(() => -1),
    getWallpaperId('lock').catch(() => -1),
    getCurrentLiveWallpaper().catch(() => null),
  ]);

  return {
    homeId,
    lockId,
    live,
    type: live ? 'live' : 'static',
  };
}
