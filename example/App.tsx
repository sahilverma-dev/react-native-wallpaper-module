import {
  applyLiveWallpaperVideo,
  clearLiveWallpaperImage,
  getCurrentLiveWallpaper,
  getWallpaperCapabilities,
  getWallpaperId,
  isLiveWallpaperSupported,
  isSetWallpaperAllowed,
  isWallpaperError,
  isWallpaperSupported,
  openLiveWallpaperPicker,
  setLiveWallpaperImage,
  setLiveWallpaperVideo,
  setWallpaper,
  type LiveWallpaperInfo,
  type LiveWallpaperMotion,
  type VideoScaling,
  type WallpaperCapabilities,
  type WallpaperTarget,
} from '@sahilverma-dev/wallpaper-module';
import { Asset } from 'expo-asset';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const REMOTE_IMAGE = 'https://picsum.photos/1080/1920';
const SAMPLE_VIDEO = require('./assets/test-video.mp4');
const SAMPLE_IMAGE = require('./assets/wallpaper.png');

type Capabilities = {
  supported: boolean | null;
  allowed: boolean | null;
  homeId: number | null;
  lockId: number | null;
};

const EMPTY_CAPABILITIES: Capabilities = {
  supported: null,
  allowed: null,
  homeId: null,
  lockId: null,
};

export default function App() {
  const [capabilities, setCapabilities] = useState<Capabilities>(EMPTY_CAPABILITIES);
  const [deviceCapabilities, setDeviceCapabilities] = useState<WallpaperCapabilities | null>(null);
  const [liveSupported, setLiveSupported] = useState<boolean | null>(null);
  const [liveInfo, setLiveInfo] = useState<LiveWallpaperInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState('Ready. Apply a sample wallpaper to get started.');

  const refreshCapabilities = useCallback(async () => {
    const [supported, allowed, live, device] = await Promise.all([
      isWallpaperSupported(),
      isSetWallpaperAllowed(),
      isLiveWallpaperSupported(),
      getWallpaperCapabilities().catch(() => null),
    ]);
    const [homeId, lockId, currentLive] = await Promise.all([
      getWallpaperId('home').catch(() => null),
      getWallpaperId('lock').catch(() => null),
      getCurrentLiveWallpaper().catch(() => null),
    ]);
    setCapabilities({ supported, allowed, homeId, lockId });
    setLiveSupported(live);
    setLiveInfo(currentLive);
    setDeviceCapabilities(device);
  }, []);

  useEffect(() => {
    // State updates happen after awaited native calls, not synchronously; the
    // rule cannot see through the async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshCapabilities().catch((error) => setLog(describeError(error)));
  }, [refreshCapabilities]);

  const apply = useCallback(
    async (uri: string, target: WallpaperTarget, label: string) => {
      setBusy(true);
      setLog(`Applying ${label} to ${target}…`);
      try {
        const result = await setWallpaper({ uri, target });
        setLog(
          `✓ ${label} applied to ${target}.\nwallpaperId: ${result.wallpaperId}\nsuccess: ${result.success}`
        );
        await refreshCapabilities();
      } catch (error) {
        setLog(`✗ ${label} failed.\n${describeError(error)}`);
      } finally {
        setBusy(false);
      }
    },
    [refreshCapabilities]
  );

  const getSampleUri = useCallback(async () => {
    const asset = Asset.fromModule(SAMPLE_IMAGE);
    await asset.downloadAsync();
    return asset.localUri ?? asset.uri;
  }, []);

  const applySample = useCallback(
    async (target: WallpaperTarget) => {
      setBusy(true);
      setLog('Preparing the bundled sample image…');
      try {
        const uri = await getSampleUri();
        setBusy(false);
        await apply(uri, target, 'sample image');
      } catch (error) {
        setBusy(false);
        setLog(`✗ Could not load the sample image.\n${describeError(error)}`);
      }
    },
    [apply, getSampleUri]
  );

  const configureLiveWallpaper = useCallback(
    async (motion: LiveWallpaperMotion) => {
      setBusy(true);
      setLog(`Saving the sample as the live wallpaper image (${motion})…`);
      try {
        const uri = await getSampleUri();
        await setLiveWallpaperImage({ uri, motion });
        setLog('✓ Live wallpaper image saved. Open the picker to confirm it.');
        await refreshCapabilities();
      } catch (error) {
        setLog(`✗ Could not configure the live wallpaper.\n${describeError(error)}`);
      } finally {
        setBusy(false);
      }
    },
    [getSampleUri, refreshCapabilities]
  );

  const openLivePicker = useCallback(async () => {
    setBusy(true);
    try {
      await openLiveWallpaperPicker();
      setLog('System live wallpaper preview opened. Confirm there, then press Refresh.');
    } catch (error) {
      setLog(`✗ Could not open the live wallpaper picker.\n${describeError(error)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const clearLiveImage = useCallback(async () => {
    setBusy(true);
    try {
      await clearLiveWallpaperImage();
      setLog('✓ Live wallpaper image cleared. The service falls back to a gradient.');
    } catch (error) {
      setLog(`✗ Could not clear the live wallpaper image.\n${describeError(error)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const getSampleVideoUri = useCallback(async () => {
    const asset = Asset.fromModule(SAMPLE_VIDEO);
    await asset.downloadAsync();
    return asset.localUri ?? asset.uri;
  }, []);

  const configureVideo = useCallback(
    async (scaling: VideoScaling) => {
      setBusy(true);
      setLog(`Preparing the bundled MP4 (${scaling})…`);
      try {
        const uri = await getSampleVideoUri();
        await setLiveWallpaperVideo({
          uri,
          loop: true,
          muted: true,
          scaling,
        });
        setLog('✓ Video saved. Open the system picker to apply it.');
        await refreshCapabilities();
      } catch (error) {
        setLog(`✗ Could not configure the video wallpaper.\n${describeError(error)}`);
      } finally {
        setBusy(false);
      }
    },
    [getSampleVideoUri, refreshCapabilities]
  );

  const applyVideo = useCallback(async () => {
    setBusy(true);
    setLog('Preparing video and opening the system picker…');
    try {
      const uri = await getSampleVideoUri();
      const result = await applyLiveWallpaperVideo({
        uri,
        loop: true,
        muted: true,
        scaling: 'crop',
      });
      setLog(
        `System picker opened. Confirm there, then press Refresh.\nrequiresConfirmation: ${String(
          result.requiresConfirmation
        )}`
      );
      await refreshCapabilities();
    } catch (error) {
      setLog(`✗ Could not apply the video wallpaper.\n${describeError(error)}`);
    } finally {
      setBusy(false);
    }
  }, [getSampleVideoUri, refreshCapabilities]);

  const pickFromGallery = useCallback(
    async (target: WallpaperTarget) => {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setLog('✗ Gallery permission was denied.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });

      if (result.canceled || result.assets.length === 0) {
        setLog('Image selection cancelled.');
        return;
      }

      await apply(result.assets[0].uri, target, 'picked image');
    },
    [apply]
  );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Wallpaper module</Text>
        <Text style={styles.subtitle}>
          Android home, lock and both-screen wallpapers from React Native.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Device</Text>
          <Row label="Wallpaper supported" value={formatFlag(capabilities.supported)} />
          <Row label="Setting allowed" value={formatFlag(capabilities.allowed)} />
          <Row label="Home wallpaper id" value={formatId(capabilities.homeId)} />
          <Row label="Lock wallpaper id" value={formatId(capabilities.lockId)} />
          <Row
            label="Video live wallpapers"
            value={formatFlag(deviceCapabilities?.videoLiveWallpapers ?? null)}
          />
          <Row
            label="Android API"
            value={deviceCapabilities ? String(deviceCapabilities.apiLevel) : '…'}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => refreshCapabilities().catch((e) => setLog(describeError(e)))}
            style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Refresh</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bundled sample</Text>
          <Text style={styles.cardHint}>1080 × 1920 PNG served from the app bundle.</Text>
          <View style={styles.buttonRow}>
            <TargetButton label="Home" target="home" onPress={applySample} disabled={busy} />
            <TargetButton label="Lock" target="lock" onPress={applySample} disabled={busy} />
            <TargetButton label="Both" target="both" onPress={applySample} disabled={busy} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Other sources</Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => pickFromGallery('home')}
            style={[styles.secondaryButton, busy && styles.disabled]}>
            <Text style={styles.secondaryButtonText}>Pick from gallery → Home</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => apply(REMOTE_IMAGE, 'home', 'remote image')}
            style={[styles.secondaryButton, busy && styles.disabled]}>
            <Text style={styles.secondaryButtonText}>Download https://picsum.photos → Home</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live wallpaper</Text>
          <Text style={styles.cardHint}>
            Android requires confirmation in the system picker; apps cannot switch live wallpapers
            silently.
          </Text>
          <Row label="Live wallpapers" value={formatFlag(liveSupported)} />
          <Row
            label="Active"
            value={liveInfo ? (liveInfo.isOurs ? 'This module' : liveInfo.packageName) : 'None (static)'}
          />
          <View style={styles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => configureLiveWallpaper('pan')}
              style={[styles.primaryButton, busy && styles.disabled]}>
              <Text style={styles.primaryButtonText}>Sample · pan</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => configureLiveWallpaper('none')}
              style={[styles.primaryButton, busy && styles.disabled]}>
              <Text style={styles.primaryButtonText}>Sample · static</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={openLivePicker}
            style={[styles.secondaryButton, busy && styles.disabled]}>
            <Text style={styles.secondaryButtonText}>Open system picker</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={clearLiveImage}
            style={[styles.secondaryButton, busy && styles.disabled]}>
            <Text style={styles.secondaryButtonText}>Clear image (gradient)</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Video live wallpaper</Text>
          <Text style={styles.cardHint}>
            Looped MP4 rendered by Media3 with cover/fit scaling. Requires confirmation in the
            system picker.
          </Text>
          <View style={styles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => configureVideo('crop')}
              style={[styles.primaryButton, busy && styles.disabled]}>
              <Text style={styles.primaryButtonText}>Configure · crop</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => configureVideo('fit')}
              style={[styles.primaryButton, busy && styles.disabled]}>
              <Text style={styles.primaryButtonText}>Configure · fit</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={applyVideo}
            style={[styles.secondaryButton, busy && styles.disabled]}>
            <Text style={styles.secondaryButtonText}>Apply video (opens picker)</Text>
          </Pressable>
        </View>

        <View style={styles.logCard}>
          <View style={styles.logHeader}>
            <Text style={styles.cardTitle}>Log</Text>
            {busy ? <ActivityIndicator size="small" color="#8b7bff" /> : null}
          </View>
          <Text style={styles.logText}>{log}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TargetButton(props: {
  label: string;
  target: WallpaperTarget;
  onPress: (target: WallpaperTarget) => Promise<void>;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={() => {
        props.onPress(props.target).catch(() => undefined);
      }}
      style={[styles.primaryButton, props.disabled && styles.disabled]}>
      <Text style={styles.primaryButtonText}>{props.label}</Text>
    </Pressable>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function formatFlag(value: boolean | null): string {
  if (value === null) {
    return '…';
  }
  return value ? 'yes' : 'no';
}

function formatId(value: number | null): string {
  if (value === null) {
    return 'unavailable';
  }
  return String(value);
}

function describeError(error: unknown): string {
  if (isWallpaperError(error)) {
    return `${error.code}\n${error.message}`;
  }
  if (error instanceof Error) {
    return `${error.name}\n${error.message}`;
  }
  return String(error);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0b0b12',
  },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#9a9ab0',
    fontSize: 15,
    lineHeight: 21,
    marginTop: -8,
  },
  card: {
    backgroundColor: '#16161f',
    borderRadius: 18,
    padding: 18,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2a2a3a',
  },
  logCard: {
    backgroundColor: '#101019',
    borderRadius: 18,
    padding: 18,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2a2a3a',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  cardHint: {
    color: '#8a8aa0',
    fontSize: 13,
    marginTop: -4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLabel: {
    color: '#a0a0b8',
    fontSize: 14,
  },
  rowValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    textAlign: 'right',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#6f5bff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#232334',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#d7d7e8',
    fontSize: 14,
    fontWeight: '500',
  },
  disabled: {
    opacity: 0.45,
  },
  logText: {
    color: '#b9b9cf',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'monospace',
  },
});
