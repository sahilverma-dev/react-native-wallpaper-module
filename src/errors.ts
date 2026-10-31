/**
 * Predictable, typed errors for the wallpaper module.
 *
 * Native code rejects with the same codes, so JavaScript can branch on
 * `error.code` regardless of where the failure happened.
 */

export const WALLPAPER_ERROR_CODES = [
  /** The URI is malformed or uses an unsupported scheme. */
  'E_INVALID_URI',
  /** The image does not exist or cannot be read. */
  'E_IMAGE_NOT_FOUND',
  /** A remote image could not be downloaded. */
  'E_DOWNLOAD_FAILED',
  /** The image is not a supported format (JPEG, PNG or WebP). */
  'E_UNSUPPORTED_FORMAT',
  /** Device policy or hardware does not allow changing the wallpaper. */
  'E_WALLPAPER_NOT_ALLOWED',
  /** Android failed to apply the wallpaper. */
  'E_WALLPAPER_FAILED',
  /** The requested wallpaper target is not valid. */
  'E_UNSUPPORTED_TARGET',
  /** The module was called on a platform other than Android. */
  'E_UNSUPPORTED_PLATFORM',
  /** An option passed from JavaScript is invalid. */
  'E_INVALID_ARGUMENT',
] as const;

export type WallpaperErrorCode = (typeof WALLPAPER_ERROR_CODES)[number];

const KNOWN_CODES: ReadonlySet<string> = new Set(WALLPAPER_ERROR_CODES);

export interface WallpaperErrorOptions {
  cause?: unknown;
}

/**
 * Error thrown (and rejected) by every public API.
 *
 * ```ts
 * try {
 *   await setWallpaper({ uri });
 * } catch (error) {
 *   if (isWallpaperError(error) && error.code === 'E_DOWNLOAD_FAILED') {
 *     // show a retry action
 *   }
 * }
 * ```
 */
export class WallpaperError extends Error {
  readonly code: WallpaperErrorCode;

  constructor(code: WallpaperErrorCode, message: string, options?: WallpaperErrorOptions) {
    super(message, options);
    this.name = 'WallpaperError';
    this.code = code;
  }
}

/**
 * Type guard that also works when two copies of this package are installed.
 */
export function isWallpaperError(value: unknown): value is WallpaperError {
  if (value instanceof WallpaperError) {
    return true;
  }

  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { name?: unknown; code?: unknown; message?: unknown };
  return (
    candidate.name === 'WallpaperError' &&
    typeof candidate.code === 'string' &&
    KNOWN_CODES.has(candidate.code) &&
    typeof candidate.message === 'string'
  );
}

function getErrorCode(error: unknown): unknown {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  return (error as { code?: unknown }).code;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string' && error.length > 0) {
    return error;
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return 'The wallpaper could not be updated.';
}

/**
 * Converts anything thrown by the native module into a `WallpaperError`.
 * Unknown native codes are mapped to `E_WALLPAPER_FAILED`.
 *
 * @internal
 */
export function toWallpaperError(error: unknown): WallpaperError {
  if (isWallpaperError(error)) {
    return error;
  }

  const nativeCode = getErrorCode(error);
  const code: WallpaperErrorCode =
    typeof nativeCode === 'string' && KNOWN_CODES.has(nativeCode)
      ? (nativeCode as WallpaperErrorCode)
      : 'E_WALLPAPER_FAILED';

  return new WallpaperError(code, getErrorMessage(error), { cause: error });
}
