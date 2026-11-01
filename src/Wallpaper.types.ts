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

/**
 * Animation used by the bundled live wallpaper.
 * - `'pan'` slowly zooms/pans the image (default).
 * - `'none'` keeps the image static, which is easier on the battery.
 */
export type LiveWallpaperMotion = 'pan' | 'none';

export interface SetLiveWallpaperImageOptions {
  /**
   * Image used by the bundled live wallpaper. Supports the same sources as
   * `setWallpaper()`: `file://`, `content://`, `http(s)://` or an absolute path.
   *
   * The image is copied into the app's private storage, so the original file
   * may be deleted afterwards.
   */
  uri: string;

  /** Defaults to `'pan'`. */
  motion?: LiveWallpaperMotion;
}

/** The live wallpaper currently active on the device. */
export interface LiveWallpaperInfo {
  /** Package that owns the active live wallpaper. */
  packageName: string;
  /** Service class implementing the active live wallpaper. */
  className: string;
  /** `true` when the active live wallpaper is the one bundled with this module. */
  isOurs: boolean;
}

/** How the video is fitted to the wallpaper surface. */
export type VideoScaling = 'fill' | 'fit' | 'crop';

export interface SetLiveWallpaperVideoOptions {
  /**
   * Video used by the bundled live wallpaper. Supports `file://`,
   * `content://`, `http(s)://` or an absolute path.
   *
   * The video is copied into the app's private storage, so the original file
   * may be deleted afterwards. Limits: 200 MB.
   */
  uri: string;

  /** Loop playback. Defaults to `true`. */
  loop?: boolean;

  /** Mute audio. Defaults to `true`. */
  muted?: boolean;

  /** Playback speed between 0.25 and 3. Defaults to `1`. */
  speed?: number;

  /**
   * `'crop'` (default) fills the screen and crops overflow,
   * `'fit'` shows the whole frame with letterboxing,
   * `'fill'` stretches to the screen.
   */
  scaling?: VideoScaling;
}

export interface LiveWallpaperApplyResult {
  /**
   * Android requires the user to confirm a live wallpaper in the system
   * picker. When this is `true`, the picker was opened; re-check with
   * `getCurrentLiveWallpaper()` afterwards.
   */
  requiresConfirmation: true;
}

/** Device and package capability snapshot. */
export interface WallpaperCapabilities {
  apiLevel: number;
  staticWallpapers: boolean;
  wallpaperSettingAllowed: boolean;
  liveWallpapers: boolean;
  liveWallpaperPicker: boolean;
  videoLiveWallpapers: boolean;
  lockScreenWallpapers: boolean;
  maxImageBytes: number;
  maxImagePixels: number;
  maxVideoBytes: number;
  minVideoSpeed: number;
  maxVideoSpeed: number;
}

/** One-shot wallpaper state for the active screens. */
export interface WallpaperInfoSummary {
  homeId: number;
  lockId: number;
  live: LiveWallpaperInfo | null;
  type: 'static' | 'live';
}
