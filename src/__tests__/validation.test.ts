import {
  normalizeAllowBackup,
  normalizeCrop,
  normalizeScreen,
  normalizeSetWallpaperOptions,
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
