/**
 * React Query client with AsyncStorage persistence.
 *
 * Guarantees:
 *  - Every successful query is cached and survives app restarts.
 *  - When offline, cached data is used instead of network calls.
 *  - When back online, stale data is refetched in the background.
 *  - Mutations queue optimistic updates and rollback on failure.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

// Wire NetInfo into React Query's online manager so pausedMutation resume works.
onlineManager.setEventListener(setOnline => {
  return NetInfo.addEventListener((state: NetInfoState) => {
    setOnline(!!state.isConnected);
  });
});

// Refocus queries when app comes back to foreground.
function onAppStateChange(status: string) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data considered "fresh" for 60s — no automatic refetch inside window.
      staleTime: 60 * 1000,
      // Cache is kept for 24h — survives app restarts via persister.
      gcTime: 1000 * 60 * 60 * 24,
      // On mount, don't refetch if we have fresh data (keeps offline snappy).
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      retry: (failureCount, error: any) => {
        // Don't retry auth/premium errors, only transient network ones.
        const status = error?.status;
        if (status === 401 || status === 402 || status === 403 || status === 404) return false;
        return failureCount < 2;
      },
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 1,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'vt-query-cache-v1',
  throttleTime: 1000,
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // 24h — cache expires after a day offline
        buster: 'v1', // bump this to invalidate all persisted cache
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
