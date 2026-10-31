export {
  getWallpaperId,
  isSetWallpaperAllowed,
  isWallpaperSupported,
  setWallpaper,
} from './WallpaperModule';

export { WALLPAPER_ERROR_CODES, WallpaperError, isWallpaperError } from './errors';
export type { WallpaperErrorCode, WallpaperErrorOptions } from './errors';

export type {
  SetWallpaperOptions,
  SetWallpaperResult,
  WallpaperCrop,
  WallpaperScreen,
  WallpaperTarget,
} from './Wallpaper.types';
