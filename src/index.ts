export {
  applyLiveWallpaperImage,
  applyLiveWallpaperVideo,
  clearLiveWallpaper,
  clearLiveWallpaperImage,
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

export { WALLPAPER_ERROR_CODES, WallpaperError, isWallpaperError } from './errors';
export type { WallpaperErrorCode, WallpaperErrorOptions } from './errors';

export { Wallpaper } from './Wallpaper';
export { default } from './Wallpaper';

export type {
  LiveWallpaperApplyResult,
  LiveWallpaperInfo,
  LiveWallpaperMotion,
  SetLiveWallpaperImageOptions,
  SetLiveWallpaperVideoOptions,
  SetWallpaperOptions,
  SetWallpaperResult,
  VideoScaling,
  WallpaperCapabilities,
  WallpaperCrop,
  WallpaperInfoSummary,
  WallpaperScreen,
  WallpaperTarget,
} from './Wallpaper.types';
