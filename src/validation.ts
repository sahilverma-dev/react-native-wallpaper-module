import type {
  LiveWallpaperMotion,
  SetLiveWallpaperImageOptions,
  SetLiveWallpaperVideoOptions,
  SetWallpaperOptions,
  VideoScaling,
  WallpaperCrop,
  WallpaperScreen,
  WallpaperTarget,
} from './Wallpaper.types';
import { WallpaperError } from './errors';

const TARGETS: readonly string[] = ['home', 'lock', 'both'];
const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i;
const SUPPORTED_SCHEMES = new Set(['file', 'content', 'http', 'https']);

export interface NormalizedSetWallpaperOptions {
  uri: string;
  target: WallpaperTarget;
  allowBackup: boolean;
  crop: WallpaperCrop | null;
}

/**
 * Validates and normalizes an image URI.
 * Rejects base64 data URIs early instead of sending megabytes over the bridge.
 */
export function normalizeUri(value: unknown): string {
  if (typeof value !== 'string') {
    throw new WallpaperError('E_INVALID_URI', '`uri` must be a string.');
  }

  const uri = value.trim();
  if (uri.length === 0) {
    throw new WallpaperError('E_INVALID_URI', '`uri` must not be empty.');
  }

  const scheme = SCHEME_PATTERN.exec(uri)?.[1]?.toLowerCase();

  if (scheme) {
    if (!SUPPORTED_SCHEMES.has(scheme)) {
      const hint =
        scheme === 'data'
          ? ' Base64 data URIs are not supported; save the image to a file and pass its `file://` URI.'
          : '';
      throw new WallpaperError(
        'E_INVALID_URI',
        `Unsupported URI scheme "${scheme}:". Use "file://", "content://", "http://" or "https://".${hint}`
      );
    }
    return uri;
  }

  // Bare absolute paths are convenient when a picker returns a path without a
  // scheme. Anything else is ambiguous and rejected.
  if (uri.startsWith('/')) {
    return uri;
  }

  throw new WallpaperError(
    'E_INVALID_URI',
    `Invalid image URI "${uri}". It must be an absolute path or use "file://", "content://", "http://" or "https://".`
  );
}

export function normalizeTarget(
  value: unknown,
  fallback: WallpaperTarget = 'home'
): WallpaperTarget {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'string' && TARGETS.includes(value)) {
    return value as WallpaperTarget;
  }
  throw new WallpaperError(
    'E_UNSUPPORTED_TARGET',
    `Invalid wallpaper target ${JSON.stringify(value)}. Expected "home", "lock" or "both".`
  );
}

export function normalizeScreen(
  value: unknown,
  fallback: WallpaperScreen = 'home'
): WallpaperScreen {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (value === 'home' || value === 'lock') {
    return value;
  }
  if (value === 'both') {
    throw new WallpaperError(
      'E_UNSUPPORTED_TARGET',
      '`getWallpaperId` accepts "home" or "lock", not "both".'
    );
  }
  throw new WallpaperError(
    'E_UNSUPPORTED_TARGET',
    `Invalid wallpaper target ${JSON.stringify(value)}. Expected "home" or "lock".`
  );
}

export function normalizeAllowBackup(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value !== 'boolean') {
    throw new WallpaperError('E_INVALID_ARGUMENT', '`allowBackup` must be a boolean.');
  }
  return value;
}

function toFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new WallpaperError(
      'E_INVALID_ARGUMENT',
      `\`crop.${name}\` must be a finite number.`
    );
  }
  return value;
}

export function normalizeCrop(value: unknown): WallpaperCrop | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new WallpaperError(
      'E_INVALID_ARGUMENT',
      '`crop` must be an object with `x`, `y`, `width` and `height` numbers.'
    );
  }

  const input = value as Record<string, unknown>;
  const x = toFiniteNumber(input['x'], 'x');
  const y = toFiniteNumber(input['y'], 'y');
  const width = toFiniteNumber(input['width'], 'width');
  const height = toFiniteNumber(input['height'], 'height');

  if (x < 0 || y < 0) {
    throw new WallpaperError('E_INVALID_ARGUMENT', '`crop.x` and `crop.y` must be 0 or greater.');
  }
  if (width <= 0 || height <= 0) {
    throw new WallpaperError(
      'E_INVALID_ARGUMENT',
      '`crop.width` and `crop.height` must be greater than 0.'
    );
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

export function normalizeSetWallpaperOptions(
  options: SetWallpaperOptions
): NormalizedSetWallpaperOptions {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new WallpaperError(
      'E_INVALID_ARGUMENT',
      '`setWallpaper` expects an object with a `uri` string.'
    );
  }

  return {
    uri: normalizeUri(options.uri),
    target: normalizeTarget(options.target),
    allowBackup: normalizeAllowBackup(options.allowBackup),
    crop: normalizeCrop(options.crop),
  };
}

export function normalizeMotion(value: unknown): LiveWallpaperMotion {
  if (value === undefined || value === null) {
    return 'pan';
  }
  if (value === 'pan' || value === 'none') {
    return value;
  }
  throw new WallpaperError('E_INVALID_ARGUMENT', '`motion` must be "pan" or "none".');
}

export interface NormalizedSetLiveWallpaperImageOptions {
  uri: string;
  motion: LiveWallpaperMotion;
}

export function normalizeSetLiveWallpaperImageOptions(
  options: SetLiveWallpaperImageOptions
): NormalizedSetLiveWallpaperImageOptions {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new WallpaperError(
      'E_INVALID_ARGUMENT',
      '`setLiveWallpaperImage` expects an object with a `uri` string.'
    );
  }

  return {
    uri: normalizeUri(options.uri),
    motion: normalizeMotion(options.motion),
  };
}

export const MIN_VIDEO_SPEED = 0.25;
export const MAX_VIDEO_SPEED = 3;

export function normalizeLoop(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value !== 'boolean') {
    throw new WallpaperError('E_INVALID_ARGUMENT', '`loop` must be a boolean.');
  }
  return value;
}

export function normalizeMuted(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value !== 'boolean') {
    throw new WallpaperError('E_INVALID_ARGUMENT', '`muted` must be a boolean.');
  }
  return value;
}

export function normalizeSpeed(value: unknown): number {
  if (value === undefined || value === null) {
    return 1;
  }
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < MIN_VIDEO_SPEED ||
    value > MAX_VIDEO_SPEED
  ) {
    throw new WallpaperError(
      'E_INVALID_ARGUMENT',
      `\`speed\` must be a number between ${MIN_VIDEO_SPEED} and ${MAX_VIDEO_SPEED}.`
    );
  }
  return value;
}

export function normalizeScaling(value: unknown): VideoScaling {
  if (value === undefined || value === null) {
    return 'crop';
  }
  if (value === 'fill' || value === 'fit' || value === 'crop') {
    return value;
  }
  throw new WallpaperError(
    'E_INVALID_ARGUMENT',
    '`scaling` must be "fill", "fit" or "crop".'
  );
}

export function normalizeClearTarget(value: unknown): WallpaperTarget {
  if (value === undefined || value === null) {
    return 'both';
  }
  if (typeof value === 'string' && TARGETS.includes(value)) {
    return value as WallpaperTarget;
  }
  throw new WallpaperError(
    'E_UNSUPPORTED_TARGET',
    `Invalid wallpaper target ${JSON.stringify(value)}. Expected "home", "lock" or "both".`
  );
}

export interface NormalizedSetLiveWallpaperVideoOptions {
  uri: string;
  loop: boolean;
  muted: boolean;
  speed: number;
  scaling: VideoScaling;
}

export function normalizeSetLiveWallpaperVideoOptions(
  options: SetLiveWallpaperVideoOptions
): NormalizedSetLiveWallpaperVideoOptions {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new WallpaperError(
      'E_INVALID_ARGUMENT',
      '`setLiveWallpaperVideo` expects an object with a `uri` string.'
    );
  }

  return {
    uri: normalizeUri(options.uri),
    loop: normalizeLoop(options.loop),
    muted: normalizeMuted(options.muted),
    speed: normalizeSpeed(options.speed),
    scaling: normalizeScaling(options.scaling),
  };
}
