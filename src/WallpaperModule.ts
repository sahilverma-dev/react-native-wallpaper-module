import { Platform } from 'react-native';

import type {
  SetWallpaperOptions,
  SetWallpaperResult,
  WallpaperScreen,
} from './Wallpaper.types';
import { getWallpaperNativeModule, type WallpaperNativeModule } from './WallpaperNativeModule';
import { WallpaperError, toWallpaperError } from './errors';
import { normalizeScreen, normalizeSetWallpaperOptions } from './validation';

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
