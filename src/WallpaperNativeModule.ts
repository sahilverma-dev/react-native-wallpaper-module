import { NativeModule, requireNativeModule } from 'expo';

import type {
  LiveWallpaperInfo,
  LiveWallpaperMotion,
  SetWallpaperResult,
  VideoScaling,
  WallpaperCapabilities,
  WallpaperCrop,
  WallpaperScreen,
  WallpaperTarget,
} from './Wallpaper.types';

/**
 * Typed surface of the Kotlin module. Everything here is bridged by the Expo
 * Modules API, so no manual TurboModule or legacy bridge code is required.
 */
export declare class WallpaperNativeModule extends NativeModule<Record<string, never>> {
  setWallpaper(
    uri: string,
    target: WallpaperTarget,
    allowBackup: boolean,
    crop: WallpaperCrop | null
  ): Promise<SetWallpaperResult>;

  isWallpaperSupported(): Promise<boolean>;

  isSetWallpaperAllowed(): Promise<boolean>;

  getWallpaperId(target: WallpaperScreen): Promise<number>;

  isLiveWallpaperSupported(): Promise<boolean>;

  getCurrentLiveWallpaper(): Promise<LiveWallpaperInfo | null>;

  setLiveWallpaperImage(uri: string, motion: LiveWallpaperMotion): Promise<void>;

  setLiveWallpaperVideo(
    uri: string,
    loop: boolean,
    muted: boolean,
    speed: number,
    scaling: VideoScaling
  ): Promise<void>;

  clearLiveWallpaper(): Promise<void>;

  clearWallpaper(target: WallpaperTarget): Promise<void>;

  getWallpaperCapabilities(): Promise<WallpaperCapabilities>;

  clearLiveWallpaperImage(): Promise<void>;

  openLiveWallpaperPicker(): Promise<void>;
}

let nativeModule: WallpaperNativeModule | undefined;

/**
 * Loads the native module lazily so that importing this package on iOS or web
 * does not throw. The public API guards the platform before calling in.
 */
export function getWallpaperNativeModule(): WallpaperNativeModule {
  if (!nativeModule) {
    nativeModule = requireNativeModule<WallpaperNativeModule>('Wallpaper');
  }
  return nativeModule;
}

/** @internal Used by the test suite to inject a fake bridge. */
export function setWallpaperNativeModule(
  module: WallpaperNativeModule | undefined
): void {
  nativeModule = module;
}
