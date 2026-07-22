/**
 * Themed pull-to-refresh helpers.
 *
 * Usage:
 *   const { refreshing, onRefresh } = usePullRefresh(async () => { await refetch(); });
 *   <ScrollView refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
 */
import { useCallback, useState } from 'react';
import { RefreshControl, RefreshControlProps } from 'react-native';

import { useTheme } from '@/src/theme';

export function usePullRefresh(fn: () => Promise<void> | void) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fn();
    } finally {
      setRefreshing(false);
    }
  }, [fn]);
  return { refreshing, onRefresh };
}

export function ThemedRefreshControl(props: Omit<RefreshControlProps, 'colors' | 'tintColor' | 'progressBackgroundColor'>) {
  const { colors } = useTheme();
  return (
    <RefreshControl
      {...props}
      tintColor={colors.brandPrimary}
      colors={[colors.brandPrimary]}
      progressBackgroundColor={colors.surfaceSecondary}
    />
  );
}
