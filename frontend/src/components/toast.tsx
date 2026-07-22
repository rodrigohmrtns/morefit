/**
 * Global toast messaging — wraps `react-native-toast-message` with
 * MoreFit theme + simple helper API.
 *
 * Usage:
 *   import { toast } from '@/src/components/toast';
 *   toast.success('Salvo!');
 *   toast.error('Algo deu errado.', 'Verifique sua conexão.');
 *   toast.info('Dica', 'Pull to refresh para atualizar.');
 */
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Toast, { BaseToastProps, ToastConfig } from 'react-native-toast-message';

import { radius, spacing, typography, useTheme } from '@/src/theme';

// ---------------------------------------------------------------------------
// Custom themed toast body — matches MoreFit design system
// ---------------------------------------------------------------------------
function ThemedToast({
  variant, text1, text2,
}: BaseToastProps & { variant: 'success' | 'error' | 'info' | 'warning' }) {
  const { colors } = useTheme();
  const iconName =
    variant === 'success' ? 'check-circle' :
    variant === 'error' ? 'alert-circle' :
    variant === 'warning' ? 'alert-triangle' :
    'info';
  const accent =
    variant === 'success' ? colors.success :
    variant === 'error' ? colors.error :
    variant === 'warning' ? colors.warning :
    colors.info;

  return (
    <View
      style={[
        styles.toast,
        {
          backgroundColor: colors.surfaceSecondary,
          borderColor: colors.border,
          shadowColor: '#000',
        },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <View style={[styles.iconBubble, { backgroundColor: accent + '22' }]}>
        <Feather name={iconName as any} size={20} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodyStrong, { color: colors.onSurface }]} numberOfLines={1}>
          {text1}
        </Text>
        {text2 ? (
          <Text style={[typography.caption, { color: colors.muted, marginTop: 2 }]} numberOfLines={2}>
            {text2}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export const toastConfig: ToastConfig = {
  success: (props) => <ThemedToast {...props} variant="success" />,
  error: (props) => <ThemedToast {...props} variant="error" />,
  info: (props) => <ThemedToast {...props} variant="info" />,
  warning: (props) => <ThemedToast {...props} variant="warning" />,
};

// ---------------------------------------------------------------------------
// Helper API
// ---------------------------------------------------------------------------
export const toast = {
  success(text1: string, text2?: string) {
    Toast.show({ type: 'success', text1, text2, position: 'top', visibilityTime: 2500 });
  },
  error(text1: string, text2?: string) {
    Toast.show({ type: 'error', text1, text2, position: 'top', visibilityTime: 3500 });
  },
  info(text1: string, text2?: string) {
    Toast.show({ type: 'info', text1, text2, position: 'top', visibilityTime: 2500 });
  },
  warning(text1: string, text2?: string) {
    Toast.show({ type: 'warning', text1, text2, position: 'top', visibilityTime: 3000 });
  },
  hide() { Toast.hide(); },
};

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 60,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    gap: spacing.md,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
