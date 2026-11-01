import {
  AndroidConfig,
  type ConfigPlugin,
  createRunOncePlugin,
  withAndroidManifest,
} from '@expo/config-plugins';

// Kept in sync with package.json. Reading package.json from the compiled
// plugin would depend on the build output layout.
const PLUGIN_NAME = '@sahilverma-dev/wallpaper-module';
const PLUGIN_VERSION = '0.3.0';

const withSetWallpaperPermission: ConfigPlugin = (config) =>
  withAndroidManifest(config, (configWithManifest) => {
    const manifest = configWithManifest.modResults;
    // The library manifest already declares the permission, but ensuring it
    // here keeps the behavior explicit and survives apps that strip library
    // manifests.
    AndroidConfig.Permissions.ensurePermissions(manifest, [
      'android.permission.SET_WALLPAPER',
    ]);

    return configWithManifest;
  });

const withWallpaper: ConfigPlugin = (config) => {
  config = withSetWallpaperPermission(config);
  return config;
};

export default createRunOncePlugin(withWallpaper, PLUGIN_NAME, PLUGIN_VERSION);
