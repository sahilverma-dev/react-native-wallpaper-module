import { requireNativeModule } from 'expo';
import { Platform } from 'react-native';

import {
  getWallpaperId,
  isSetWallpaperAllowed,
  isWallpaperSupported,
  setWallpaper,
} from '../WallpaperModule';
import { setWallpaperNativeModule } from '../WallpaperNativeModule';
import { WallpaperError, isWallpaperError } from '../errors';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo', () => ({ requireNativeModule: jest.fn() }));

const nativeSetWallpaper = jest.fn();
const nativeIsWallpaperSupported = jest.fn();
const nativeIsSetWallpaperAllowed = jest.fn();
const nativeGetWallpaperId = jest.fn();

const bridge = {
  setWallpaper: nativeSetWallpaper,
  isWallpaperSupported: nativeIsWallpaperSupported,
  isSetWallpaperAllowed: nativeIsSetWallpaperAllowed,
  getWallpaperId: nativeGetWallpaperId,
};

function setPlatform(os: string) {
  (Platform as unknown as { OS: string }).OS = os;
}

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform('android');

  nativeSetWallpaper.mockResolvedValue({ success: true, wallpaperId: 12 });
  nativeIsWallpaperSupported.mockResolvedValue(true);
  nativeIsSetWallpaperAllowed.mockResolvedValue(true);
  nativeGetWallpaperId.mockResolvedValue(3);

  setWallpaperNativeModule(bridge as never);
});

afterEach(() => {
  setWallpaperNativeModule(undefined);
});

describe('setWallpaper', () => {
  it('defaults the target to home and allows backups', async () => {
    await expect(setWallpaper({ uri: 'file:///tmp/wallpaper.jpg' })).resolves.toEqual({
      success: true,
      wallpaperId: 12,
    });

    expect(nativeSetWallpaper).toHaveBeenCalledWith('file:///tmp/wallpaper.jpg', 'home', true, null);
  });

  it('forwards every target and trims the URI', async () => {
    await setWallpaper({ uri: '  content://media/external/images/1  ', target: 'lock' });
    await setWallpaper({ uri: 'https://example.com/a.png', target: 'both', allowBackup: false });

    expect(nativeSetWallpaper).toHaveBeenNthCalledWith(
      1,
      'content://media/external/images/1',
      'lock',
      true,
      null
    );
    expect(nativeSetWallpaper).toHaveBeenNthCalledWith(
      2,
      'https://example.com/a.png',
      'both',
      false,
      null
    );
  });

  it('forwards a validated crop rectangle', async () => {
    await setWallpaper({
      uri: 'file:///tmp/wallpaper.jpg',
      crop: { x: 10.4, y: 20.6, width: 100.5, height: 200 },
    });

    expect(nativeSetWallpaper).toHaveBeenCalledWith('file:///tmp/wallpaper.jpg', 'home', true, {
      x: 10,
      y: 21,
      width: 101,
      height: 200,
    });
  });

  it('normalizes a partial native result', async () => {
    nativeSetWallpaper.mockResolvedValueOnce({ success: true });

    await expect(setWallpaper({ uri: 'file:///tmp/a.jpg' })).resolves.toEqual({
      success: true,
      wallpaperId: -1,
    });
  });

  it.each([
    [{}, 'E_INVALID_URI'],
    [null, 'E_INVALID_ARGUMENT'],
    [{ uri: '' }, 'E_INVALID_URI'],
    [{ uri: '   ' }, 'E_INVALID_URI'],
    [{ uri: 42 }, 'E_INVALID_URI'],
    [{ uri: 'relative/path.jpg' }, 'E_INVALID_URI'],
    [{ uri: 'ftp://example.com/a.jpg' }, 'E_INVALID_URI'],
    [{ uri: 'data:image/png;base64,AAAA' }, 'E_INVALID_URI'],
    [{ uri: 'file:///a.jpg', target: 'desktop' }, 'E_UNSUPPORTED_TARGET'],
    [{ uri: 'file:///a.jpg', allowBackup: 'yes' }, 'E_INVALID_ARGUMENT'],
    [{ uri: 'file:///a.jpg', crop: { x: 0, y: 0, width: 0, height: 10 } }, 'E_INVALID_ARGUMENT'],
    [{ uri: 'file:///a.jpg', crop: { x: -1, y: 0, width: 10, height: 10 } }, 'E_INVALID_ARGUMENT'],
    [{ uri: 'file:///a.jpg', crop: { x: 0, y: 0, width: 10 } }, 'E_INVALID_ARGUMENT'],
  ])('rejects invalid options %j with %s', async (options, code) => {
    await expect(setWallpaper(options as never)).rejects.toMatchObject({
      name: 'WallpaperError',
      code,
    });
    expect(nativeSetWallpaper).not.toHaveBeenCalled();
  });

  it('preserves known native error codes', async () => {
    nativeSetWallpaper.mockRejectedValueOnce(
      Object.assign(new Error('Download failed'), { code: 'E_DOWNLOAD_FAILED' })
    );

    const error = await setWallpaper({ uri: 'https://example.com/a.jpg' }).catch((e) => e);

    expect(isWallpaperError(error)).toBe(true);
    expect(error).toBeInstanceOf(WallpaperError);
    expect(error.code).toBe('E_DOWNLOAD_FAILED');
    expect(error.message).toBe('Download failed');
  });

  it('maps unknown native failures to E_WALLPAPER_FAILED', async () => {
    nativeSetWallpaper.mockRejectedValueOnce(
      Object.assign(new Error('Boom'), { code: 'ERR_SOMETHING_NEW' })
    );

    await expect(setWallpaper({ uri: 'file:///a.jpg' })).rejects.toMatchObject({
      code: 'E_WALLPAPER_FAILED',
      message: 'Boom',
    });
  });

  it('rejects on non-Android platforms without touching the bridge', async () => {
    setPlatform('ios');

    await expect(setWallpaper({ uri: 'file:///a.jpg' })).rejects.toMatchObject({
      code: 'E_UNSUPPORTED_PLATFORM',
    });
    expect(nativeSetWallpaper).not.toHaveBeenCalled();
  });

  it('explains how to fix a missing native module', async () => {
    setWallpaperNativeModule(undefined);
    (requireNativeModule as jest.Mock).mockImplementation(() => {
      throw Object.assign(new Error('Cannot find native module Wallpaper'), {
        code: 'ERR_MODULE_NOT_FOUND',
      });
    });

    await expect(setWallpaper({ uri: 'file:///a.jpg' })).rejects.toMatchObject({
      code: 'E_WALLPAPER_FAILED',
      message: expect.stringContaining('development build'),
    });
  });
});

describe('capability checks', () => {
  it('returns the native support flags', async () => {
    await expect(isWallpaperSupported()).resolves.toBe(true);
    await expect(isSetWallpaperAllowed()).resolves.toBe(true);

    nativeIsWallpaperSupported.mockResolvedValueOnce(false);
    nativeIsSetWallpaperAllowed.mockResolvedValueOnce(false);

    await expect(isWallpaperSupported()).resolves.toBe(false);
    await expect(isSetWallpaperAllowed()).resolves.toBe(false);
  });

  it('returns false instead of throwing on other platforms', async () => {
    setPlatform('web');

    await expect(isWallpaperSupported()).resolves.toBe(false);
    await expect(isSetWallpaperAllowed()).resolves.toBe(false);
    expect(nativeIsWallpaperSupported).not.toHaveBeenCalled();
  });

  it('surfaces native capability errors', async () => {
    nativeIsWallpaperSupported.mockRejectedValueOnce(
      Object.assign(new Error('Broken'), { code: 'E_WALLPAPER_FAILED' })
    );

    await expect(isWallpaperSupported()).rejects.toMatchObject({ code: 'E_WALLPAPER_FAILED' });
  });
});

describe('getWallpaperId', () => {
  it('defaults to the home screen', async () => {
    await expect(getWallpaperId()).resolves.toBe(3);
    expect(nativeGetWallpaperId).toHaveBeenCalledWith('home');
  });

  it('reads the lock screen id', async () => {
    await getWallpaperId('lock');
    expect(nativeGetWallpaperId).toHaveBeenCalledWith('lock');
  });

  it('rejects "both" because Android ids are per screen', async () => {
    await expect(getWallpaperId('both' as never)).rejects.toMatchObject({
      code: 'E_UNSUPPORTED_TARGET',
    });
    expect(nativeGetWallpaperId).not.toHaveBeenCalled();
  });
});
