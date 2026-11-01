import {
  normalizeAllowBackup,
  normalizeClearTarget,
  normalizeCrop,
  normalizeLoop,
  normalizeMotion,
  normalizeMuted,
  normalizeScaling,
  normalizeScreen,
  normalizeSetLiveWallpaperImageOptions,
  normalizeSetLiveWallpaperVideoOptions,
  normalizeSetWallpaperOptions,
  normalizeSpeed,
  normalizeTarget,
  normalizeUri,
} from '../validation';

describe('normalizeUri', () => {
  it('accepts every supported scheme', () => {
    expect(normalizeUri('file:///tmp/a.jpg')).toBe('file:///tmp/a.jpg');
    expect(normalizeUri('content://media/external/images/1')).toBe(
      'content://media/external/images/1'
    );
    expect(normalizeUri('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    expect(normalizeUri('http://example.com/a.jpg')).toBe('http://example.com/a.jpg');
    expect(normalizeUri('HTTPS://example.com/a.jpg')).toBe('HTTPS://example.com/a.jpg');
  });

  it('accepts bare absolute paths', () => {
    expect(normalizeUri('/storage/emulated/0/Download/a.jpg')).toBe(
      '/storage/emulated/0/Download/a.jpg'
    );
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeUri('  file:///tmp/a.jpg \n')).toBe('file:///tmp/a.jpg');
  });

  it.each([undefined, null, 12, '', '   ', 'a.jpg', './a.jpg', 'data:image/png;base64,AA'])(
    'rejects %j',
    (value) => {
      expect(() => normalizeUri(value)).toThrow(/uri|URI/);
    }
  );

  it('rejects base64 data URIs with an actionable hint', () => {
    expect(() => normalizeUri('data:image/png;base64,AA')).toThrow(/save the image to a file/i);
  });
});

describe('normalizeTarget', () => {
  it('defaults to home', () => {
    expect(normalizeTarget(undefined)).toBe('home');
    expect(normalizeTarget(null, 'lock')).toBe('lock');
  });

  it.each(['home', 'lock', 'both'])('accepts %s', (target) => {
    expect(normalizeTarget(target)).toBe(target);
  });

  it.each(['desktop', 'HOME', '', 1, true])('rejects %j', (target) => {
    expect(() => normalizeTarget(target)).toThrow(/Invalid wallpaper target/);
  });
});

describe('normalizeScreen', () => {
  it('defaults to home and accepts both screens', () => {
    expect(normalizeScreen(undefined)).toBe('home');
    expect(normalizeScreen('lock')).toBe('lock');
  });

  it('explains why "both" is not readable', () => {
    expect(() => normalizeScreen('both')).toThrow(/accepts "home" or "lock"/);
  });
});

describe('normalizeAllowBackup', () => {
  it('defaults to true', () => {
    expect(normalizeAllowBackup(undefined)).toBe(true);
    expect(normalizeAllowBackup(false)).toBe(false);
  });

  it.each(['true', 1, {}])('rejects %j', (value) => {
    expect(() => normalizeAllowBackup(value)).toThrow(/boolean/);
  });
});

describe('normalizeCrop', () => {
  it('defaults to null', () => {
    expect(normalizeCrop(undefined)).toBeNull();
    expect(normalizeCrop(null)).toBeNull();
  });

  it('rounds values to whole pixels', () => {
    expect(normalizeCrop({ x: 1.4, y: 2.5, width: 10.9, height: 20.1 })).toEqual({
      x: 1,
      y: 3,
      width: 11,
      height: 20,
    });
  });

  it.each([
    'crop',
    [],
    { x: 0, y: 0, width: 0, height: 10 },
    { x: 0, y: 0, width: 10, height: -1 },
    { x: -1, y: 0, width: 10, height: 10 },
    { x: 0, y: 0, width: Number.NaN, height: 10 },
    { x: 0, y: 0, width: Infinity, height: 10 },
    { x: '0', y: 0, width: 10, height: 10 },
    { x: 0, y: 0, width: 10 },
  ])('rejects %j', (crop) => {
    expect(() => normalizeCrop(crop)).toThrow(/crop/i);
  });
});

describe('normalizeSetWallpaperOptions', () => {
  it('applies all defaults', () => {
    expect(normalizeSetWallpaperOptions({ uri: 'file:///a.jpg' })).toEqual({
      uri: 'file:///a.jpg',
      target: 'home',
      allowBackup: true,
      crop: null,
    });
  });

  it('keeps explicit values', () => {
    expect(
      normalizeSetWallpaperOptions({
        uri: 'https://example.com/a.png',
        target: 'both',
        allowBackup: false,
        crop: { x: 0, y: 0, width: 10, height: 10 },
      })
    ).toEqual({
      uri: 'https://example.com/a.png',
      target: 'both',
      allowBackup: false,
      crop: { x: 0, y: 0, width: 10, height: 10 },
    });
  });

  it('rejects non-object options', () => {
    expect(() => normalizeSetWallpaperOptions(null as never)).toThrow(/expects an object/);
    expect(() => normalizeSetWallpaperOptions([] as never)).toThrow(/expects an object/);
  });
});

describe('normalizeMotion', () => {
  it('defaults to pan', () => {
    expect(normalizeMotion(undefined)).toBe('pan');
    expect(normalizeMotion(null)).toBe('pan');
  });

  it.each(['pan', 'none'])('accepts %s', (motion) => {
    expect(normalizeMotion(motion)).toBe(motion);
  });

  it.each(['spin', '', 1, true, {}])('rejects %j', (motion) => {
    expect(() => normalizeMotion(motion)).toThrow(/motion/);
  });
});

describe('normalizeSetLiveWallpaperImageOptions', () => {
  it('applies defaults', () => {
    expect(normalizeSetLiveWallpaperImageOptions({ uri: 'file:///a.jpg' })).toEqual({
      uri: 'file:///a.jpg',
      motion: 'pan',
    });
  });

  it('keeps explicit values', () => {
    expect(
      normalizeSetLiveWallpaperImageOptions({ uri: 'https://example.com/a.png', motion: 'none' })
    ).toEqual({
      uri: 'https://example.com/a.png',
      motion: 'none',
    });
  });

  it('validates the URI with the same rules as setWallpaper', () => {
    expect(() => normalizeSetLiveWallpaperImageOptions({ uri: 'nope' })).toThrow(/Invalid image URI/);
  });

  it('rejects non-object options', () => {
    expect(() => normalizeSetLiveWallpaperImageOptions(null as never)).toThrow(
      /expects an object/
    );
    expect(() => normalizeSetLiveWallpaperImageOptions([] as never)).toThrow(/expects an object/);
  });
});

describe('video option normalizers', () => {
  it('applies defaults', () => {
    expect(normalizeLoop(undefined)).toBe(true);
    expect(normalizeMuted(undefined)).toBe(true);
    expect(normalizeSpeed(undefined)).toBe(1);
    expect(normalizeScaling(undefined)).toBe('crop');
  });

  it('accepts boundary speeds', () => {
    expect(normalizeSpeed(0.25)).toBe(0.25);
    expect(normalizeSpeed(3)).toBe(3);
  });

  it.each(['yes', 1, {}])('rejects loop=%j', (value) => {
    expect(() => normalizeLoop(value)).toThrow(/boolean/);
  });

  it.each(['no', 0, {}])('rejects muted=%j', (value) => {
    expect(() => normalizeMuted(value)).toThrow(/boolean/);
  });

  it.each([0.24, 3.01, Number.NaN, Infinity, '1'])('rejects speed=%j', (value) => {
    expect(() => normalizeSpeed(value)).toThrow(/speed/);
  });

  it.each(['fill', 'fit', 'crop'])('accepts scaling=%s', (value) => {
    expect(normalizeScaling(value)).toBe(value);
  });

  it.each(['cover', '', 1])('rejects scaling=%j', (value) => {
    expect(() => normalizeScaling(value)).toThrow(/scaling/);
  });

  it('normalizes clear targets', () => {
    expect(normalizeClearTarget(undefined)).toBe('both');
    expect(normalizeClearTarget('home')).toBe('home');
    expect(normalizeClearTarget('lock')).toBe('lock');
    expect(() => normalizeClearTarget('desktop')).toThrow(/Invalid wallpaper target/);
  });
});

describe('normalizeSetLiveWallpaperVideoOptions', () => {
  it('applies all defaults', () => {
    expect(normalizeSetLiveWallpaperVideoOptions({ uri: 'file:///a.mp4' })).toEqual({
      uri: 'file:///a.mp4',
      loop: true,
      muted: true,
      speed: 1,
      scaling: 'crop',
    });
  });

  it('keeps explicit values', () => {
    expect(
      normalizeSetLiveWallpaperVideoOptions({
        uri: 'https://example.com/a.mp4',
        loop: false,
        muted: false,
        speed: 2,
        scaling: 'fill',
      })
    ).toEqual({
      uri: 'https://example.com/a.mp4',
      loop: false,
      muted: false,
      speed: 2,
      scaling: 'fill',
    });
  });

  it('validates the URI', () => {
    expect(() => normalizeSetLiveWallpaperVideoOptions({ uri: 'video.mp4' })).toThrow(
      /Invalid image URI/
    );
  });

  it('rejects non-object options', () => {
    expect(() => normalizeSetLiveWallpaperVideoOptions(null as never)).toThrow(
      /expects an object/
    );
  });
});
