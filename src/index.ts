export {
  clearLiveWallpaperImage,
  getCurrentLiveWallpaper,
  getWallpaperId,
  isLiveWallpaperSupported,
  isSetWallpaperAllowed,
  isWallpaperSupported,
  openLiveWallpaperPicker,
  setLiveWallpaperImage,
  setWallpaper,
} from './WallpaperModule';

export { WALLPAPER_ERROR_CODES, WallpaperError, isWallpaperError } from './errors';
export type { WallpaperErrorCode, WallpaperErrorOptions } from './errors';

export type {
  LiveWallpaperInfo,
  LiveWallpaperMotion,
  SetLiveWallpaperImageOptions,
  SetWallpaperOptions,
  SetWallpaperResult,
  WallpaperCrop,
  WallpaperScreen,
  WallpaperTarget,
} from './Wallpaper.types';
