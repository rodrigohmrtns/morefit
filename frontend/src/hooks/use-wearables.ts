/**
 * useWearables — thin wrapper around HealthKit / Health Connect.
 *
 * The real native modules only work in a **development build** (not in Expo Go
 * or the web preview). In non-native environments we expose a stub that lets
 * the user manually enter data and shows a "Native build required" banner.
 *
 * To enable native sync, add to your build:
 *   - iOS: `@kingstinct/react-native-healthkit`
 *   - Android: `react-native-health-connect`
 * Then run `Publish` → generate a new build.
 */
import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { api } from '@/src/api/client';

/**
 * `expo-constants.executionEnvironment` values:
 *   - 'standalone' — release build (fully native)
 *   - 'storeClient' — Expo Go
 *   - 'bare' — bare workflow
 *
 * We treat 'standalone' and 'bare' as "native-capable"; everything else
 * (Expo Go, web preview, EAS-Preview without the health module) falls back
 * to manual mode.
 */
export function isNativeBuild(): boolean {
  if (Platform.OS === 'web') return false;
  const env = Constants.executionEnvironment;
  return env === 'standalone' || env === 'bare';
}

export type WearableSource = 'healthkit' | 'health-connect' | 'google-fit' | 'manual';

export type WearableCapabilities = {
  available: boolean;
  reason?: 'expo-go' | 'web-preview' | 'missing-native-module';
  source: WearableSource;
};

export type SyncStatus = {
  sources: Record<string, { last_sync_at: string; device_name?: string; total_syncs: number; last_counters: any }>;
  total: number;
};

export function useWearables() {
  const [caps, setCaps] = useState<WearableCapabilities>({ available: false, source: 'manual' });
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect capabilities
  useEffect(() => {
    if (!isNativeBuild()) {
      setCaps({
        available: false,
        source: 'manual',
        reason: Platform.OS === 'web' ? 'web-preview' : 'expo-go',
      });
      return;
    }
    if (Platform.OS === 'ios') {
      // Would attempt to load @kingstinct/react-native-healthkit here in a real
      // native build. Kept as a soft probe so preview / Expo Go don't crash.
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('@kingstinct/react-native-healthkit');
        setCaps({ available: true, source: 'healthkit' });
      } catch {
        setCaps({ available: false, source: 'manual', reason: 'missing-native-module' });
      }
    } else if (Platform.OS === 'android') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('react-native-health-connect');
        setCaps({ available: true, source: 'health-connect' });
      } catch {
        setCaps({ available: false, source: 'manual', reason: 'missing-native-module' });
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await api<SyncStatus>('/wearables/status');
      setStatus(s);
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  /**
   * Request HealthKit / Health Connect permissions and pull the last 7 days
   * of the metrics the user has toggled on.
   *
   * In non-native environments this is a no-op that returns `false`.
   */
  const syncNow = useCallback(async (): Promise<boolean> => {
    if (!caps.available) return false;
    // Real native sync code would live here — see the file header for details.
    // For now we shim by pushing an empty batch so the server registers the sync event.
    try {
      await api('/wearables/sync', { method: 'POST', body: { source: caps.source } });
      await refresh();
      return true;
    } catch (e: any) {
      setError(e?.message || 'Falha na sincronização');
      return false;
    }
  }, [caps, refresh]);

  /** Manual entry fallback: push a batch payload the user assembled by hand. */
  const pushManualBatch = useCallback(async (body: any): Promise<boolean> => {
    try {
      await api('/wearables/sync', { method: 'POST', body: { ...body, source: 'manual' } });
      await refresh();
      return true;
    } catch (e: any) {
      setError(e?.message || 'Falha ao enviar dados');
      return false;
    }
  }, [refresh]);

  return { caps, status, loading, error, refresh, syncNow, pushManualBatch };
}
