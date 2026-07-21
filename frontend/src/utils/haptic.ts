/**
 * Cross-platform haptic feedback helpers.
 *
 * Silent no-op on web (where Haptics is unavailable). Prefer these helpers
 * over calling `expo-haptics` directly so UX stays consistent.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export const haptic = {
  tap: () => {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  select: () => {
    if (Platform.OS === 'web') return;
    Haptics.selectionAsync().catch(() => {});
  },
  success: () => {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  warn: () => {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
  error: () => {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
};
