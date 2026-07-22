import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useLocale } from '@/src/i18n';
import { radius, shadow, spacing, ThemeColors, typography, useTheme } from '@/src/theme';
import { ThemedRefreshControl, usePullRefresh } from '@/src/components/refresh';
import { Skeleton } from '@/src/components/skeleton';
import { EmptyState } from '@/src/components/empty-state';

type Period = 'day' | 'week' | 'month' | 'year';
type Metric = 'weight' | 'bmi' | 'body_fat' | 'muscle' | 'water_pct' | 'waist' | 'hip'
  | 'arm' | 'chest' | 'abdomen' | 'thigh' | 'calf' | 'neck' | 'shoulders';

const PERIODS: { key: Period; labelKey: string }[] = [
  { key: 'day', labelKey: 'progress.daily' },
  { key: 'week', labelKey: 'progress.weekly' },
  { key: 'month', labelKey: 'progress.monthly' },
  { key: 'year', labelKey: 'progress.yearly' },
];

const METRICS: { key: Metric; unit: string; icon: any }[] = [
  { key: 'weight', unit: 'kg', icon: 'scale' },
  { key: 'bmi', unit: '', icon: 'body' },
  { key: 'body_fat', unit: '%', icon: 'water' },
  { key: 'muscle', unit: 'kg', icon: 'fitness' },
  { key: 'water_pct', unit: '%', icon: 'water-outline' },
  { key: 'arm', unit: 'cm', icon: 'barbell' },
  { key: 'chest', unit: 'cm', icon: 'shirt' },
  { key: 'abdomen', unit: 'cm', icon: 'body' },
  { key: 'waist', unit: 'cm', icon: 'resize' },
  { key: 'hip', unit: 'cm', icon: 'resize-outline' },
  { key: 'thigh', unit: 'cm', icon: 'walk' },
  { key: 'calf', unit: 'cm', icon: 'footsteps' },
  { key: 'neck', unit: 'cm', icon: 'ellipse' },
  { key: 'shoulders', unit: 'cm', icon: 'triangle' },
];

type Series = { series: { date: string; value: number }[]; stats: {
  current: number | null; first: number | null; diff: number | null; avg: number | null;
  min: number | null; max: number | null; trend_per_week: number | null; predicted_30d: number | null;
} };

export default function Progress() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLocale();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [period, setPeriod] = useState<Period>('week');
  const [metric, setMetric] = useState<Metric>('weight');
  const [data, setData] = useState<Series | null>(null);
  const [compare, setCompare] = useState<Record<string, { date: string; value: number }[]> | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api<Series & { metric: string }>(`/analytics/weight?metric=${metric}&period=${period}`);
      setData(r);
      if (showCompare) {
        const c = await api<{ metrics: Record<string, any[]> }>(`/analytics/compare?period=${period}`);
        setCompare(c.metrics);
      }
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  }, [metric, period, showCompare]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const { refreshing, onRefresh } = usePullRefresh(load);

  const currentMeta = METRICS.find(m => m.key === metric)!;
  const currentLabel = t(`progress.metrics.${metric}`);
  const unit = currentMeta.unit;

  return (
    <View style={s.root} testID="progress-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>{t('progress.title')}</Text>
            <Text style={s.sub}>{t('progress.subtitle')}</Text>
          </View>
          <Pressable style={s.addBtn} onPress={() => router.push('/weight-log')} testID="progress-add-log">
            <Ionicons name="add" size={22} color={colors.brandDark} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Metric selector – horizontal chip row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.metricsRow} testID="progress-metrics-row">
          {METRICS.map(m => (
            <Pressable
              key={m.key}
              onPress={() => setMetric(m.key)}
              style={[s.mChip, metric === m.key && s.mChipActive]}
              testID={`progress-metric-${m.key}`}
            >
              <Ionicons name={m.icon} size={14} color={metric === m.key ? colors.onBrandPrimary : colors.onSurface} />
              <Text style={[s.mChipTxt, metric === m.key && { color: colors.onBrandPrimary, fontWeight: '700' }]}>{t(`progress.metrics.${m.key}`)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Period selector */}
        <View style={s.periodRow}>
          {PERIODS.map(p => (
            <Pressable
              key={p.key}
              onPress={() => setPeriod(p.key)}
              style={[s.pChip, period === p.key && s.pChipActive]}
              testID={`progress-period-${p.key}`}
            >
              <Text style={[s.pChipTxt, period === p.key && { color: colors.onSurface, fontWeight: '700' }]}>{t(p.labelKey)}</Text>
            </Pressable>
          ))}
        </View>

        {/* Big stat card */}
        <View style={s.bigCard}>
          <Text style={s.bigLabel}>{currentLabel} {t('progress.currentValue')}</Text>
          <View style={s.bigRow}>
            <Text style={s.bigValue}>
              {data?.stats.current != null ? formatVal(data.stats.current, metric) : '—'}
            </Text>
            <Text style={s.bigUnit}>{unit}</Text>
          </View>
          <View style={s.diffRow}>
            {data?.stats.diff != null && (
              <View style={[s.diffPill, { backgroundColor: diffColor(data.stats.diff, metric, colors) }]}>
                <Ionicons name={data.stats.diff <= 0 ? 'arrow-down' : 'arrow-up'} size={12} color={colors.onSurfaceInverse} />
                <Text style={s.diffTxt}>
                  {data.stats.diff > 0 ? '+' : ''}{formatVal(data.stats.diff, metric)}{unit}
                </Text>
              </View>
            )}
            <Text style={s.diffMeta}>{t('progress.inPeriod')}</Text>
          </View>
        </View>

        {/* Chart */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('progress.evolution')}</Text>
          {loading && !data ? (
            <View style={{ paddingVertical: spacing.md, gap: spacing.sm }}>
              <Skeleton height={140} radius={12} />
            </View>
          ) : !data || data.series.length < 2 ? (
            <EmptyState
              variant="weight"
              title={t('progress.emptyChart')}
              body="Registre pelo menos 2 medições para visualizar sua evolução."
              cta={t('progress.addLog') || 'Adicionar medição'}
              onPressCta={() => router.push('/weight-log')}
              compact
            />
          ) : (
            <Chart colors={colors} series={data.series} predicted={data.stats.predicted_30d ?? undefined} />
          )}
        </View>

        {/* Stats grid */}
        <View style={s.statsGrid}>
          <StatCard colors={colors} tint={colors.tintMint} label={t('progress.avg')} value={data?.stats.avg} unit={unit} metric={metric} />
          <StatCard colors={colors} tint={colors.tintSky} label={t('progress.min')} value={data?.stats.min} unit={unit} metric={metric} />
          <StatCard colors={colors} tint={colors.tintPeach} label={t('progress.max')} value={data?.stats.max} unit={unit} metric={metric} />
        </View>

        {/* Trend + Prediction */}
        <View style={s.trendCard}>
          <View style={s.trendRow}>
            <View style={s.trendIcon}><Ionicons name="trending-up" size={20} color={colors.brandDark} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.trendLabel}>{t('progress.weeklyTrend')}</Text>
              <Text style={s.trendVal}>
                {data?.stats.trend_per_week != null
                  ? `${data.stats.trend_per_week > 0 ? '+' : ''}${data.stats.trend_per_week.toFixed(2)}${unit}/sem`
                  : '—'}
              </Text>
            </View>
          </View>
          <View style={s.trendDivider} />
          <View style={s.trendRow}>
            <View style={s.trendIcon}><Ionicons name="rocket" size={20} color={colors.brandDark} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.trendLabel}>{t('progress.predict30d')}</Text>
              <Text style={s.trendVal}>
                {data?.stats.predicted_30d != null
                  ? `${formatVal(data.stats.predicted_30d, metric)}${unit}`
                  : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Comparison toggle */}
        <Pressable style={s.compareBtn} onPress={() => setShowCompare(v => !v)} testID="progress-toggle-compare">
          <Ionicons name={showCompare ? 'chevron-up' : 'git-compare'} size={18} color={colors.onSurface} />
          <Text style={s.compareTxt}>{showCompare ? t('progress.hideCompare') : t('progress.showCompare')}</Text>
        </Pressable>

        {showCompare && compare && (
          <View style={s.compareGrid} testID="progress-compare-grid">
            {METRICS.map(m => {
              const series = compare[m.key] || [];
              return (
                <View key={m.key} style={s.miniCard}>
                  <View style={s.miniHead}>
                    <Ionicons name={m.icon} size={14} color={colors.brandDark} />
                    <Text style={s.miniLabel}>{t(`progress.metrics.${m.key}`)}</Text>
                  </View>
                  {series.length < 2 ? (
                    <Text style={s.miniEmpty}>—</Text>
                  ) : (
                    <>
                      <Text style={s.miniVal}>
                        {formatVal(series[series.length - 1].value, m.key)}
                        <Text style={s.miniUnit}> {m.unit}</Text>
                      </Text>
                      <MiniChart colors={colors} series={series} />
                    </>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* CTA */}
        <Pressable style={s.ctaBig} onPress={() => router.push('/weight-log')} testID="progress-log-cta">
          <Ionicons name="add-circle" size={22} color={colors.brandDark} />
          <Text style={s.ctaBigTxt}>{t('progress.logNew')}</Text>
        </Pressable>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

function formatVal(v: number, m: Metric): string {
  if (m === 'bmi') return v.toFixed(1);
  if (m === 'body_fat' || m === 'water_pct') return v.toFixed(1);
  return v.toFixed(1);
}

function diffColor(diff: number, m: Metric, colors: ThemeColors): string {
  // For weight/waist/hip/bodyfat: lower is "good" for lose goals
  const goodDown = m === 'weight' || m === 'waist' || m === 'hip' || m === 'body_fat' || m === 'bmi';
  const isGood = goodDown ? diff <= 0 : diff >= 0;
  return isGood ? colors.success : colors.warning;
}

function StatCard({ colors, tint, label, value, unit, metric }: any) {
  return (
    <View style={{ flex: 1, backgroundColor: tint, borderRadius: radius.md, padding: spacing.md, gap: 2 }}>
      <Text style={{ ...typography.small, color: colors.onTint, opacity: 0.75 }}>{label}</Text>
      <Text style={{ ...typography.headline, color: colors.onTint }}>
        {value != null ? `${formatVal(value, metric)}${unit ? ' ' + unit : ''}` : '—'}
      </Text>
    </View>
  );
}

function Chart({ colors, series, predicted }: { colors: ThemeColors; series: { date: string; value: number }[]; predicted?: number }) {
  const W = 320, H = 180, P = 24;
  const values = series.map(p => p.value);
  const min = Math.min(...values, predicted ?? Infinity) - 0.5;
  const max = Math.max(...values, predicted ?? -Infinity) + 0.5;
  const range = Math.max(0.1, max - min);
  const xStep = (W - P * 2) / Math.max(1, series.length - 1);
  const pts = series.map((p, i) => ({
    x: P + xStep * i,
    y: P + (H - P * 2) * (1 - (p.value - min) / range),
  }));

  // Smooth Catmull-Rom → Bezier curve (item 12 — SVG charts premium).
  const smoothPath = buildSmoothPath(pts);
  const areaPath = `${smoothPath} L ${W - P},${H - P} L ${P},${H - P} Z`;

  // Predicted marker at right
  const predY = predicted != null ? P + (H - P * 2) * (1 - (predicted - min) / range) : null;

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} testID="analytics-chart">
      {/* Baseline grid */}
      {[0.25, 0.5, 0.75].map((r, i) => (
        <Line key={i} x1={P} y1={P + (H - P * 2) * r} x2={W - P} y2={P + (H - P * 2) * r}
          stroke={colors.divider} strokeWidth={1} strokeDasharray="2,4" />
      ))}
      <Path d={areaPath} fill={colors.brandPrimary} opacity={0.18} />
      <Path d={smoothPath} fill="none" stroke={colors.brandPrimary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 5 : 2.5} fill={colors.brandPrimary} />
      ))}
      {predY != null && (
        <>
          <Line x1={pts[pts.length - 1].x} y1={pts[pts.length - 1].y} x2={W - P} y2={predY}
            stroke={colors.brandSecondary} strokeDasharray="4,4" strokeWidth={1.5} />
          <Circle cx={W - P} cy={predY} r={4} fill={colors.brandSecondary} />
        </>
      )}
    </Svg>
  );
}

/** Cardinal spline path (tension ~0.5) — smooth Bezier through the given points. */
function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;

  const t = 0.2; // tension — 0.2 gives a subtle, "premium" curve
  let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = p1.y + (p2.y - p0.y) * t;
    const c2x = p2.x - (p3.x - p1.x) * t;
    const c2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

function MiniChart({ colors, series }: { colors: ThemeColors; series: { date: string; value: number }[] }) {
  const W = 100, H = 32;
  const values = series.map(p => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const range = Math.max(0.1, max - min);
  const xStep = W / Math.max(1, series.length - 1);
  const pts = series.map((p, i) => ({ x: i * xStep, y: H - (H * (p.value - min)) / range - 2 }));
  const d = buildSmoothPath(pts);
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Path d={d} fill="none" stroke={colors.brandPrimary} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.displayMedium, color: colors.onSurface },
  sub: { ...typography.caption, color: colors.muted, marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingTop: spacing.xs },

  metricsRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.xl, height: 40, alignItems: 'center' },
  mChip: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, flexShrink: 0 },
  mChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  mChipTxt: { ...typography.caption, color: colors.onSurface },

  periodRow: { flexDirection: 'row', backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colors.border },
  pChip: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
  pChipActive: { backgroundColor: colors.brandPrimary },
  pChipTxt: { ...typography.caption, color: colors.onSurfaceSecondary },

  bigCard: { backgroundColor: colors.surfaceInverse, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.xs },
  bigLabel: { ...typography.caption, color: colors.onSurfaceInverse, opacity: 0.7 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  bigValue: { fontSize: 44, fontWeight: '700', color: colors.brandPrimary, letterSpacing: -1 },
  bigUnit: { ...typography.headline, color: colors.onSurfaceInverse, opacity: 0.7 },
  diffRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  diffPill: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  diffTxt: { ...typography.small, color: colors.onSurfaceInverse, fontWeight: '700' },
  diffMeta: { ...typography.small, color: colors.onSurfaceInverse, opacity: 0.65 },

  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.soft },
  cardTitle: { ...typography.bodyStrong, color: colors.onSurface, marginBottom: spacing.sm },
  emptyChart: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyTxt: { ...typography.caption, color: colors.muted, textAlign: 'center' },

  statsGrid: { flexDirection: 'row', gap: spacing.sm },

  trendCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  trendIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  trendLabel: { ...typography.caption, color: colors.muted },
  trendVal: { ...typography.headline, color: colors.onSurface },
  trendDivider: { height: 1, backgroundColor: colors.divider },

  compareBtn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  compareTxt: { ...typography.body, color: colors.onSurface, fontWeight: '600' },

  compareGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  miniCard: { width: '48%', backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 4 },
  miniHead: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  miniLabel: { ...typography.small, color: colors.muted },
  miniVal: { ...typography.headline, color: colors.onSurface },
  miniUnit: { ...typography.small, color: colors.muted, fontWeight: '400' },
  miniEmpty: { ...typography.headline, color: colors.muted },

  ctaBig: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: colors.brandPrimary, borderRadius: radius.pill },
  ctaBigTxt: { ...typography.body, color: colors.brandDark, fontWeight: '700' },
});
