import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { radius, shadow, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Metric = 'water_ml' | 'steps' | 'sleep_hours' | 'weight_loss_kg' | 'exercise_min' | 'meals_count';

type Campaign = {
  id: string; company_id: string; title: string; description?: string; metric: Metric;
  target_value: number; start_date: string; end_date: string;
  joined: boolean; my_progress: number; progress_pct: number;
};

type RankItem = {
  user_id: string; name: string; avatar?: string | null; progress: number; progress_pct: number;
  rank: number; is_me: boolean;
};

const METRIC_META: Record<Metric, { label: string; unit: string; icon: any; format: (v: number) => string }> = {
  water_ml: { label: 'Hidratação', unit: 'ml', icon: 'water', format: v => `${(v / 1000).toFixed(1)}L` },
  steps: { label: 'Passos', unit: 'passos', icon: 'footsteps', format: v => `${v}` },
  sleep_hours: { label: 'Horas de sono', unit: 'h', icon: 'moon', format: v => `${v}h` },
  weight_loss_kg: { label: 'Perda de peso', unit: 'kg', icon: 'arrow-down', format: v => `${v.toFixed(1)}kg` },
  exercise_min: { label: 'Exercício', unit: 'min', icon: 'flame', format: v => `${v}min` },
  meals_count: { label: 'Refeições', unit: 'ref.', icon: 'restaurant', format: v => `${v} ref.` },
};

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [camp, setCamp] = useState<Campaign | null>(null);
  const [ranking, setRanking] = useState<{ items: RankItem[]; my_rank: number | null; target: number; metric: Metric } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [c, r] = await Promise.all([
        api<Campaign>(`/campaigns/${id}`),
        api<{ items: RankItem[]; my_rank: number | null; target: number; metric: Metric }>(`/campaigns/${id}/ranking`),
      ]);
      setCamp(c); setRanking(r);
    } catch (e) { console.log(e); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const toggleJoin = async () => {
    if (!camp) return;
    setBusy(true);
    try {
      if (camp.joined) await api(`/campaigns/${camp.id}/leave`, { method: 'POST' });
      else await api(`/campaigns/${camp.id}/join`, { method: 'POST' });
      await load();
    } catch (e: any) { Alert.alert('Erro', e?.message || 'Falha'); }
    finally { setBusy(false); }
  };

  if (!camp) {
    return <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={colors.brandPrimary} /></View>;
  }

  const meta = METRIC_META[camp.metric];
  const daysLeft = Math.max(0, Math.ceil((new Date(camp.end_date).getTime() - Date.now()) / (86400000)));

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.iconBtn} testID="camp-back">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title} numberOfLines={1}>Campanha</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        <View style={s.hero}>
          <View style={s.heroIcon}><Ionicons name={meta.icon} size={26} color={colors.brandDark} /></View>
          <Text style={s.heroTitle}>{camp.title}</Text>
          {!!camp.description && <Text style={s.heroDesc}>{camp.description}</Text>}
          <View style={s.heroChips}>
            <View style={s.chip}><Ionicons name="calendar" size={12} color={colors.brandPrimary} /><Text style={s.chipTxt}>{daysLeft} dias restantes</Text></View>
            <View style={s.chip}><Ionicons name="flag" size={12} color={colors.brandPrimary} /><Text style={s.chipTxt}>Meta: {meta.format(camp.target_value)}</Text></View>
          </View>
        </View>

        {/* My progress card */}
        <View style={s.progressCard}>
          <Text style={s.progressLbl}>Meu progresso</Text>
          <View style={s.progressRow}>
            <Text style={s.progressVal}>{meta.format(camp.my_progress)}</Text>
            <Text style={s.progressPct}>{camp.progress_pct}%</Text>
          </View>
          <View style={s.bar}><View style={[s.barFill, { width: `${Math.min(100, camp.progress_pct)}%` }]} /></View>
          <Text style={s.progressSub}>Meta: {meta.format(camp.target_value)} • {formatBR(camp.start_date)} → {formatBR(camp.end_date)}</Text>
        </View>

        <Pressable
          style={[s.joinBtn, camp.joined && s.joinBtnJoined, busy && { opacity: 0.6 }]}
          onPress={toggleJoin}
          disabled={busy}
          testID="camp-toggle-join"
        >
          {busy ? <ActivityIndicator color={camp.joined ? colors.onSurface : colors.brandDark} /> : (
            <>
              <Ionicons name={camp.joined ? 'checkmark-circle' : 'add-circle'} size={20} color={camp.joined ? colors.onSurface : colors.brandDark} />
              <Text style={[s.joinTxt, camp.joined && { color: colors.onSurface }]}>{camp.joined ? 'Participando (sair)' : 'Participar do desafio'}</Text>
            </>
          )}
        </Pressable>

        {/* Ranking */}
        <Text style={s.sectionLbl}>Ranking da campanha</Text>
        {ranking?.my_rank && (
          <View style={s.myRankCard}>
            <Ionicons name="ribbon" size={16} color={colors.brandDark} />
            <Text style={s.myRankTxt}>Você está em #{ranking.my_rank} de {ranking.items.length}</Text>
          </View>
        )}
        <View style={s.rankCard}>
          {(ranking?.items ?? []).length === 0 && (
            <Text style={s.emptyTxt}>Ninguém participando ainda. Seja o primeiro!</Text>
          )}
          {(ranking?.items ?? []).map((u, i) => (
            <View key={u.user_id} style={[s.lbRow, i < (ranking?.items.length ?? 0) - 1 && s.rowDivider, u.is_me && s.lbMe]}>
              <View style={[s.rankBadge, u.rank <= 3 && s.rankTop]}>
                <Text style={s.rankTxt}>{u.rank === 1 ? '🥇' : u.rank === 2 ? '🥈' : u.rank === 3 ? '🥉' : `#${u.rank}`}</Text>
              </View>
              <View style={s.avatar}><Text style={s.avatarTxt}>{(u.name[0] ?? '?').toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[s.name, u.is_me && { fontWeight: '800' }]} numberOfLines={1}>{u.name}{u.is_me ? ' (você)' : ''}</Text>
                <View style={s.miniBar}><View style={[s.miniBarFill, { width: `${Math.min(100, u.progress_pct)}%` }]} /></View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.progressVal2}>{meta.format(u.progress)}</Text>
                <Text style={s.progressPct2}>{u.progress_pct}%</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

function formatBR(iso: string): string {
  try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); } catch { return iso; }
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.title, color: colors.onSurface },
  content: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingTop: spacing.xs },

  hero: { backgroundColor: colors.surfaceInverse, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, alignItems: 'center' },
  heroIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { ...typography.title, color: colors.onSurfaceInverse, textAlign: 'center' },
  heroDesc: { ...typography.body, color: colors.onSurfaceInverse, opacity: 0.75, textAlign: 'center' },
  heroChips: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(198,241,75,0.15)', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  chipTxt: { ...typography.small, color: colors.brandPrimary, fontWeight: '700' },

  progressCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  progressLbl: { ...typography.caption, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  progressRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacing.xs },
  progressVal: { fontSize: 32, fontWeight: '800', color: colors.onSurface, letterSpacing: -1 },
  progressPct: { ...typography.title, color: colors.brandDark, fontWeight: '800' },
  bar: { height: 10, backgroundColor: colors.divider, borderRadius: 5, marginTop: spacing.sm, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.brandPrimary, borderRadius: 5 },
  progressSub: { ...typography.small, color: colors.muted, marginTop: spacing.sm },

  joinBtn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.md },
  joinBtnJoined: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  joinTxt: { ...typography.bodyStrong, color: colors.brandDark },

  sectionLbl: { ...typography.caption, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.sm },
  myRankCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.brandPrimary, padding: spacing.sm, borderRadius: radius.md, paddingHorizontal: spacing.md },
  myRankTxt: { ...typography.body, color: colors.brandDark, fontWeight: '600' },
  rankCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  emptyTxt: { ...typography.body, color: colors.muted, textAlign: 'center', padding: spacing.lg },
  lbRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  lbMe: { backgroundColor: colors.brandTertiary },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rankBadge: { width: 40, height: 30, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  rankTop: { backgroundColor: colors.brandPrimary },
  rankTxt: { fontSize: 13, fontWeight: '800', color: colors.onSurface },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: colors.onBrandPrimary, fontWeight: '700' },
  name: { ...typography.bodyStrong, color: colors.onSurface },
  miniBar: { height: 4, backgroundColor: colors.divider, borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  miniBarFill: { height: '100%', backgroundColor: colors.brandPrimary, borderRadius: 2 },
  progressVal2: { ...typography.bodyStrong, color: colors.onSurface, fontSize: 13 },
  progressPct2: { ...typography.small, color: colors.brandDark, fontWeight: '700' },
});
