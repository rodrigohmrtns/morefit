/**
 * Empty State — themed illustration + copy + optional CTA.
 *
 * Uses inline SVG so no assets need to ship. Each variant paints with
 * the current accent so it always matches the user's theme.
 *
 * Usage:
 *   <EmptyState variant="meals" title="Sem refeições ainda" body="…" cta="Adicionar refeição" onPressCta={…} />
 */
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { spacing, radius, typography, useTheme } from '@/src/theme';

export type EmptyVariant =
  | 'meals'
  | 'weight'
  | 'water'
  | 'exercise'
  | 'sleep'
  | 'community'
  | 'search'
  | 'generic'
  | 'photos'
  | 'timeline';

type Props = {
  variant?: EmptyVariant;
  title: string;
  body?: string;
  cta?: string;
  onPressCta?: () => void;
  style?: ViewStyle;
  compact?: boolean;
};

export function EmptyState({ variant = 'generic', title, body, cta, onPressCta, style, compact }: Props) {
  const { colors } = useTheme();
  const size = compact ? 120 : 160;

  return (
    <View style={[styles.wrap, compact && { paddingVertical: spacing.xl }, style]}>
      <Illustration variant={variant} size={size} tint={colors.brandPrimary} bg={colors.brandTertiary} ink={colors.brandDark} muted={colors.muted} />
      <Text style={[typography.headline, { color: colors.onSurface, marginTop: spacing.lg, textAlign: 'center' }]}>{title}</Text>
      {body ? (
        <Text style={[typography.body, { color: colors.muted, marginTop: spacing.xs, textAlign: 'center', maxWidth: 300 }]}>{body}</Text>
      ) : null}
      {cta && onPressCta ? (
        <TouchableOpacity
          onPress={onPressCta}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={cta}
          style={[styles.cta, { backgroundColor: colors.brandPrimary }]}
        >
          <Text style={[typography.bodyStrong, { color: colors.onBrandPrimary }]}>{cta}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Illustrations – simple, single-color friendly, ~160x160 viewport
// ---------------------------------------------------------------------------
function Illustration({
  variant, size, tint, bg, ink, muted,
}: { variant: EmptyVariant; size: number; tint: string; bg: string; ink: string; muted: string }) {
  const s = size;
  const common = (
    <Circle cx={80} cy={80} r={72} fill={bg} />
  );
  return (
    <Svg width={s} height={s} viewBox="0 0 160 160">
      {common}
      {variant === 'meals' && (
        <G>
          <Circle cx={80} cy={82} r={38} fill="#FFFFFF" stroke={ink} strokeWidth={3} />
          <Circle cx={80} cy={82} r={26} fill={tint} />
          <Path d="M60 46 L60 30 M64 46 L64 30 M56 46 L56 30" stroke={ink} strokeWidth={3} strokeLinecap="round" />
          <Path d="M100 30 c8 0 8 10 4 18" stroke={ink} strokeWidth={3} strokeLinecap="round" fill="none" />
        </G>
      )}
      {variant === 'weight' && (
        <G>
          <Rect x={40} y={70} width={80} height={50} rx={10} fill="#FFFFFF" stroke={ink} strokeWidth={3} />
          <Circle cx={80} cy={62} r={12} fill={tint} stroke={ink} strokeWidth={3} />
          <Path d="M80 96 l6 -10" stroke={ink} strokeWidth={3} strokeLinecap="round" />
          <Circle cx={80} cy={96} r={3} fill={ink} />
        </G>
      )}
      {variant === 'water' && (
        <G>
          <Path d="M80 30 C110 70 110 100 80 130 C50 100 50 70 80 30 Z" fill={tint} stroke={ink} strokeWidth={3} />
          <Path d="M70 90 C70 100 78 108 88 108" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" fill="none" />
        </G>
      )}
      {variant === 'exercise' && (
        <G>
          <Circle cx={80} cy={54} r={12} fill={tint} stroke={ink} strokeWidth={3} />
          <Path d="M80 66 L80 110 M80 78 L58 92 M80 78 L102 92 M80 110 L64 130 M80 110 L96 130" stroke={ink} strokeWidth={4} strokeLinecap="round" />
        </G>
      )}
      {variant === 'sleep' && (
        <G>
          <Path d="M110 60 c-10 20 -30 30 -50 24 c8 26 40 34 60 14 c10 -10 12 -28 -10 -38 Z" fill={tint} stroke={ink} strokeWidth={3} />
          <Circle cx={106} cy={44} r={2.5} fill={ink} />
          <Circle cx={120} cy={54} r={2} fill={ink} />
        </G>
      )}
      {variant === 'community' && (
        <G>
          <Circle cx={60} cy={70} r={16} fill={tint} stroke={ink} strokeWidth={3} />
          <Circle cx={100} cy={70} r={16} fill="#FFFFFF" stroke={ink} strokeWidth={3} />
          <Path d="M40 116 c0 -14 12 -22 20 -22 s20 8 20 22 z" fill={tint} stroke={ink} strokeWidth={3} />
          <Path d="M80 116 c0 -14 12 -22 20 -22 s20 8 20 22 z" fill="#FFFFFF" stroke={ink} strokeWidth={3} />
        </G>
      )}
      {variant === 'search' && (
        <G>
          <Circle cx={72} cy={72} r={26} fill="#FFFFFF" stroke={ink} strokeWidth={4} />
          <Path d="M92 92 L114 114" stroke={ink} strokeWidth={5} strokeLinecap="round" />
          <Circle cx={72} cy={72} r={4} fill={tint} />
        </G>
      )}
      {variant === 'photos' && (
        <G>
          <Rect x={38} y={50} width={84} height={64} rx={10} fill="#FFFFFF" stroke={ink} strokeWidth={3} />
          <Circle cx={62} cy={72} r={6} fill={tint} />
          <Path d="M46 108 L74 84 L92 100 L114 82 L114 108 Z" fill={tint} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
        </G>
      )}
      {variant === 'timeline' && (
        <G>
          <Rect x={48} y={38} width={64} height={88} rx={8} fill="#FFFFFF" stroke={ink} strokeWidth={3} />
          <Circle cx={60} cy={58} r={5} fill={tint} />
          <Path d="M72 58 L100 58" stroke={muted} strokeWidth={3} strokeLinecap="round" />
          <Circle cx={60} cy={82} r={5} fill={tint} />
          <Path d="M72 82 L96 82" stroke={muted} strokeWidth={3} strokeLinecap="round" />
          <Circle cx={60} cy={106} r={5} fill={tint} />
          <Path d="M72 106 L92 106" stroke={muted} strokeWidth={3} strokeLinecap="round" />
        </G>
      )}
      {variant === 'generic' && (
        <G>
          <Rect x={48} y={54} width={64} height={52} rx={10} fill="#FFFFFF" stroke={ink} strokeWidth={3} />
          <Circle cx={68} cy={80} r={4} fill={ink} />
          <Circle cx={80} cy={80} r={4} fill={ink} />
          <Circle cx={92} cy={80} r={4} fill={ink} />
        </G>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  cta: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
