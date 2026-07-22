/**
 * Timeline — vertical daily activity feed with calendar month navigation.
 *
 * Route: /timeline
 *
 * Layout:
 *   [Back]           Timeline
 *
 *   ‹  junho 2026  ›
 *   [Dom] [Seg] [Ter] [Qua] [Qui] [Sex] [Sáb]
 *   [ 1] [ 2] [ 3] [ 4] [ 5] [ 6] [ 7]        <-- days with dots indicating logs
 *   ...
 *
 *   Selected day summary:  245 kcal • 1.2L água • 45min ex
 *
 *   ⏰ 07:30  Peso  84.2 kg   IMC 26.1
 *   ⏰ 08:00  Refeição  Aveia com frutas   320 kcal
 *   ⏰ 12:30  Água  +300 ml
 *   ...
 */
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { BackButton } from '@/src/components/back-button';
import { EmptyState } from '@/src/components/empty-state';
import { Skeleton, SkeletonList } from '@/src/components/skeleton';
import { ThemedRefreshControl, usePullRefresh } from '@/src/components/refresh';
import { toast } from '@/src/components/toast';
import { radius, shadow, spacing, ThemeColors, typography, useTheme } from '@/src/theme';
import { haptic } from '@/src/utils/haptic';

type Counts = {
  weight: number; meal: number; water: number; exercise: number;
  sleep: number; photo: number; mood: number; fasting: number;
};
type Totals = {
  water_ml: number; exercise_min: number; exercise_kcal: number; calories: number;
};
type DayCell = { date: string; counts: Counts; totals: Totals };
type MonthResp = { ym: string; days: DayCell[] };

type TimelineEvent = {
  kind: 'weight' | 'meal' | 'water' | 'exercise' | 'sleep' | 'mood' | 'photo' | 'fasting';
  time: string; title: string; detail: string; raw: any;
};
type DayResp = {
  date: string;
  summary: { water_ml: number; calories: number; exercise_min: number; exercise_kcal: number; logs_count: number };
  events: TimelineEvent[];
};

const MONTHS_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WEEKDAYS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function ymOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function dateOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseISO(iso: string): Date {
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(y, m - 1, day);
}

const EVENT_META: Record<TimelineEvent['kind'], { icon: keyof typeof Feather.glyphMap; label: string; tintKey: keyof ThemeColors }> = {
  weight:   { icon: 'activity', label: 'Peso', tintKey: 'tintCoral' },
  meal:     { icon: 'coffee',   label: 'Refeição', tintKey: 'tintButter' },
  water:    { icon: 'droplet',  label: 'Água', tintKey: 'tintSky' },
  exercise: { icon: 'zap',      label: 'Exercício', tintKey: 'tintMint' },
  sleep:    { icon: 'moon',     label: 'Sono', tintKey: 'tintLavender' },
  mood:     { icon: 'smile',    label: 'Humor', tintKey: 'tintPeach' },
  photo:    { icon: 'camera',   label: 'Foto', tintKey: 'tintButter' },
  fasting:  { icon: 'clock',    label: 'Jejum', tintKey: 'tintSky' },
};

export default function TimelineScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(dateOf(today));

  const [month, setMonth] = useState<MonthResp | null>(null);
  const [day, setDay] = useState<DayResp | null>(null);
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [loadingDay, setLoadingDay] = useState(true);

  const loadMonth = useCallback(async () => {
    try {
      setLoadingMonth(true);
      const r = await api<MonthResp>(`/timeline/month?ym=${ymOf(cursor)}`);
      setMonth(r);
    } catch {
      toast.error('Erro', 'Não foi possível carregar o mês.');
    } finally { setLoadingMonth(false); }
  }, [cursor]);

  const loadDay = useCallback(async () => {
    try {
      setLoadingDay(true);
      const r = await api<DayResp>(`/timeline/day?date=${selected}`);
      setDay(r);
    } catch {
      toast.error('Erro', 'Não foi possível carregar o dia.');
    } finally { setLoadingDay(false); }
  }, [selected]);

  useEffect(() => { loadMonth(); }, [loadMonth]);
  useEffect(() => { loadDay(); }, [loadDay]);

  const { refreshing, onRefresh } = usePullRefresh(async () => {
    await Promise.all([loadMonth(), loadDay()]);
  });

  const prevMonth = () => { haptic.tap(); setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)); };
  const nextMonth = () => { haptic.tap(); setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)); };
  const goToday = () => { haptic.tap(); const t = new Date(); setCursor(new Date(t.getFullYear(), t.getMonth(), 1)); setSelected(dateOf(t)); };

  // Build calendar grid (rows of 7 days, first row padded to weekday of day 1)
  const grid: (DayCell | null)[][] = useMemo(() => {
    const year = cursor.getFullYear();
    const monthIdx = cursor.getMonth();
    const first = new Date(year, monthIdx, 1);
    const startWeekday = first.getDay();
    const daysMap = new Map((month?.days ?? []).map(d => [d.date, d]));
    const cells: (DayCell | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    const totalDays = new Date(year, monthIdx + 1, 0).getDate();
    for (let d = 1; d <= totalDays; d++) {
      const iso = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push(daysMap.get(iso) ?? { date: iso, counts: emptyCounts(), totals: emptyTotals() });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (DayCell | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cursor, month]);

  const monthLabel = `${MONTHS_PT[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const selectedDate = parseISO(selected);
  const selectedLabel = selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <BackButton />
          <Text style={s.title}>Timeline</Text>
          <Pressable onPress={goToday} hitSlop={12} accessibilityRole="button" accessibilityLabel="Ir para hoje">
            <Text style={s.todayBtn}>Hoje</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Month navigator */}
        <View style={s.monthNav}>
          <Pressable onPress={prevMonth} style={s.navBtn} accessibilityRole="button" accessibilityLabel="Mês anterior">
            <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
          </Pressable>
          <Text style={s.monthLabel}>{monthLabel}</Text>
          <Pressable onPress={nextMonth} style={s.navBtn} accessibilityRole="button" accessibilityLabel="Próximo mês">
            <Ionicons name="chevron-forward" size={20} color={colors.onSurface} />
          </Pressable>
        </View>

        {/* Weekday header */}
        <View style={s.weekRow}>
          {WEEKDAYS_PT.map((w, i) => (
            <Text key={i} style={s.weekTxt}>{w}</Text>
          ))}
        </View>

        {/* Calendar grid */}
        {loadingMonth && !month ? (
          <View style={{ gap: spacing.xs }}>
            {[0, 1, 2, 3, 4].map(i => (
              <View key={i} style={{ flexDirection: 'row', gap: 4 }}>
                {[0, 1, 2, 3, 4, 5, 6].map(j => <View key={j} style={{ flex: 1 }}><Skeleton height={44} radius={10} /></View>)}
              </View>
            ))}
          </View>
        ) : (
          <View style={{ gap: 4 }}>
            {grid.map((row, i) => (
              <View key={i} style={s.dayRow}>
                {row.map((cell, j) => {
                  if (!cell) return <View key={j} style={s.dayEmpty} />;
                  const isSelected = cell.date === selected;
                  const isToday = cell.date === dateOf(today);
                  const dayNum = Number(cell.date.slice(-2));
                  const hasLogs = Object.values(cell.counts).some(v => (v as number) > 0);
                  const dots = buildDots(cell.counts, colors);
                  return (
                    <Pressable
                      key={j}
                      onPress={() => { haptic.tap(); setSelected(cell.date); }}
                      style={[
                        s.dayCell,
                        isSelected && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
                        !isSelected && isToday && { borderColor: colors.brandPrimary, borderWidth: 2 },
                      ]}
                      testID={`timeline-day-${cell.date}`}
                    >
                      <Text style={[s.dayNum, isSelected && { color: colors.onBrandPrimary, fontWeight: '700' }]}>{dayNum}</Text>
                      {hasLogs && (
                        <View style={s.dotsRow}>
                          {dots.slice(0, 4).map((c, k) => (
                            <View key={k} style={[s.dot, { backgroundColor: isSelected ? colors.onBrandPrimary : c }]} />
                          ))}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        {/* Selected day heading */}
        <View style={s.dayHeader}>
          <Text style={s.dayHeaderLabel}>{capitalize(selectedLabel)}</Text>
          {day && day.summary.logs_count > 0 && (
            <View style={s.summaryRow}>
              {day.summary.calories > 0 && <Chip icon="coffee" label={`${day.summary.calories} kcal`} tint={colors.tintButter} colors={colors} />}
              {day.summary.water_ml > 0 && <Chip icon="droplet" label={`${day.summary.water_ml} ml`} tint={colors.tintSky} colors={colors} />}
              {day.summary.exercise_min > 0 && <Chip icon="zap" label={`${day.summary.exercise_min} min`} tint={colors.tintMint} colors={colors} />}
            </View>
          )}
        </View>

        {/* Events */}
        {loadingDay && !day ? (
          <SkeletonList count={3} />
        ) : day && day.events.length > 0 ? (
          <View style={s.timeline}>
            {day.events.map((ev, i) => {
              const meta = EVENT_META[ev.kind];
              const tint = colors[meta.tintKey] as string;
              const isLast = i === day.events.length - 1;
              return (
                <View key={`${ev.kind}-${i}`} style={s.evRow}>
                  <View style={s.evGutter}>
                    <View style={[s.evNode, { backgroundColor: tint }]}>
                      <Feather name={meta.icon} size={16} color={colors.onTint} />
                    </View>
                    {!isLast && <View style={[s.evLine, { backgroundColor: colors.divider }]} />}
                  </View>
                  <View style={[s.evCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                    <View style={s.evHead}>
                      <Text style={s.evTime}>{ev.time}</Text>
                      <Text style={s.evKind}>{meta.label}</Text>
                    </View>
                    <Text style={s.evTitle}>{ev.title}</Text>
                    {!!ev.detail && <Text style={s.evDetail}>{ev.detail}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState
            variant="timeline"
            title="Nenhum registro neste dia"
            body="Toque em algum dia com marcadores para ver detalhes, ou registre uma atividade agora."
            cta="Voltar para o início"
            onPressCta={() => router.push('/(tabs)/')}
          />
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function emptyCounts(): Counts {
  return { weight: 0, meal: 0, water: 0, exercise: 0, sleep: 0, photo: 0, mood: 0, fasting: 0 };
}
function emptyTotals(): Totals {
  return { water_ml: 0, exercise_min: 0, exercise_kcal: 0, calories: 0 };
}
function buildDots(c: Counts, colors: ThemeColors): string[] {
  const out: string[] = [];
  if (c.meal) out.push(colors.brandPrimary);
  if (c.water) out.push(colors.info);
  if (c.exercise) out.push(colors.success);
  if (c.weight || c.photo) out.push(colors.brandSecondary);
  if (c.sleep) out.push(colors.warning);
  return out;
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Chip({ icon, label, tint, colors }: { icon: any; label: string; tint: string; colors: ThemeColors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: tint, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill }}>
      <Feather name={icon} size={12} color={colors.onTint} />
      <Text style={{ ...typography.small, color: colors.onTint, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
  },
  title: { ...typography.title, color: colors.onSurface },
  todayBtn: { ...typography.caption, color: colors.brandDark, fontWeight: '700', backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, overflow: 'hidden' },

  content: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingTop: spacing.sm },

  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  monthLabel: { ...typography.headline, color: colors.onSurface, textTransform: 'capitalize' },

  weekRow: { flexDirection: 'row', paddingVertical: spacing.xs },
  weekTxt: { flex: 1, textAlign: 'center', ...typography.small, color: colors.muted, fontWeight: '700' },

  dayRow: { flexDirection: 'row', gap: 4 },
  dayEmpty: { flex: 1, aspectRatio: 1 },
  dayCell: {
    flex: 1, aspectRatio: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    gap: 2, padding: 4,
  },
  dayNum: { ...typography.caption, color: colors.onSurface, fontWeight: '600' },
  dotsRow: { flexDirection: 'row', gap: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },

  dayHeader: { marginTop: spacing.lg, gap: spacing.sm },
  dayHeaderLabel: { ...typography.headline, color: colors.onSurface },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  timeline: { gap: 0, marginTop: spacing.sm },
  evRow: { flexDirection: 'row', gap: spacing.md },
  evGutter: { alignItems: 'center', width: 32 },
  evNode: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  evLine: { width: 2, flex: 1, marginTop: 4 },
  evCard: {
    flex: 1, marginBottom: spacing.sm, padding: spacing.md,
    borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, ...shadow.soft,
  },
  evHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  evTime: { ...typography.small, color: colors.muted, fontWeight: '700' },
  evKind: { ...typography.small, color: colors.brandDark, backgroundColor: colors.brandTertiary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', fontWeight: '700' },
  evTitle: { ...typography.bodyStrong, color: colors.onSurface, marginTop: 2 },
  evDetail: { ...typography.caption, color: colors.muted, marginTop: 2 },
});
