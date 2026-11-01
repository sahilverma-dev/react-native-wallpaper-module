import {
  applyLiveWallpaperImage,
  applyLiveWallpaperVideo,
  clearLiveWallpaper,
  clearWallpaper,
  getCurrentLiveWallpaper,
  getWallpaperCapabilities,
  getWallpaperId,
  getWallpaperInfo,
  isLiveWallpaperSupported,
  isSetWallpaperAllowed,
  isWallpaperSupported,
  openLiveWallpaperPicker,
  setLiveWallpaperImage,
  setLiveWallpaperVideo,
  setWallpaper,
} from './WallpaperModule';

/**
 * Namespaced entry point.
 *
 * ```ts
 * import Wallpaper from '@sahilverma-dev/wallpaper-module';
 * await Wallpaper.static.set({ uri });
 * await Wallpaper.live.applyVideo({ uri, loop: true });
 * ```
 *
 * The flat named exports remain available for existing code.
 */
export const Wallpaper = {
  static: {
    set: setWallpaper,
    clear: clearWallpaper,
    isSupported: isWallpaperSupported,
    isAllowed: isSetWallpaperAllowed,
    getId: getWallpaperId,
  },
  live: {
    setImage: setLiveWallpaperImage,
    setVideo: setLiveWallpaperVideo,
    applyImage: applyLiveWallpaperImage,
    applyVideo: applyLiveWallpaperVideo,
    clear: clearLiveWallpaper,
    isSupported: isLiveWallpaperSupported,
    getCurrent: getCurrentLiveWallpaper,
    openPicker: openLiveWallpaperPicker,
    preview: openLiveWallpaperPicker,
  },
  info: {
    get: getWallpaperInfo,
    getId: getWallpaperId,
  },
  device: {
    getCapabilities: getWallpaperCapabilities,
  },
  system: {
    openLiveWallpaperPicker,
  },
} as const;

export default Wallpaper;
