import {
  WALLPAPER_ERROR_CODES,
  WallpaperError,
  isWallpaperError,
  toWallpaperError,
} from '../errors';

describe('WallpaperError', () => {
  it('keeps its code, message and name', () => {
    const error = new WallpaperError('E_INVALID_URI', 'Bad URI');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('WallpaperError');
    expect(error.code).toBe('E_INVALID_URI');
    expect(error.message).toBe('Bad URI');
  });

  it('stores the native cause', () => {
    const cause = new Error('native');
    const error = new WallpaperError('E_WALLPAPER_FAILED', 'Failed', { cause });

    expect(error.cause).toBe(cause);
  });
});

describe('isWallpaperError', () => {
  it('recognizes package instances', () => {
    expect(isWallpaperError(new WallpaperError('E_INVALID_URI', 'x'))).toBe(true);
  });

  it('recognizes structurally identical errors from another package copy', () => {
    const duplicate = Object.assign(new Error('x'), {
      name: 'WallpaperError',
      code: 'E_IMAGE_NOT_FOUND',
    });

    expect(isWallpaperError(duplicate)).toBe(true);
  });

  it('rejects unknown codes and plain values', () => {
    expect(isWallpaperError(Object.assign(new Error('x'), { name: 'WallpaperError' }))).toBe(false);
    expect(
      isWallpaperError(Object.assign(new Error('x'), { name: 'WallpaperError', code: 'E_NOPE' }))
    ).toBe(false);
    expect(isWallpaperError(null)).toBe(false);
    expect(isWallpaperError('E_INVALID_URI')).toBe(false);
  });
});

describe('toWallpaperError', () => {
  it('returns WallpaperError instances untouched', () => {
    const error = new WallpaperError('E_INVALID_URI', 'x');
    expect(toWallpaperError(error)).toBe(error);
  });

  it('preserves a known native code', () => {
    const native = Object.assign(new Error('No permission'), { code: 'E_WALLPAPER_NOT_ALLOWED' });
    const error = toWallpaperError(native);

    expect(error).toBeInstanceOf(WallpaperError);
    expect(error.code).toBe('E_WALLPAPER_NOT_ALLOWED');
    expect(error.message).toBe('No permission');
    expect(error.cause).toBe(native);
  });

  it('maps unknown native codes to E_WALLPAPER_FAILED', () => {
    expect(toWallpaperError(Object.assign(new Error('x'), { code: 'ERR_NEW' })).code).toBe(
      'E_WALLPAPER_FAILED'
    );
  });

  it('handles non-Error rejections', () => {
    const error = toWallpaperError('Something broke');

    expect(error.code).toBe('E_WALLPAPER_FAILED');
    expect(error.message).toBe('Something broke');
  });

  it('falls back to a readable message', () => {
    expect(toWallpaperError(undefined).message).toBe('The wallpaper could not be updated.');
  });
});

describe('WALLPAPER_ERROR_CODES', () => {
  it('matches the documented native codes', () => {
    expect(WALLPAPER_ERROR_CODES).toEqual([
      'E_INVALID_URI',
      'E_IMAGE_NOT_FOUND',
      'E_DOWNLOAD_FAILED',
      'E_UNSUPPORTED_FORMAT',
      'E_IMAGE_TOO_LARGE',
      'E_WALLPAPER_NOT_ALLOWED',
      'E_WALLPAPER_FAILED',
      'E_UNSUPPORTED_TARGET',
      'E_UNSUPPORTED_PLATFORM',
      'E_INVALID_ARGUMENT',
      'E_LIVE_WALLPAPER_UNAVAILABLE',
    ]);
  });
});
