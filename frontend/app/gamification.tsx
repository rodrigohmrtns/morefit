import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { radius, shadow, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Achievement = {
  id: string; name: string; desc: string; icon: string; xp: number; unlocked: boolean;
};
type Challenge = { id: string; title: string; desc: string; reward_xp: number; done: boolean };
type GamiStatus = {
  xp: number; level: number; next_level_xp: number; level_progress_pct: number; streak: number;
  achievements: Achievement[]; stats: any; challenges: Challenge[];
};
type LbItem = {
  user_id: string; name: string; avatar?: string | null; xp: number; level: number; streak: number;
  is_me: boolean; rank: number;
};

const TABS = ['Conquistas', 'Ranking'] as const;

export default function GamificationScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Conquistas');
  const [status, setStatus] = useState<GamiStatus | null>(null);
  const [lb, setLb] = useState<{ items: LbItem[]; my_rank: number | null; total_users: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [st, board] = await Promise.all([
        api<GamiStatus>('/gamification'),
        api<{ items: LbItem[]; my_rank: number | null; total_users: number }>('/gamification/leaderboard?limit=20'),
      ]);
      setStatus(st); setLb(board);
    } catch (e) { console.log(e); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const unlockedCount = status?.achievements.filter(a => a.unlocked).length ?? 0;
  const totalAch = status?.achievements.length ?? 0;

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={s.iconBtn} testID="gami-back">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title}>Gamificação</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        {/* Hero: Level + XP progress */}
        <View style={s.hero}>
          <View style={s.levelPill}>
            <Ionicons name="trophy" size={16} color={colors.brandDark} />
            <Text style={s.levelPillTxt}>Nível {status?.level ?? 1}</Text>
          </View>
          <Text style={s.xpBig}>{status?.xp ?? 0}<Text style={s.xpUnit}> XP</Text></Text>
          <View style={s.xpBar}>
            <View style={[s.xpFill, { width: `${status?.level_progress_pct ?? 0}%` }]} />
          </View>
          <View style={s.xpMetaRow}>
            <Text style={s.xpMeta}>Próximo nível: {status?.next_level_xp ?? 50} XP</Text>
            <View style={s.streakChip}>
              <Ionicons name="flame" size={12} color={'#FF6B70'} />
              <Text style={s.streakTxt}>{status?.streak ?? 0} dias</Text>
            </View>
          </View>
        </View>

        {/* Daily challenges */}
        {(status?.challenges?.length ?? 0) > 0 && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>Desafios de hoje</Text>
            {status!.challenges.map((c, i) => (
              <View key={c.id} style={[s.chRow, i < status!.challenges.length - 1 && s.rowDivider]}>
                <View style={[s.chIcon, { backgroundColor: c.done ? colors.brandPrimary : colors.surfaceTertiary }]}>
                  <Ionicons name={c.done ? 'checkmark' : 'ellipse-outline'} size={16} color={c.done ? colors.brandDark : colors.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.chTitle}>{c.title}</Text>
                  <Text style={s.chDesc}>{c.desc}</Text>
                </View>
                <View style={s.rewardPill}><Text style={s.rewardTxt}>+{c.reward_xp} XP</Text></View>
              </View>
            ))}
          </View>
        )}

        {/* Tabs */}
        <View style={s.tabs}>
          {TABS.map(t => (
            <Pressable key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)} testID={`gami-tab-${t}`}>
              <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'Conquistas' ? (
          <>
            <View style={s.summaryRow}>
              <View style={s.summaryBox}>
                <Text style={s.summaryVal}>{unlockedCount}/{totalAch}</Text>
                <Text style={s.summaryLbl}>Desbloqueadas</Text>
              </View>
              <View style={s.summaryBox}>
                <Text style={s.summaryVal}>{status?.streak ?? 0}🔥</Text>
                <Text style={s.summaryLbl}>Sequência</Text>
              </View>
              <View style={s.summaryBox}>
                <Text style={s.summaryVal}>{status?.stats?.weight_loss_kg ?? 0}</Text>
                <Text style={s.summaryLbl}>kg perdidos</Text>
              </View>
            </View>

            <View style={s.achGrid}>
              {(status?.achievements ?? []).map(a => (
                <View key={a.id} style={[s.achCard, !a.unlocked && s.achLocked]}>
                  <View style={[s.achIcon, { backgroundColor: a.unlocked ? colors.brandPrimary : colors.surfaceTertiary }]}>
                    <Ionicons name={a.icon as any} size={22} color={a.unlocked ? colors.brandDark : colors.muted} />
                  </View>
                  <Text style={[s.achName, !a.unlocked && { color: colors.muted }]}>{a.name}</Text>
                  <Text style={s.achDesc} numberOfLines={2}>{a.desc}</Text>
                  <View style={[s.achXp, { backgroundColor: a.unlocked ? colors.brandTertiary : colors.surfaceTertiary }]}>
                    <Text style={[s.achXpTxt, { color: a.unlocked ? colors.onBrandTertiary : colors.muted }]}>+{a.xp} XP</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            {lb?.my_rank && (
              <View style={s.myRankCard}>
                <Ionicons name="ribbon" size={18} color={colors.brandDark} />
                <Text style={s.myRankTxt}>
                  Você está em <Text style={{ fontWeight: '800' }}>#{lb.my_rank}</Text> de {lb.total_users} usuários
                </Text>
              </View>
            )}
            <View style={s.card}>
              {(lb?.items ?? []).map((u, i) => (
                <View key={u.user_id} style={[s.lbRow, i < (lb?.items.length ?? 0) - 1 && s.rowDivider, u.is_me && s.lbMe]}>
                  <View style={[s.rankBadge, u.rank <= 3 && s.rankTop]}>
                    <Text style={[s.rankTxt, u.rank <= 3 && { color: colors.brandDark }]}>
                      {u.rank === 1 ? '🥇' : u.rank === 2 ? '🥈' : u.rank === 3 ? '🥉' : `#${u.rank}`}
                    </Text>
                  </View>
                  <View style={s.lbAvatar}>
                    {u.avatar ? (
                      <Image source={{ uri: `data:image/jpeg;base64,${u.avatar}` }} style={{ width: 40, height: 40 }} contentFit="cover" />
                    ) : (
                      <Text style={s.lbAvatarTxt}>{(u.name[0] ?? '?').toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.lbName, u.is_me && { fontWeight: '800' }]} numberOfLines={1}>
                      {u.name}{u.is_me ? ' (você)' : ''}
                    </Text>
                    <Text style={s.lbSub}>Nível {u.level} • 🔥 {u.streak} dias</Text>
                  </View>
                  <Text style={s.lbXp}>{u.xp} XP</Text>
                </View>
              ))}
              {(lb?.items?.length ?? 0) === 0 && (
                <Text style={s.emptyTxt}>Nenhum usuário no ranking ainda</Text>
              )}
            </View>
          </>
        )}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.title, color: colors.onSurface },
  content: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingTop: spacing.xs },

  hero: { backgroundColor: colors.surfaceInverse, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm },
  levelPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  levelPillTxt: { ...typography.caption, color: colors.brandDark, fontWeight: '800' },
  xpBig: { fontSize: 52, fontWeight: '800', color: colors.brandPrimary, letterSpacing: -1.5, marginTop: spacing.xs },
  xpUnit: { fontSize: 20, color: colors.onSurfaceInverse, opacity: 0.7 },
  xpBar: { height: 10, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 5, overflow: 'hidden', marginTop: spacing.xs },
  xpFill: { height: '100%', backgroundColor: colors.brandPrimary, borderRadius: 5 },
  xpMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  xpMeta: { ...typography.small, color: colors.onSurfaceInverse, opacity: 0.75 },
  streakChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,107,112,0.15)', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  streakTxt: { color: '#FF9B9F', ...typography.small, fontWeight: '700' },

  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadow.card },
  sectionLabel: { ...typography.caption, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm, paddingHorizontal: spacing.xs },

  chRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  chIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chTitle: { ...typography.bodyStrong, color: colors.onSurface },
  chDesc: { ...typography.small, color: colors.muted, marginTop: 2 },
  rewardPill: { backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  rewardTxt: { ...typography.small, color: colors.onBrandTertiary, fontWeight: '800' },

  tabs: { flexDirection: 'row', backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.brandPrimary },
  tabTxt: { ...typography.caption, color: colors.onSurface, fontWeight: '600' },
  tabTxtActive: { color: colors.brandDark, fontWeight: '800' },

  summaryRow: { flexDirection: 'row', gap: spacing.sm },
  summaryBox: { flex: 1, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  summaryVal: { ...typography.title, color: colors.onSurface },
  summaryLbl: { ...typography.small, color: colors.muted, marginTop: 2 },

  achGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  achCard: { width: '48.5%', backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: 4, borderWidth: 1, borderColor: colors.border },
  achLocked: { opacity: 0.55 },
  achIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  achName: { ...typography.bodyStrong, color: colors.onSurface },
  achDesc: { ...typography.small, color: colors.muted, minHeight: 30 },
  achXp: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, marginTop: spacing.xs },
  achXpTxt: { ...typography.small, fontWeight: '800' },

  myRankCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.md },
  myRankTxt: { ...typography.body, color: colors.brandDark, flex: 1 },

  lbRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
  lbMe: { backgroundColor: colors.brandTertiary, marginHorizontal: -spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, borderBottomWidth: 0 },
  rankBadge: { width: 44, height: 32, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  rankTop: { backgroundColor: colors.brandPrimary },
  rankTxt: { fontSize: 14, fontWeight: '800', color: colors.onSurface },
  lbAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  lbAvatarTxt: { color: colors.onBrandPrimary, fontWeight: '700' },
  lbName: { ...typography.bodyStrong, color: colors.onSurface },
  lbSub: { ...typography.small, color: colors.muted, marginTop: 1 },
  lbXp: { ...typography.bodyStrong, color: colors.brandDark, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, fontSize: 12 },
  emptyTxt: { textAlign: 'center', color: colors.muted, ...typography.body, padding: spacing.lg },
});
