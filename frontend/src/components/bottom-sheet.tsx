/**
 * Themed bottom-sheet primitive built on `@gorhom/bottom-sheet`.
 *
 * Usage:
 *   const ref = useRef<BottomSheetModal>(null);
 *   <ThemedBottomSheet ref={ref} snapPoints={['40%', '70%']}>
 *     <YourContent />
 *   </ThemedBottomSheet>
 *   // open with ref.current?.present();
 */
import { BottomSheetBackdrop, BottomSheetBackdropProps, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, ReactNode, useCallback, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { radius, spacing, typography, useTheme } from '@/src/theme';

type Props = {
  children: ReactNode;
  snapPoints?: (string | number)[];
  title?: string;
  onDismiss?: () => void;
};

export const ThemedBottomSheet = forwardRef<BottomSheetModal, Props>(function ThemedBottomSheet(
  { children, snapPoints, title, onDismiss },
  ref,
) {
  const { colors } = useTheme();

  const snaps = useMemo(() => snapPoints ?? ['50%'], [snapPoints]);

  const backdrop = useCallback(
    (p: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...p}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.5}
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snaps}
      onDismiss={onDismiss}
      backdropComponent={backdrop}
      backgroundStyle={{ backgroundColor: colors.surfaceSecondary }}
      handleIndicatorStyle={{ backgroundColor: colors.borderStrong, width: 44 }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetView style={styles.container}>
        {title ? (
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <Text style={[typography.title, { color: colors.onSurface }]}>{title}</Text>
            <TouchableOpacity
              onPress={() => (ref as any)?.current?.dismiss?.()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Fechar"
              accessibilityRole="button"
            >
              <Feather name="x" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>{children}</View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

// ---------------------------------------------------------------------------
// Quick-action row (icon + label) — perfect for action sheets
// ---------------------------------------------------------------------------
type ActionProps = {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  tint?: string;
  destructive?: boolean;
  subtitle?: string;
};

export function SheetAction({ icon, label, onPress, tint, destructive, subtitle }: ActionProps) {
  const { colors } = useTheme();
  const accent = destructive ? colors.error : (tint ?? colors.brandPrimary);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.action}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.actionIcon, { backgroundColor: accent + '22' }]}>
        <Feather name={icon} size={20} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodyStrong, { color: destructive ? colors.error : colors.onSurface }]}>{label}</Text>
        {subtitle ? (
          <Text style={[typography.caption, { color: colors.muted, marginTop: 2 }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
    minHeight: 56,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
