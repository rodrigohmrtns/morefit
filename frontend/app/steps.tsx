import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type StepDoc = { date: string; steps: number };

export default function Steps() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { user, refresh } = useAuth();

  const [items, setItems] = useState<StepDoc[]>([]);
  const [avg, setAvg] = useState(0);
  const [today, setToday] = useState(0);
  const [addVal, setAddVal] = useState('');
  const [goalInput, setGoalInput] = useState<string>(String(user?.daily_steps_goal ?? 8000));
  const [savingGoal, setSavingGoal] = useState(false);
  const goal = user?.daily_steps_goal ?? 8000;
  const pct = Math.min(100, (today / goal) * 100);
  const distKm = (today * 0.0007).toFixed(2);
  const kcalBurned = Math.round(today * 0.04);

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: StepDoc[]; avg: number; goal: number }>('/steps?days=14');
      const iso = new Date().toISOString().slice(0, 10);
      const t = r.items.find(x => x.date === iso);
      setToday(t?.steps || 0);
      setItems(r.items || []);
      setAvg(r.avg || 0);
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    const n = parseInt(addVal.replace(/\D/g, ''), 10);
    if (!n) return;
    try { await api('/steps', { method: 'POST', body: { steps: today + n } }); setAddVal(''); load(); } catch {}
  };

  const setExact = async (n: number) => {
    try { await api('/steps', { method: 'POST', body: { steps: n } }); load(); } catch {}
  };

  const saveGoal = async () => {
    const g = parseInt(goalInput || '0', 10);
    if (!g || g < 1000 || g > 40000) return;
    setSavingGoal(true);
    try {
      await api('/profile', { method: 'PUT', body: { daily_steps_goal: g } });
      await refresh();
    } finally { setSavingGoal(false); }
  };

  return (
    <View style={s.root} testID="steps-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={s.back} testID="steps-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title}>Passos</Text>
          <View style={{ width: 34 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* Hero */}
          <View style={s.hero}>
            <Ionicons name="footsteps" size={28} color={colors.brandPrimary} />
            <Text style={s.heroVal}>{today.toLocaleString('pt-BR')}</Text>
            <Text style={s.heroGoal}>meta: {goal.toLocaleString('pt-BR')} passos</Text>
            <View style={s.progressTrack}><View style={[s.progressFill, { width: `${pct}%` }]} /></View>
            <View style={s.heroStats}>
              <View style={{ alignItems: 'center' }}>
                <Text style={s.heroStatVal}>{distKm}</Text>
                <Text style={s.heroStatLbl}>km</Text>
              </View>
              <View style={s.heroDiv} />
              <View style={{ alignItems: 'center' }}>
                <Text style={s.heroStatVal}>{kcalBurned}</Text>
                <Text style={s.heroStatLbl}>kcal</Text>
              </View>
              <View style={s.heroDiv} />
              <View style={{ alignItems: 'center' }}>
                <Text style={s.heroStatVal}>{Math.round(pct)}%</Text>
                <Text style={s.heroStatLbl}>meta</Text>
              </View>
            </View>
          </View>

          {/* Add */}
          <Text style={s.sectionLabel}>Adicionar</Text>
          <View style={s.quickRow}>
            {[500, 1000, 2000, 5000].map(n => (
              <Pressable key={n} onPress={() => setExact(today + n)} style={s.quickBtn} testID={`steps-add-${n}`}>
                <Ionicons name="add" size={14} color={colors.brandDark} />
                <Text style={s.quickTxt}>{n.toLocaleString('pt-BR')}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.customRow}>
            <TextInput
              style={s.customInput}
              value={addVal}
              onChangeText={setAddVal}
              placeholder="Ex.: 750"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              testID="steps-custom-input"
            />
            <Pressable style={s.customBtn} onPress={add} testID="steps-add-custom">
              <Text style={s.customBtnTxt}>Somar</Text>
            </Pressable>
          </View>

          {/* Meta */}
          <Text style={s.sectionLabel}>Meta diária</Text>
          <View style={s.goalCard}>
            <TextInput style={s.goalInput} value={goalInput} onChangeText={setGoalInput}
              keyboardType="number-pad" testID="steps-goal-input" placeholderTextColor={colors.muted} />
            <Text style={s.goalUnit}>passos</Text>
            <Pressable style={s.goalBtn} onPress={saveGoal} disabled={savingGoal} testID="steps-goal-save">
              {savingGoal ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.goalBtnTxt}>Salvar</Text>}
            </Pressable>
          </View>

          {/* Smartwatch */}
          <View style={s.watchBox}>
            <View style={s.watchIcon}><Ionicons name="watch" size={20} color={colors.brandDark} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.watchTitle}>Integração com Smartwatch</Text>
              <Text style={s.watchSub}>HealthKit (iOS) e Google Fit (Android) chegam no próximo build nativo.</Text>
            </View>
            <View style={s.soonBadge}><Text style={s.soonTxt}>Em breve</Text></View>
          </View>

          {/* Histórico */}
          <View style={s.card}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>Últimos 14 dias</Text>
              <Text style={s.cardMeta}>Média: {avg.toLocaleString('pt-BR')}</Text>
            </View>
            <StepsChart colors={colors} data={items.slice(0, 14).reverse()} goal={goal} />
          </View>

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function StepsChart({ colors, data, goal }: { colors: ThemeColors; data: StepDoc[]; goal: number }) {
  const W = 320, H = 140, P = 20;
  if (!data.length) return null;
  const bw = (W - P * 2) / data.length - 4;
  const maxV = Math.max(goal + 1000, ...data.map(d => d.steps || 0));
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {data.map((d, i) => {
        const h = ((d.steps || 0) / maxV) * (H - P * 2);
        const x = P + i * (bw + 4);
        const y = H - P - h;
        const fill = (d.steps || 0) >= goal ? colors.brandPrimary : colors.muted;
        return <Rect key={i} x={x} y={y} width={bw} height={h} rx={3} fill={fill} />;
      })}
      <Rect x={P} y={H - P - (goal / maxV) * (H - P * 2)} width={W - P * 2} height={1.5} fill={colors.brandSecondary} opacity={0.7} />
    </Svg>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.headline, color: colors.onSurface },
  content: { padding: spacing.xl, gap: spacing.md },
  hero: { backgroundColor: colors.tintLavender, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center' },
  heroVal: { fontSize: 44, fontWeight: '700', color: colors.onTint, letterSpacing: -1, marginTop: 4 },
  heroGoal: { ...typography.caption, color: colors.onTint, opacity: 0.75 },
  progressTrack: { width: '100%', height: 8, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 4, marginTop: spacing.md, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#8B7FD9', borderRadius: 4 },
  heroStats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, alignItems: 'center' },
  heroStatVal: { ...typography.headline, color: colors.onTint },
  heroStatLbl: { ...typography.small, color: colors.onTint, opacity: 0.7 },
  heroDiv: { width: 1, height: 24, backgroundColor: 'rgba(0,0,0,0.1)' },

  sectionLabel: { ...typography.caption, color: colors.muted, marginLeft: spacing.md, marginTop: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  quickRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  quickBtn: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, flexShrink: 0 },
  quickTxt: { ...typography.caption, color: colors.brandDark, fontWeight: '700' },
  customRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  customInput: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, color: colors.onSurface, ...typography.body },
  customBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.lg, paddingVertical: 12, borderRadius: radius.pill },
  customBtnTxt: { color: colors.onBrandPrimary, fontWeight: '700', ...typography.caption },

  goalCard: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  goalInput: { flex: 1, ...typography.headline, color: colors.onSurface },
  goalUnit: { ...typography.body, color: colors.muted },
  goalBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.pill },
  goalBtnTxt: { color: colors.onBrandPrimary, fontWeight: '700', ...typography.caption },

  watchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  watchIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  watchTitle: { ...typography.bodyStrong, color: colors.onSurface },
  watchSub: { ...typography.small, color: colors.muted, marginTop: 2 },
  soonBadge: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  soonTxt: { ...typography.small, color: colors.brandDark, fontWeight: '700' },

  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  cardTitle: { ...typography.bodyStrong, color: colors.onSurface },
  cardMeta: { ...typography.caption, color: colors.muted },
});
