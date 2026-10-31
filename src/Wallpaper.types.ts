/**
 * Public types for `@sahilverma-dev/wallpaper-module`.
 *
 * The API intentionally exposes readable string targets instead of Android's
 * integer `WallpaperManager` flags.
 */

/** Where a wallpaper should be applied. */
export type WallpaperTarget = 'home' | 'lock' | 'both';

/** A single wallpaper location that can be read back. */
export type WallpaperScreen = Exclude<WallpaperTarget, 'both'>;

/**
 * Optional source rectangle used to crop the image before it is applied.
 * Values are in pixels of the source image.
 */
export interface WallpaperCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SetWallpaperOptions {
  /**
   * Image to apply. Supported schemes:
   * - `file://` (for example a URI returned by `expo-image-picker`)
   * - `content://` (Android document providers)
   * - `http://` / `https://` (downloaded natively, no JS memory cost)
   *
   * Bare absolute paths such as `/storage/emulated/0/Download/image.jpg` are
   * treated as files as well.
   */
  uri: string;

  /**
   * Which screen to update. Defaults to `'home'`.
   *
   * On Android, some manufacturers do not support separate lock screen
   * wallpapers; in that case `'lock'` may update both screens or fail.
   */
  target?: WallpaperTarget;

  /**
   * Whether Android should keep a backup copy of the wallpaper so it can be
   * restored. Defaults to `true`.
   */
  allowBackup?: boolean;

  /**
   * Optional crop rectangle applied while the wallpaper is decoded.
   * The rectangle must fit inside the source image.
   */
  crop?: WallpaperCrop;
}

export interface SetWallpaperResult {
  /** `true` when Android accepted the wallpaper. */
  success: boolean;
  /**
   * The wallpaper id reported by Android after the update, or `-1` when the
   * device does not expose one.
   */
  wallpaperId: number;
}
