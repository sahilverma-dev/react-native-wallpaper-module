import { requireNativeModule } from 'expo';
import { Platform } from 'react-native';

import { Wallpaper } from '../Wallpaper';
import {
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
} from '../WallpaperModule';
import { setWallpaperNativeModule } from '../WallpaperNativeModule';
import { WallpaperError, isWallpaperError } from '../errors';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo', () => ({ requireNativeModule: jest.fn() }));

const nativeSetWallpaper = jest.fn();
const nativeIsWallpaperSupported = jest.fn();
const nativeIsSetWallpaperAllowed = jest.fn();
const nativeGetWallpaperId = jest.fn();
const nativeIsLiveWallpaperSupported = jest.fn();
const nativeGetCurrentLiveWallpaper = jest.fn();
const nativeSetLiveWallpaperImage = jest.fn();
const nativeSetLiveWallpaperVideo = jest.fn();
const nativeClearLiveWallpaper = jest.fn();
const nativeClearLiveWallpaperImage = jest.fn();
const nativeClearWallpaper = jest.fn();
const nativeGetWallpaperCapabilities = jest.fn();
const nativeOpenLiveWallpaperPicker = jest.fn();

const bridge = {
  setWallpaper: nativeSetWallpaper,
  isWallpaperSupported: nativeIsWallpaperSupported,
  isSetWallpaperAllowed: nativeIsSetWallpaperAllowed,
  getWallpaperId: nativeGetWallpaperId,
  isLiveWallpaperSupported: nativeIsLiveWallpaperSupported,
  getCurrentLiveWallpaper: nativeGetCurrentLiveWallpaper,
  setLiveWallpaperImage: nativeSetLiveWallpaperImage,
  setLiveWallpaperVideo: nativeSetLiveWallpaperVideo,
  clearLiveWallpaper: nativeClearLiveWallpaper,
  clearLiveWallpaperImage: nativeClearLiveWallpaperImage,
  clearWallpaper: nativeClearWallpaper,
  getWallpaperCapabilities: nativeGetWallpaperCapabilities,
  openLiveWallpaperPicker: nativeOpenLiveWallpaperPicker,
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
  nativeIsLiveWallpaperSupported.mockResolvedValue(true);
  nativeGetCurrentLiveWallpaper.mockResolvedValue(null);
  nativeSetLiveWallpaperImage.mockResolvedValue(undefined);
  nativeSetLiveWallpaperVideo.mockResolvedValue(undefined);
  nativeClearLiveWallpaper.mockResolvedValue(undefined);
  nativeClearLiveWallpaperImage.mockResolvedValue(undefined);
  nativeClearWallpaper.mockResolvedValue(undefined);
  nativeGetWallpaperCapabilities.mockResolvedValue({
    apiLevel: 33,
    staticWallpapers: true,
    wallpaperSettingAllowed: true,
    liveWallpapers: true,
    liveWallpaperPicker: true,
    videoLiveWallpapers: true,
    lockScreenWallpapers: true,
    maxImageBytes: 52428800,
    maxImagePixels: 32000000,
    maxVideoBytes: 209715200,
    minVideoSpeed: 0.25,
    maxVideoSpeed: 3,
  });
  nativeOpenLiveWallpaperPicker.mockResolvedValue(undefined);

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

describe('live wallpapers', () => {
  it('configures the image with the default pan motion', async () => {
    await setLiveWallpaperImage({ uri: 'file:///tmp/live.jpg' });

    expect(nativeSetLiveWallpaperImage).toHaveBeenCalledWith('file:///tmp/live.jpg', 'pan');
  });

  it('forwards the static motion option', async () => {
    await setLiveWallpaperImage({ uri: 'content://media/external/images/9', motion: 'none' });

    expect(nativeSetLiveWallpaperImage).toHaveBeenCalledWith(
      'content://media/external/images/9',
      'none'
    );
  });

  it.each([
    [null, 'E_INVALID_ARGUMENT'],
    [{}, 'E_INVALID_URI'],
    [{ uri: 'data:image/jpeg;base64,AA' }, 'E_INVALID_URI'],
    [{ uri: 'file:///a.jpg', motion: 'spin' }, 'E_INVALID_ARGUMENT'],
    [{ uri: 'file:///a.jpg', motion: 1 }, 'E_INVALID_ARGUMENT'],
  ])('rejects invalid live wallpaper options %j with %s', async (options, code) => {
    await expect(setLiveWallpaperImage(options as never)).rejects.toMatchObject({ code });
    expect(nativeSetLiveWallpaperImage).not.toHaveBeenCalled();
  });

  it('clears the configured image', async () => {
    await clearLiveWallpaperImage();

    expect(nativeClearLiveWallpaperImage).toHaveBeenCalledTimes(1);
  });

  it('reports support and the active live wallpaper', async () => {
    nativeGetCurrentLiveWallpaper.mockResolvedValueOnce({
      packageName: 'com.example.app',
      className: 'com.example.app.wallpaper.Service',
      isOurs: true,
    });

    await expect(isLiveWallpaperSupported()).resolves.toBe(true);
    await expect(getCurrentLiveWallpaper()).resolves.toEqual({
      packageName: 'com.example.app',
      className: 'com.example.app.wallpaper.Service',
      isOurs: true,
    });
  });

  it('returns null for static wallpapers', async () => {
    await expect(getCurrentLiveWallpaper()).resolves.toBeNull();
  });

  it('normalizes partial native live wallpaper info', async () => {
    nativeGetCurrentLiveWallpaper.mockResolvedValueOnce({});

    await expect(getCurrentLiveWallpaper()).resolves.toEqual({
      packageName: '',
      className: '',
      isOurs: false,
    });
  });

  it('opens the system picker', async () => {
    await openLiveWallpaperPicker();

    expect(nativeOpenLiveWallpaperPicker).toHaveBeenCalledTimes(1);
  });

  it('surfaces picker failures', async () => {
    nativeOpenLiveWallpaperPicker.mockRejectedValueOnce(
      Object.assign(new Error('No picker'), { code: 'E_LIVE_WALLPAPER_UNAVAILABLE' })
    );

    await expect(openLiveWallpaperPicker()).rejects.toMatchObject({
      code: 'E_LIVE_WALLPAPER_UNAVAILABLE',
      message: 'No picker',
    });
  });

  it('degrades safely on non-Android platforms', async () => {
    setPlatform('ios');

    await expect(isLiveWallpaperSupported()).resolves.toBe(false);
    await expect(getCurrentLiveWallpaper()).resolves.toBeNull();
    await expect(setLiveWallpaperImage({ uri: 'file:///a.jpg' })).rejects.toMatchObject({
      code: 'E_UNSUPPORTED_PLATFORM',
    });
    await expect(clearLiveWallpaperImage()).rejects.toMatchObject({
      code: 'E_UNSUPPORTED_PLATFORM',
    });
    await expect(openLiveWallpaperPicker()).rejects.toMatchObject({
      code: 'E_UNSUPPORTED_PLATFORM',
    });

    expect(nativeSetLiveWallpaperImage).not.toHaveBeenCalled();
    expect(nativeClearLiveWallpaperImage).not.toHaveBeenCalled();
    expect(nativeOpenLiveWallpaperPicker).not.toHaveBeenCalled();
  });
});

describe('video live wallpapers', () => {
  it('configures a video with defaults', async () => {
    await setLiveWallpaperVideo({ uri: 'file:///tmp/a.mp4' });

    expect(nativeSetLiveWallpaperVideo).toHaveBeenCalledWith(
      'file:///tmp/a.mp4',
      true,
      true,
      1,
      'crop'
    );
  });

  it('forwards playback options', async () => {
    await setLiveWallpaperVideo({
      uri: 'https://example.com/a.mp4',
      loop: false,
      muted: false,
      speed: 1.5,
      scaling: 'fit',
    });

    expect(nativeSetLiveWallpaperVideo).toHaveBeenCalledWith(
      'https://example.com/a.mp4',
      false,
      false,
      1.5,
      'fit'
    );
  });

  it.each([
    [null, 'E_INVALID_ARGUMENT'],
    [{}, 'E_INVALID_URI'],
    [{ uri: 'data:video/mp4;base64,AA' }, 'E_INVALID_URI'],
    [{ uri: 'file:///a.mp4', loop: 'yes' }, 'E_INVALID_ARGUMENT'],
    [{ uri: 'file:///a.mp4', muted: 1 }, 'E_INVALID_ARGUMENT'],
    [{ uri: 'file:///a.mp4', speed: 0.1 }, 'E_INVALID_ARGUMENT'],
    [{ uri: 'file:///a.mp4', speed: 4 }, 'E_INVALID_ARGUMENT'],
    [{ uri: 'file:///a.mp4', speed: Number.NaN }, 'E_INVALID_ARGUMENT'],
    [{ uri: 'file:///a.mp4', scaling: 'zoom' }, 'E_INVALID_ARGUMENT'],
  ])('rejects invalid video options %j with %s', async (options, code) => {
    await expect(setLiveWallpaperVideo(options as never)).rejects.toMatchObject({ code });
    expect(nativeSetLiveWallpaperVideo).not.toHaveBeenCalled();
  });

  it('configures and opens the picker in one call', async () => {
    await expect(
      applyLiveWallpaperVideo({ uri: 'file:///a.mp4', scaling: 'fill' })
    ).resolves.toEqual({ requiresConfirmation: true });

    expect(nativeSetLiveWallpaperVideo).toHaveBeenCalledWith(
      'file:///a.mp4',
      true,
      true,
      1,
      'fill'
    );
    expect(nativeOpenLiveWallpaperPicker).toHaveBeenCalledTimes(1);
  });

  it('does not open the picker when configuration fails', async () => {
    nativeSetLiveWallpaperVideo.mockRejectedValueOnce(
      Object.assign(new Error('Too big'), { code: 'E_IMAGE_TOO_LARGE' })
    );

    await expect(applyLiveWallpaperVideo({ uri: 'file:///a.mp4' })).rejects.toMatchObject({
      code: 'E_IMAGE_TOO_LARGE',
    });
    expect(nativeOpenLiveWallpaperPicker).not.toHaveBeenCalled();
  });

  it('configures and applies images through the same flow', async () => {
    await expect(applyLiveWallpaperImage({ uri: 'file:///a.jpg' })).resolves.toEqual({
      requiresConfirmation: true,
    });

    expect(nativeSetLiveWallpaperImage).toHaveBeenCalledWith('file:///a.jpg', 'pan');
    expect(nativeOpenLiveWallpaperPicker).toHaveBeenCalledTimes(1);
  });

  it('clears all live wallpaper media', async () => {
    await clearLiveWallpaper();

    expect(nativeClearLiveWallpaper).toHaveBeenCalledTimes(1);
  });
});

describe('clearWallpaper', () => {
  it('defaults to both screens', async () => {
    await clearWallpaper();

    expect(nativeClearWallpaper).toHaveBeenCalledWith('both');
  });

  it('forwards the target', async () => {
    await clearWallpaper('lock');

    expect(nativeClearWallpaper).toHaveBeenCalledWith('lock');
  });

  it('rejects invalid targets', async () => {
    await expect(clearWallpaper('desktop' as never)).rejects.toMatchObject({
      code: 'E_UNSUPPORTED_TARGET',
    });
    expect(nativeClearWallpaper).not.toHaveBeenCalled();
  });

  it('surfaces API-level errors', async () => {
    nativeClearWallpaper.mockRejectedValueOnce(
      Object.assign(new Error('Android 9 required'), { code: 'E_UNSUPPORTED_API_LEVEL' })
    );

    await expect(clearWallpaper('lock')).rejects.toMatchObject({
      code: 'E_UNSUPPORTED_API_LEVEL',
    });
  });
});

describe('getWallpaperCapabilities', () => {
  it('normalizes the native snapshot', async () => {
    await expect(getWallpaperCapabilities()).resolves.toEqual({
      apiLevel: 33,
      staticWallpapers: true,
      wallpaperSettingAllowed: true,
      liveWallpapers: true,
      liveWallpaperPicker: true,
      videoLiveWallpapers: true,
      lockScreenWallpapers: true,
      maxImageBytes: 52428800,
      maxImagePixels: 32000000,
      maxVideoBytes: 209715200,
      minVideoSpeed: 0.25,
      maxVideoSpeed: 3,
    });
  });

  it('coerces numeric strings from the bridge', async () => {
    nativeGetWallpaperCapabilities.mockResolvedValueOnce({
      apiLevel: '33',
      maxVideoBytes: '209715200',
    });

    await expect(getWallpaperCapabilities()).resolves.toMatchObject({
      apiLevel: 33,
      maxVideoBytes: 209715200,
      staticWallpapers: false,
    });
  });

  it('returns a conservative snapshot off Android', async () => {
    setPlatform('ios');

    await expect(getWallpaperCapabilities()).resolves.toMatchObject({
      apiLevel: 0,
      staticWallpapers: false,
      liveWallpapers: false,
      maxVideoBytes: 0,
    });
    expect(nativeGetWallpaperCapabilities).not.toHaveBeenCalled();
  });
});

describe('getWallpaperInfo', () => {
  it('reports an active live wallpaper', async () => {
    nativeGetWallpaperId.mockResolvedValueOnce(7).mockResolvedValueOnce(8);
    nativeGetCurrentLiveWallpaper.mockResolvedValueOnce({
      packageName: 'com.example',
      className: 'com.example.Service',
      isOurs: true,
    });

    await expect(getWallpaperInfo()).resolves.toEqual({
      homeId: 7,
      lockId: 8,
      live: {
        packageName: 'com.example',
        className: 'com.example.Service',
        isOurs: true,
      },
      type: 'live',
    });
  });

  it('reports static wallpapers', async () => {
    await expect(getWallpaperInfo()).resolves.toEqual({
      homeId: 3,
      lockId: 3,
      live: null,
      type: 'static',
    });
  });

  it('tolerates unreadable ids', async () => {
    nativeGetWallpaperId.mockRejectedValue(new Error('unavailable'));

    await expect(getWallpaperInfo()).resolves.toMatchObject({ homeId: -1, lockId: -1 });
  });
});

describe('namespaced API', () => {
  it('exposes the same functions as the flat exports', () => {
    expect(Wallpaper.static.set).toBe(setWallpaper);
    expect(Wallpaper.static.clear).toBe(clearWallpaper);
    expect(Wallpaper.static.isSupported).toBe(isWallpaperSupported);
    expect(Wallpaper.static.isAllowed).toBe(isSetWallpaperAllowed);
    expect(Wallpaper.static.getId).toBe(getWallpaperId);

    expect(Wallpaper.live.setImage).toBe(setLiveWallpaperImage);
    expect(Wallpaper.live.setVideo).toBe(setLiveWallpaperVideo);
    expect(Wallpaper.live.applyImage).toBe(applyLiveWallpaperImage);
    expect(Wallpaper.live.applyVideo).toBe(applyLiveWallpaperVideo);
    expect(Wallpaper.live.clear).toBe(clearLiveWallpaper);
    expect(Wallpaper.live.isSupported).toBe(isLiveWallpaperSupported);
    expect(Wallpaper.live.getCurrent).toBe(getCurrentLiveWallpaper);
    expect(Wallpaper.live.openPicker).toBe(openLiveWallpaperPicker);
    expect(Wallpaper.live.preview).toBe(openLiveWallpaperPicker);

    expect(Wallpaper.info.get).toBe(getWallpaperInfo);
    expect(Wallpaper.info.getId).toBe(getWallpaperId);
    expect(Wallpaper.device.getCapabilities).toBe(getWallpaperCapabilities);
    expect(Wallpaper.system.openLiveWallpaperPicker).toBe(openLiveWallpaperPicker);
  });
});
