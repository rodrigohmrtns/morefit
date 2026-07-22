import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { useLocale } from '@/src/i18n';
import { useTheme } from '@/src/theme';

/**
 * Accessible back button with WCAG-compliant 44x44 touch target.
 *
 * Wraps expo-router's `router.back()`, adds proper role/label for screen readers.
 */
export function BackButton({ testID }: { testID?: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLocale();
  return (
    <Pressable
      onPress={() => router.back()}
      style={styles.btn}
      testID={testID ?? 'back-btn'}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      hitSlop={12}
    >
      <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
