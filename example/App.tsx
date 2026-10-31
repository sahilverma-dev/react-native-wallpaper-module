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

import {
  getWallpaperId,
  isSetWallpaperAllowed,
  isWallpaperError,
  isWallpaperSupported,
  setWallpaper,
  type WallpaperTarget,
} from '@sahilverma-dev/wallpaper-module';

const REMOTE_IMAGE = 'https://picsum.photos/1080/1920';
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
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState('Ready. Apply a sample wallpaper to get started.');

  const refreshCapabilities = useCallback(async () => {
    const [supported, allowed] = await Promise.all([
      isWallpaperSupported(),
      isSetWallpaperAllowed(),
    ]);
    const [homeId, lockId] = await Promise.all([
      getWallpaperId('home').catch(() => null),
      getWallpaperId('lock').catch(() => null),
    ]);
    setCapabilities({ supported, allowed, homeId, lockId });
  }, []);

  useEffect(() => {
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

  const applySample = useCallback(
    async (target: WallpaperTarget) => {
      setBusy(true);
      setLog('Preparing the bundled sample image…');
      try {
        const asset = Asset.fromModule(SAMPLE_IMAGE);
        await asset.downloadAsync();
        const uri = asset.localUri ?? asset.uri;
        setBusy(false);
        await apply(uri, target, 'sample image');
      } catch (error) {
        setBusy(false);
        setLog(`✗ Could not load the sample image.\n${describeError(error)}`);
      }
    },
    [apply]
  );

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
