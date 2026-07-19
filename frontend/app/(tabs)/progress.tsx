import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { colors, radius, shadow, spacing, typography } from '@/src/theme';

type WEntry = { id: string; weight_kg: number; date: string; note?: string };

export default function Progress() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WEntry[]>([]);
  const [newW, setNewW] = useState('');
  const [saving, setSaving] = useState(false);
  const [range, setRange] = useState<7 | 30 | 90>(30);

  const load = useCallback(async () => {
    try { const r = await api<{ items: WEntry[] }>('/weight?limit=180'); setEntries(r.items || []); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    const kg = parseFloat(newW.replace(',', '.'));
    if (!kg || kg < 20 || kg > 400) return;
    setSaving(true);
    try { await api('/weight', { method: 'POST', body: { weight_kg: kg } }); setNewW(''); await load(); }
    finally { setSaving(false); }
  };

  const filtered = useMemo(() => {
    // entries sorted desc — need ascending for chart
    const asc = [...entries].reverse();
    return asc.slice(-range);
  }, [entries, range]);

  const start = user?.starting_weight_kg ?? filtered[0]?.weight_kg ?? 0;
  const current = filtered.length ? filtered[filtered.length - 1].weight_kg : start;
  const goal = user?.goal_weight_kg ?? current;
  const change = +(current - start).toFixed(1);
  const towardGoal = user?.goal === 'lose' ? change < 0 : user?.goal === 'gain' ? change > 0 : true;

  return (
    <View style={styles.root} testID="progress-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={styles.header}>
          <Text style={styles.title}>Progresso</Text>
          <Text style={styles.sub}>Acompanhe sua evolução</Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Stats */}
          <View style={styles.statsRow}>
            <Stat label="Atual" value={`${current.toFixed(1)}`} unit="kg" />
            <Stat label="Meta" value={`${goal.toFixed(1)}`} unit="kg" />
            <Stat
              label="Variação"
              value={`${change > 0 ? '+' : ''}${change}`}
              unit="kg"
              highlight={change !== 0 ? (towardGoal ? colors.success : colors.warning) : undefined}
            />
          </View>

          {/* Range chips */}
          <View style={styles.rangeRow}>
            {[7, 30, 90].map(r => (
              <Pressable
                key={r}
                onPress={() => setRange(r as 7 | 30 | 90)}
                style={[styles.rangeChip, range === r && styles.rangeChipActive]}
                testID={`progress-range-${r}`}
              >
                <Text style={[styles.rangeChipTxt, range === r && { color: colors.brandDark, fontWeight: '700' }]}>{r}d</Text>
              </Pressable>
            ))}
          </View>

          {/* Chart */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Evolução do Peso</Text>
            {filtered.length < 2 ? (
              <View style={styles.emptyChart}>
                <Ionicons name="analytics-outline" size={44} color={colors.muted} />
                <Text style={styles.emptyChartTxt}>Registre mais medições para ver seu gráfico.</Text>
              </View>
            ) : (
              <WeightChart entries={filtered} goal={goal} />
            )}
          </View>

          {/* Log weight */}
          <View style={styles.logCard}>
            <Text style={styles.logTitle}>Registrar peso hoje</Text>
            <View style={styles.logRow}>
              <TextInput
                testID="progress-weight-input"
                style={styles.logInput}
                value={newW}
                onChangeText={setNewW}
                keyboardType="decimal-pad"
                placeholder="0.0"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.logUnit}>kg</Text>
              <Pressable onPress={add} disabled={saving || !newW} style={[styles.logBtn, (!newW || saving) && { opacity: 0.5 }]} testID="progress-add-weight">
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.logBtnTxt}>Salvar</Text>}
              </Pressable>
            </View>
          </View>

          {/* History */}
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>Histórico</Text>
            {entries.length === 0 ? (
              <Text style={styles.emptyChartTxt}>Nenhum registro ainda.</Text>
            ) : entries.slice(0, 10).map((e, i) => {
              const prev = entries[i + 1];
              const diff = prev ? +(e.weight_kg - prev.weight_kg).toFixed(1) : 0;
              return (
                <View key={e.id} style={styles.histRow}>
                  <Text style={styles.histDate}>{formatDate(e.date)}</Text>
                  <Text style={styles.histWeight}>{e.weight_kg.toFixed(1)} kg</Text>
                  <Text style={[styles.histDiff, { color: diff < 0 ? colors.success : diff > 0 ? colors.warning : colors.muted }]}>
                    {diff > 0 ? '+' : ''}{diff || '—'}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Stat({ label, value, unit, highlight }: { label: string; value: string; unit?: string; highlight?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text style={[styles.statVal, highlight && { color: highlight }]}>{value}</Text>
        {unit && <Text style={styles.statUnit}>{unit}</Text>}
      </View>
    </View>
  );
}

function WeightChart({ entries, goal }: { entries: WEntry[]; goal: number }) {
  const W = 320, H = 160, P = 20;
  const values = entries.map(e => e.weight_kg);
  const minV = Math.min(...values, goal) - 1;
  const maxV = Math.max(...values, goal) + 1;
  const range = Math.max(0.1, maxV - minV);
  const xStep = (W - P * 2) / Math.max(1, entries.length - 1);
  const points = entries.map((e, i) => {
    const x = P + xStep * i;
    const y = P + (H - P * 2) * (1 - (e.weight_kg - minV) / range);
    return `${x},${y}`;
  }).join(' ');
  const goalY = P + (H - P * 2) * (1 - (goal - minV) / range);
  const first = entries[0].weight_kg, last = entries[entries.length - 1].weight_kg;
  const trendY1 = P + (H - P * 2) * (1 - (first - minV) / range);
  const trendY2 = P + (H - P * 2) * (1 - (last - minV) / range);
  const areaPath = `M ${P},${H - P} L ${points.split(' ').map(p => p).join(' L ')} L ${W - P},${H - P} Z`;

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} testID="weight-chart">
      {/* goal line */}
      <Line x1={P} y1={goalY} x2={W - P} y2={goalY} stroke={colors.brandSecondary} strokeDasharray="5,4" strokeWidth={1.5} />
      {/* trend */}
      <Line x1={P} y1={trendY1} x2={W - P} y2={trendY2} stroke={colors.muted} strokeDasharray="2,3" strokeWidth={1} opacity={0.5} />
      {/* area */}
      <Path d={areaPath} fill={colors.brandTertiary} opacity={0.5} />
      {/* line */}
      <Polyline points={points} fill="none" stroke={colors.brandPrimary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {/* points */}
      {entries.map((e, i) => {
        const x = P + xStep * i;
        const y = P + (H - P * 2) * (1 - (e.weight_kg - minV) / range);
        return <Circle key={i} cx={x} cy={y} r={i === entries.length - 1 ? 4 : 2} fill={colors.brandPrimary} />;
      })}
    </Svg>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  title: { ...typography.displayMedium, color: colors.onSurface },
  sub: { ...typography.caption, color: colors.muted, marginTop: 2 },
  content: { padding: spacing.xl, gap: spacing.lg },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  statLabel: { ...typography.small, color: colors.muted },
  statVal: { ...typography.title, color: colors.onSurface },
  statUnit: { ...typography.caption, color: colors.muted },
  rangeRow: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'flex-start' },
  rangeChip: { paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  rangeChipActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary },
  rangeChipTxt: { ...typography.caption, color: colors.onSurfaceSecondary },
  chartCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.soft },
  chartTitle: { ...typography.bodyStrong, color: colors.onSurface, marginBottom: spacing.md },
  emptyChart: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyChartTxt: { ...typography.caption, color: colors.muted, textAlign: 'center' },
  logCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  logTitle: { ...typography.bodyStrong, color: colors.onSurface, marginBottom: spacing.md },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logInput: { flex: 1, ...typography.title, color: colors.onSurface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8 },
  logUnit: { ...typography.headline, color: colors.muted },
  logBtn: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: 12 },
  logBtnTxt: { color: '#fff', fontWeight: '700' },
  historyCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  historyTitle: { ...typography.bodyStrong, color: colors.onSurface, marginBottom: spacing.md },
  histRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.divider },
  histDate: { flex: 1, ...typography.body, color: colors.onSurfaceSecondary },
  histWeight: { ...typography.bodyStrong, color: colors.onSurface, minWidth: 70, textAlign: 'right' },
  histDiff: { ...typography.caption, minWidth: 60, textAlign: 'right' },
});
