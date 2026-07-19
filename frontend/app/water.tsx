import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { storage } from '@/src/utils/storage';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Entry = { id: string; amount_ml: number; date: string; created_at: string };
type History = Record<string, number>; // date -> total_ml

const REMIND_KEY = 'vt_water_reminders';

export default function Water() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { user, refresh } = useAuth();

  const [today, setToday] = useState<Entry[]>([]);
  const [totalToday, setTotalToday] = useState(0);
  const [history, setHistory] = useState<History>({});
  const [goalInput, setGoalInput] = useState<string>(String(user?.daily_water_ml_goal ?? 2000));
  const [savingGoal, setSavingGoal] = useState(false);
  const [reminders, setReminders] = useState(false);
  const goal = user?.daily_water_ml_goal ?? 2000;
  const pct = Math.min(100, (totalToday / goal) * 100);

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: Entry[]; total_ml: number }>(`/water?date=${new Date().toISOString().slice(0, 10)}`);
      setToday(r.items || []);
      setTotalToday(r.total_ml || 0);
      // History from last 30d – fetch all and group
      const all = await api<{ items: Entry[]; total_ml: number }>('/water');
      const groups: History = {};
      for (const it of (all.items || [])) {
        groups[it.date] = (groups[it.date] || 0) + it.amount_ml;
      }
      setHistory(groups);
    } catch {}
    const rem = await storage.getItem<boolean>(REMIND_KEY, false);
    setReminders(!!rem);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async (ml: number) => {
    try { await api('/water', { method: 'POST', body: { amount_ml: ml } }); load(); } catch {}
  };

  const saveGoal = async () => {
    const g = parseInt(goalInput || '0', 10);
    if (!g || g < 500 || g > 6000) return;
    setSavingGoal(true);
    try {
      await api('/profile', { method: 'PUT', body: { daily_water_ml_goal: g } });
      await refresh();
    } finally { setSavingGoal(false); }
  };

  const toggleReminders = async () => {
    const next = !reminders;
    setReminders(next);
    await storage.setItem(REMIND_KEY, next);
  };

  const days = Object.entries(history)
    .filter(([d]) => d !== new Date().toISOString().slice(0, 10))
    .sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);

  return (
    <View style={s.root} testID="water-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.back} testID="water-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title}>Hidratação</Text>
          <View style={{ width: 34 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* Hero */}
          <View style={s.hero}>
            <Ionicons name="water" size={30} color={colors.info} style={{ marginBottom: 8 }} />
            <Text style={s.heroValue}>{totalToday}<Text style={s.heroUnit}> ml</Text></Text>
            <Text style={s.heroGoal}>Meta: {goal} ml</Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${pct}%` }]} />
            </View>
            <Text style={s.heroPct}>{Math.round(pct)}% da meta diária</Text>
          </View>

          {/* Quick add */}
          <Text style={s.sectionLabel}>Registrar</Text>
          <View style={s.quickRow}>
            {[150, 200, 300, 500, 750].map(ml => (
              <Pressable key={ml} onPress={() => add(ml)} style={s.quickBtn} testID={`water-add-${ml}`}>
                <Ionicons name="add" size={16} color={colors.brandDark} />
                <Text style={s.quickTxt}>{ml} ml</Text>
              </Pressable>
            ))}
          </View>

          {/* Custom goal */}
          <Text style={s.sectionLabel}>Meta diária</Text>
          <View style={s.goalCard}>
            <TextInput style={s.goalInput} value={goalInput} onChangeText={setGoalInput}
              keyboardType="number-pad" testID="water-goal-input" placeholderTextColor={colors.muted} />
            <Text style={s.goalUnit}>ml</Text>
            <Pressable style={[s.goalBtn, savingGoal && { opacity: 0.5 }]} onPress={saveGoal} disabled={savingGoal} testID="water-goal-save">
              {savingGoal ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.goalBtnTxt}>Salvar</Text>}
            </Pressable>
          </View>

          {/* Reminders */}
          <View style={s.remBox}>
            <View style={s.remIcon}><Ionicons name="notifications" size={18} color={colors.brandDark} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.remTitle}>Lembretes</Text>
              <Text style={s.remSub}>Notificações a cada 2h (necessário build nativo)</Text>
            </View>
            <Pressable onPress={toggleReminders} testID="water-reminders-toggle"
              style={[s.switch, reminders && { backgroundColor: colors.brandPrimary }]}>
              <View style={[s.switchDot, reminders && { transform: [{ translateX: 20 }] }]} />
            </Pressable>
          </View>

          {/* Today entries */}
          {!!today.length && (
            <>
              <Text style={s.sectionLabel}>Hoje</Text>
              <View style={s.list}>
                {today.slice(0, 10).map(e => (
                  <View key={e.id} style={s.listRow}>
                    <Ionicons name="water-outline" size={18} color={colors.info} />
                    <Text style={s.listAmt}>{e.amount_ml} ml</Text>
                    <Text style={s.listTime}>{new Date(e.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* History */}
          {!!days.length && (
            <>
              <Text style={s.sectionLabel}>Histórico</Text>
              <View style={s.list}>
                {days.map(([d, ml]) => {
                  const dpct = Math.min(100, (ml / goal) * 100);
                  return (
                    <View key={d} style={s.histRow}>
                      <Text style={s.histDate}>{new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</Text>
                      <View style={s.histBarBg}>
                        <View style={[s.histBar, { width: `${dpct}%` }]} />
                      </View>
                      <Text style={s.histMl}>{ml} ml</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.headline, color: colors.onSurface },
  content: { padding: spacing.xl, gap: spacing.md },
  hero: { backgroundColor: colors.tintSky, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center' },
  heroValue: { fontSize: 44, fontWeight: '700', color: colors.onTint, letterSpacing: -1 },
  heroUnit: { fontSize: 18, color: colors.onTint, opacity: 0.7, fontWeight: '600' },
  heroGoal: { ...typography.caption, color: colors.onTint, opacity: 0.75 },
  progressTrack: { width: '100%', height: 10, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 5, marginTop: spacing.md, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.info, borderRadius: 5 },
  heroPct: { ...typography.small, color: colors.onTint, opacity: 0.7, marginTop: 6 },

  sectionLabel: { ...typography.caption, color: colors.muted, marginLeft: spacing.md, marginTop: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },

  quickRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  quickBtn: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill, flexShrink: 0 },
  quickTxt: { ...typography.caption, color: colors.brandDark, fontWeight: '700' },

  goalCard: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  goalInput: { flex: 1, ...typography.headline, color: colors.onSurface },
  goalUnit: { ...typography.body, color: colors.muted },
  goalBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.pill },
  goalBtnTxt: { color: colors.onBrandPrimary, fontWeight: '700', ...typography.caption },

  remBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  remIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  remTitle: { ...typography.bodyStrong, color: colors.onSurface },
  remSub: { ...typography.small, color: colors.muted, marginTop: 2 },
  switch: { width: 44, height: 24, borderRadius: 12, backgroundColor: colors.surfaceTertiary, padding: 2 },
  switchDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },

  list: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  listRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  listAmt: { flex: 1, ...typography.body, color: colors.onSurface, fontWeight: '600' },
  listTime: { ...typography.caption, color: colors.muted },

  histRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  histDate: { ...typography.caption, color: colors.onSurface, width: 64 },
  histBarBg: { flex: 1, height: 8, backgroundColor: colors.surfaceTertiary, borderRadius: 4, overflow: 'hidden' },
  histBar: { height: '100%', backgroundColor: colors.info, borderRadius: 4 },
  histMl: { ...typography.caption, color: colors.muted, width: 60, textAlign: 'right' },
});
