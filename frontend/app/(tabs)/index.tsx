import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { colors, radius, shadow, spacing, typography } from '@/src/theme';

type Summary = {
  date: string;
  calories: { consumed: number; goal: number; burned: number };
  macros: { protein_g: number; carbs_g: number; fat_g: number };
  water: { total_ml: number; goal_ml: number };
  weight: { weight_kg: number; date: string } | null;
  meals_count: number;
  exercises_count: number;
};

export default function Home() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Summary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const s = await api<Summary>('/dashboard/summary'); setData(s); } catch (e) { console.log(e); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const kcalGoal = data?.calories.goal ?? user?.daily_calorie_goal ?? 2000;
  const kcalConsumed = data?.calories.consumed ?? 0;
  const kcalBurned = data?.calories.burned ?? 0;
  const remaining = Math.max(0, Math.round(kcalGoal - kcalConsumed + kcalBurned));
  const progressPct = Math.min(100, (kcalConsumed / kcalGoal) * 100);

  const waterTotal = data?.water.total_ml ?? 0;
  const waterGoal = data?.water.goal_ml ?? 2000;
  const waterPct = Math.min(100, (waterTotal / waterGoal) * 100);

  const addWater = async (amt: number) => {
    try { await api('/water', { method: 'POST', body: { amount_ml: amt } }); await load(); } catch {}
  };

  return (
    <View style={styles.root} testID="home-screen">
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Olá, {user?.name?.split(' ')[0] ?? 'você'}</Text>
            <Text style={styles.subGreeting}>{formatBrDate(new Date())}</Text>
          </View>
          <Pressable style={styles.avatar} onPress={() => router.push('/(tabs)/profile')} testID="home-avatar">
            <Text style={styles.avatarTxt}>{(user?.name?.[0] ?? 'V').toUpperCase()}</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        {/* Calories main card */}
        <View style={styles.mainCard}>
          <Text style={styles.mainLabel}>Calorias restantes</Text>
          <View style={styles.mainRow}>
            <Text style={styles.mainValue}>{remaining}</Text>
            <Text style={styles.mainUnit}>kcal</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <View style={styles.mainStats}>
            <Stat label="Meta" value={`${kcalGoal}`} />
            <Stat label="Consumidas" value={`${Math.round(kcalConsumed)}`} />
            <Stat label="Exercício" value={`${Math.round(kcalBurned)}`} />
          </View>
        </View>

        {/* Macros row */}
        <View style={styles.macrosRow}>
          <MacroChip label="Proteína" value={data?.macros.protein_g ?? 0} unit="g" tint="#E07A5F" />
          <MacroChip label="Carbo" value={data?.macros.carbs_g ?? 0} unit="g" tint="#F4A261" />
          <MacroChip label="Gordura" value={data?.macros.fat_g ?? 0} unit="g" tint="#4A7258" />
        </View>

        {/* Water card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="water" size={20} color="#3B82A0" />
              <Text style={styles.cardTitle}>Hidratação</Text>
            </View>
            <Text style={styles.cardMeta}>{waterTotal} / {waterGoal} ml</Text>
          </View>
          <View style={styles.waterTrack}>
            <View style={[styles.waterFill, { width: `${waterPct}%` }]} />
          </View>
          <View style={styles.waterActions}>
            {[200, 300, 500].map(ml => (
              <Pressable key={ml} onPress={() => addWater(ml)} style={styles.waterBtn} testID={`home-water-${ml}`}>
                <Ionicons name="add" size={16} color={colors.brandDark} />
                <Text style={styles.waterBtnTxt}>{ml} ml</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Weight + Meals quick cards */}
        <View style={styles.grid}>
          <Pressable style={[styles.smallCard, { flex: 1 }]} onPress={() => router.push('/(tabs)/progress')} testID="home-weight-card">
            <View style={[styles.iconBadge, { backgroundColor: '#DCE5DF' }]}>
              <Ionicons name="scale" size={18} color={colors.brandPrimary} />
            </View>
            <Text style={styles.smallLabel}>Peso atual</Text>
            <Text style={styles.smallValue}>
              {data?.weight ? `${data.weight.weight_kg} kg` : '—'}
            </Text>
            {user?.goal_weight_kg && (
              <Text style={styles.smallMeta}>Meta: {user.goal_weight_kg} kg</Text>
            )}
          </Pressable>
          <Pressable style={[styles.smallCard, { flex: 1 }]} onPress={() => router.push('/(tabs)/food')} testID="home-meals-card">
            <View style={[styles.iconBadge, { backgroundColor: '#FCEDE4' }]}>
              <Ionicons name="restaurant" size={18} color={colors.brandSecondary} />
            </View>
            <Text style={styles.smallLabel}>Refeições hoje</Text>
            <Text style={styles.smallValue}>{data?.meals_count ?? 0}</Text>
            <Text style={styles.smallMeta}>Toque para registrar</Text>
          </Pressable>
        </View>

        {/* AI CTA */}
        <Pressable style={styles.aiCta} onPress={() => router.push('/scan')} testID="home-ai-scan-cta">
          <View style={styles.aiIcon}>
            <Ionicons name="sparkles" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTitle}>Escanear Refeição com IA</Text>
            <Text style={styles.aiSub}>Tire uma foto e obtenha macros em segundos</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#fff" />
        </Pressable>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ ...typography.small, color: colors.muted, marginBottom: 2 }}>{label}</Text>
      <Text style={{ ...typography.bodyStrong, color: colors.onSurface }}>{value}</Text>
    </View>
  );
}
function MacroChip({ label, value, unit, tint }: { label: string; value: number; unit: string; tint: string }) {
  return (
    <View style={[styles.macroCard, { borderLeftColor: tint }]}>
      <Text style={{ ...typography.small, color: colors.muted }}>{label}</Text>
      <Text style={{ ...typography.headline, color: colors.onSurface }}>{Math.round(value)}{unit}</Text>
    </View>
  );
}

function formatBrDate(d: Date): string {
  const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerSafe: { backgroundColor: colors.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  greeting: { ...typography.displayMedium, color: colors.onSurface },
  subGreeting: { ...typography.caption, color: colors.muted, marginTop: 2, textTransform: 'capitalize' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
  content: { paddingHorizontal: spacing.xl, gap: spacing.lg, paddingTop: spacing.sm },
  mainCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, ...shadow.card, borderWidth: 1, borderColor: colors.border },
  mainLabel: { ...typography.caption, color: colors.muted },
  mainRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.xs, gap: spacing.sm },
  mainValue: { fontSize: 48, fontWeight: '700', color: colors.onSurface, letterSpacing: -1 },
  mainUnit: { fontSize: 16, color: colors.muted, fontWeight: '600' },
  progressTrack: { height: 8, backgroundColor: colors.divider, borderRadius: 4, marginTop: spacing.md, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.brandPrimary, borderRadius: 4 },
  mainStats: { flexDirection: 'row', marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md },
  macrosRow: { flexDirection: 'row', gap: spacing.md },
  macroCard: {
    flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
    borderLeftWidth: 3, borderWidth: 1, borderColor: colors.border, gap: 2,
  },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.soft },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitleRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  cardTitle: { ...typography.bodyStrong, color: colors.onSurface },
  cardMeta: { ...typography.caption, color: colors.muted },
  waterTrack: { height: 10, backgroundColor: colors.divider, borderRadius: 5, marginTop: spacing.md, overflow: 'hidden' },
  waterFill: { height: '100%', backgroundColor: '#3B82A0', borderRadius: 5 },
  waterActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  waterBtn: {
    flex: 1, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.brandTertiary, borderRadius: radius.pill, paddingVertical: 10,
  },
  waterBtnTxt: { ...typography.caption, color: colors.brandDark, fontWeight: '700' },
  grid: { flexDirection: 'row', gap: spacing.md },
  smallCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: 4 },
  iconBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  smallLabel: { ...typography.caption, color: colors.muted },
  smallValue: { ...typography.title, color: colors.onSurface },
  smallMeta: { ...typography.small, color: colors.muted, marginTop: 2 },
  aiCta: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.surfaceInverse, padding: spacing.lg, borderRadius: radius.lg },
  aiIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  aiTitle: { color: '#fff', ...typography.bodyStrong },
  aiSub: { color: 'rgba(255,255,255,0.7)', ...typography.small, marginTop: 2 },
});
