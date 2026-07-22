/**
 * Skeleton loader — lightweight shimmer effect using react-native-reanimated.
 *
 * Usage:
 *   <Skeleton height={20} width="60%" />
 *   <SkeletonCard />        // pre-baked card row
 *   <SkeletonList count={5} />
 */
import { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';

import { radius, spacing, useTheme } from '@/src/theme';

type SkeletonProps = {
  width?: number | `${number}%` | 'auto';
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

export function Skeleton({ width = '100%', height = 16, radius: r = 8, style }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.9, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: width as any,
          height,
          borderRadius: r,
          backgroundColor: colors.surfaceTertiary,
        },
        style,
        animatedStyle,
      ]}
    />
  );
}

export function SkeletonCard() {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Skeleton width={44} height={44} radius={22} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Skeleton width="70%" height={16} />
          <View style={{ height: spacing.xs }} />
          <Skeleton width="45%" height={12} />
        </View>
      </View>
      <View style={{ height: spacing.md }} />
      <Skeleton width="100%" height={12} />
      <View style={{ height: spacing.xs }} />
      <Skeleton width="85%" height={12} />
    </View>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ marginBottom: spacing.md }}>
          <SkeletonCard />
        </View>
      ))}
    </View>
  );
}

export function SkeletonHeroStats() {
  const { colors } = useTheme();
  return (
    <View style={[styles.hero, { backgroundColor: colors.surfaceInverse }]}>
      <Skeleton width="40%" height={12} style={{ backgroundColor: colors.surfaceTertiary, opacity: 0.4 }} />
      <View style={{ height: spacing.sm }} />
      <Skeleton width="60%" height={32} style={{ backgroundColor: colors.surfaceTertiary, opacity: 0.6 }} />
      <View style={{ height: spacing.lg }} />
      <View style={styles.statsRow}>
        {[0, 1, 2].map((k) => (
          <View key={k} style={{ flex: 1 }}>
            <Skeleton width="60%" height={10} style={{ backgroundColor: colors.surfaceTertiary, opacity: 0.4 }} />
            <View style={{ height: spacing.xs }} />
            <Skeleton width="80%" height={18} style={{ backgroundColor: colors.surfaceTertiary, opacity: 0.6 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  hero: {
    padding: spacing.xl,
    borderRadius: radius.lg,
  },
  statsRow: { flexDirection: 'row', gap: spacing.lg },
});
