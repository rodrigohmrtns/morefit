import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing,
  FadeInDown,
} from 'react-native-reanimated';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { useLocale } from '@/src/i18n';
import { useOnline } from '@/src/hooks/use-online';
import { haptic } from '@/src/utils/haptic';
import { radius, shadow, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Summary = {
  date: string;
  calories: { consumed: number; goal: number; burned: number };
  macros: { protein_g: number; carbs_g: number; fat_g: number };
  water: { total_ml: number; goal_ml: number };
  weight: { current_kg: number | null; starting_kg: number | null; goal_kg: number | null };
  bmi: number | null;
  days_remaining: number | null;
  steps: { count: number; goal: number };
  sleep: { last_hours: number | null; goal_hours: number };
  exercises: { count: number; minutes: number; burned: number };
  meals_count: number;
  photos: { id: string; date: string; weight_kg?: number }[];
};

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const { t, locale } = useLocale();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const BMI_LABEL = useCallback((bmi: number) => {
    if (bmi < 18.5) return t('home.bmiUnder');
    if (bmi < 25) return t('home.bmiHealthy');
    if (bmi < 30) return t('home.bmiOver');
    return t('home.bmiObese');
  }, [t]);
  const online = useOnline();
  const qc = useQueryClient();

  // Dashboard summary — main source of truth for Home
  const dashQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api<Summary>('/dashboard/summary'),
    staleTime: 30 * 1000,
  });
  const data = dashQuery.data;
  const refreshing = dashQuery.isRefetching;

  // Daily motivation quote — refetch once per day
  const quoteQuery = useQuery({
    queryKey: ['motivation'],
    queryFn: () => api<{ quote: string }>('/motivation'),
    staleTime: 60 * 60 * 1000,
  });
  const quote = quoteQuery.data?.quote ?? '';

  // Re-fetch on tab focus (respects staleTime — instant if fresh)
  useFocusEffect(useCallback(() => {
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  }, [qc]));

  const onRefresh = async () => {
    await Promise.all([dashQuery.refetch(), quoteQuery.refetch()]);
  };

  const kcalGoal = data?.calories.goal ?? user?.daily_calorie_goal ?? 2000;
  const kcalConsumed = data?.calories.consumed ?? 0;
  const kcalBurned = data?.calories.burned ?? 0;
  const remaining = Math.max(0, Math.round(kcalGoal - kcalConsumed + kcalBurned));
  const progressPct = Math.min(100, (kcalConsumed / kcalGoal) * 100);

  const waterTotal = data?.water.total_ml ?? 0;
  const waterGoal = data?.water.goal_ml ?? 2000;
  const waterPct = Math.min(100, (waterTotal / waterGoal) * 100);

  const steps = data?.steps.count ?? 0;
  const stepsGoal = data?.steps.goal ?? 8000;
  const stepsPct = Math.min(100, (steps / stepsGoal) * 100);

  // Optimistic add-water: bumps `data.water.total_ml` in cache immediately,
  // then reconciles with server. Rolls back on error.
  const addWaterMut = useMutation({
    mutationFn: (amount_ml: number) => api('/water', { method: 'POST', body: { amount_ml } }),
    onMutate: async (amount_ml: number) => {
      await qc.cancelQueries({ queryKey: ['dashboard', 'summary'] });
      const prev = qc.getQueryData<Summary>(['dashboard', 'summary']);
      if (prev) {
        qc.setQueryData<Summary>(['dashboard', 'summary'], {
          ...prev,
          water: { ...prev.water, total_ml: prev.water.total_ml + amount_ml },
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['dashboard', 'summary'], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] }),
  });

  const addWater = (amt: number) => { haptic.tap(); addWaterMut.mutate(amt); };

  // Subtle pulse for premium AI buttons (item 10 — UX premium)
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.03, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={s.root} testID="home-screen">
      <SafeAreaView edges={['top']} style={s.headerSafe}>
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{t('home.greeting')}, {user?.name?.split(' ')[0] ?? 'you'}</Text>
            <Text style={s.subGreeting}>{formatDate(new Date(), locale)}</Text>
          </View>
          <Pressable style={s.avatar} onPress={() => router.push('/(tabs)/profile')} testID="home-avatar">
            {user?.photo_base64 ? (
              <Image source={{ uri: `data:image/jpeg;base64,${user.photo_base64}` }} style={s.avatarImg} contentFit="cover" />
            ) : (
              <Text style={s.avatarTxt}>{(user?.name?.[0] ?? 'V').toUpperCase()}</Text>
            )}
          </Pressable>
        </View>
        {!online && (
          <View style={s.offlineBar} testID="home-offline-bar">
            <Ionicons name="cloud-offline" size={14} color={colors.warning} />
            <Text style={s.offlineTxt}>{t('common.offline')}</Text>
          </View>
        )}
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        {/* Motivational quote */}
        {!!quote && (
          <View style={s.quoteBox} testID="home-quote">
            <Ionicons name="sparkles" size={16} color={colors.brandDark} />
            <Text style={s.quoteTxt}>{quote}</Text>
          </View>
        )}

        {/* Hero: Weight + Meta + Days remaining */}
        <View style={s.heroCard}>
          <View style={s.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroLabel}>{t('home.weightCurrent')}</Text>
              <Text style={s.heroValue}>
                {data?.weight.current_kg ? data.weight.current_kg.toFixed(1) : '—'}
                <Text style={s.heroUnit}> kg</Text>
              </Text>
              <Text style={s.heroMeta}>
                {t('home.weightGoal')}: {data?.weight.goal_kg ? `${data.weight.goal_kg} kg` : '—'}
              </Text>
            </View>
            <View style={s.daysBadge}>
              <Text style={s.daysNum}>{data?.days_remaining ?? '—'}</Text>
              <Text style={s.daysTxt}>{t('home.daysRemaining').split(' ').join('\n')}</Text>
            </View>
          </View>
          {data?.bmi != null && (
            <View style={s.bmiRow}>
              <View style={s.bmiPill}>
                <Text style={s.bmiValue}>IMC {data.bmi}</Text>
                <Text style={s.bmiLabel}> • {BMI_LABEL(data.bmi)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Calories card */}
        <View style={s.mainCard}>
          <Text style={s.mainLabel}>{t('home.caloriesRemaining')}</Text>
          <View style={s.mainRow}>
            <Text style={s.mainValue}>{remaining}</Text>
            <Text style={s.mainUnit}>kcal</Text>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <View style={s.mainStats}>
            <Stat colors={colors} label={t('home.caloriesGoal')} value={`${kcalGoal}`} />
            <Stat colors={colors} label={t('home.caloriesConsumed')} value={`${Math.round(kcalConsumed)}`} />
            <Stat colors={colors} label={t('home.caloriesBurned')} value={`${Math.round(kcalBurned)}`} />
          </View>
        </View>

        {/* Macros row */}
        <View style={s.macrosRow}>
          <MacroChip colors={colors} label={t('home.protein')} value={data?.macros.protein_g ?? 0} tint={colors.tintCoral} />
          <MacroChip colors={colors} label={t('home.carbs')} value={data?.macros.carbs_g ?? 0} tint={colors.tintButter} />
          <MacroChip colors={colors} label={t('home.fat')} value={data?.macros.fat_g ?? 0} tint={colors.tintMint} />
        </View>

        {/* 2x2 stat grid: água, passos, sono, exercícios */}
        <View style={s.grid}>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/water')} testID="home-water-card">
            <StatCard
              colors={colors} tint={colors.tintSky} icon="water" iconColor={colors.info}
              label={t('home.hydration')} value={`${waterTotal}`} unit="ml" progress={waterPct}
              action={<View style={s.miniActions}>
                {[200, 300, 500].map(ml => (
                  <Pressable
                    key={ml}
                    onPress={() => addWater(ml)}
                    style={s.miniBtn}
                    testID={`home-water-${ml}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('palette.addWater')} +${ml} ml`}
                  >
                    <Text style={s.miniBtnTxt}>+{ml}</Text>
                  </Pressable>
                ))}
              </View>}
            />
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/steps')} testID="home-steps-card">
            <StatCard
              colors={colors} tint={colors.tintLavender} icon="footsteps" iconColor="#8B7FD9"
              label={t('home.steps')} value={`${steps}`} unit={`/ ${stepsGoal}`} progress={stepsPct}
            />
          </Pressable>
        </View>

        <View style={s.grid}>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/sleep-log')} testID="home-sleep-card">
            <StatCard
              colors={colors} tint={colors.tintPeach} icon="moon" iconColor="#D07A45"
              label={t('home.sleep')} value={data?.sleep.last_hours != null ? `${data.sleep.last_hours}` : '—'} unit="h"
              progress={data?.sleep.last_hours ? Math.min(100, (data.sleep.last_hours / (data.sleep.goal_hours || 8)) * 100) : 0}
            />
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/exercise-log')} testID="home-exercise-card">
            <StatCard
              colors={colors} tint={colors.tintMint} icon="flame" iconColor={colors.success}
              label="Exercícios" value={`${data?.exercises.minutes ?? 0}`} unit="min"
              progress={Math.min(100, ((data?.exercises.minutes ?? 0) / 60) * 100)}
              sub={`${data?.exercises.count ?? 0} ${t('home.activities')}`}
            />
          </Pressable>
        </View>

        {/* Body composition shortcut */}
        <Pressable style={s.compCta} onPress={() => router.push('/body-composition')} testID="home-body-comp-cta">
          <View style={s.compIcon}><Ionicons name="body" size={20} color={colors.brandDark} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.compTitle}>{t('home.bodyComposition')}</Text>
            <Text style={s.compSub}>{t('home.bodyCompositionSub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        {/* Fasting CTA */}
        <Pressable style={s.fastCta} onPress={() => router.push('/fasting')} testID="home-fasting-cta">
          <View style={s.fastIcon}><Ionicons name="timer-outline" size={22} color={colors.brandDark} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.fastTitle}>{t('home.fasting')}</Text>
            <Text style={s.fastSub}>{t('home.fastingSub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.brandDark} />
        </Pressable>

        {/* AI CTA */}
        <View style={s.ctaRow}>
          <Pressable style={s.aiCta} onPress={() => { haptic.tap(); router.push(user?.is_premium ? '/scan' : '/paywall'); }} testID="home-ai-scan-cta">
            <View style={s.aiIcon}><Ionicons name={user?.is_premium ? 'sparkles' : 'lock-closed'} size={22} color={colors.brandDark} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.aiTitle}>{t('home.scanAI')} {!user?.is_premium && '🔒'}</Text>
              <Text style={s.aiSub}>{t('home.scanAISub')}</Text>
            </View>
          </Pressable>
          <Pressable style={s.aiCta2} onPress={() => { haptic.tap(); router.push(user?.is_premium ? '/coach' : '/paywall'); }} testID="home-ai-coach-cta">
            <Animated.View style={[s.aiIcon2, pulseStyle]}>
              <Ionicons name={user?.is_premium ? 'chatbubbles' : 'lock-closed'} size={22} color={colors.brandPrimary} />
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={s.aiTitle2}>{t('home.coachAI')} {!user?.is_premium && '🔒'}</Text>
              <Text style={s.aiSub2}>{t('home.coachAISub')}</Text>
            </View>
          </Pressable>
        </View>

        {/* Recipes CTA */}
        <Animated.View entering={FadeInDown.delay(120).springify().damping(14)}>
          <Pressable style={s.recipesCta} onPress={() => { haptic.tap(); router.push('/recipes'); }} testID="home-recipes-cta">
            <View style={s.recipesIcon}><Text style={{ fontSize: 22 }}>🍽️</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.recipesTitle}>{t('home.recipesTitle')} {!user?.is_premium && '🔒'}</Text>
              <Text style={s.recipesSub}>{t('home.recipesSub')}</Text>
            </View>
            <Ionicons name="sparkles" size={18} color={colors.brandDark} />
          </Pressable>
        </Animated.View>

        {/* Gamification + Community + Share */}
        <View style={s.ctaRow}>
          <Pressable style={s.gamiCta} onPress={() => router.push('/gamification')} testID="home-gami-cta">
            <View style={s.gamiIcon}><Ionicons name="trophy" size={22} color={colors.brandDark} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.gamiTitle}>{t('home.achievements')}</Text>
              <Text style={s.gamiSub}>{t('home.achievementsSub')}</Text>
            </View>
          </Pressable>
          <Pressable style={s.commCta} onPress={() => router.push('/community')} testID="home-community-cta">
            <View style={s.commIcon}><Ionicons name="people" size={22} color={colors.brandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.commTitle}>{t('home.community')}</Text>
              <Text style={s.commSub}>{t('home.communitySub')}</Text>
            </View>
          </Pressable>
        </View>

        <Pressable style={s.shareCta} onPress={() => router.push('/professional-share')} testID="home-share-cta">
          <View style={s.shareIconWrap}><Ionicons name="document-text" size={20} color={colors.brandDark} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.shareTitle}>{t('home.shareWithPros')}</Text>
            <Text style={s.shareSub}>{t('home.shareWithProsSub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <Pressable style={s.shareCta} onPress={() => router.push('/companies')} testID="home-companies-cta">
          <View style={[s.shareIconWrap, { backgroundColor: colors.brandDark }]}>
            <Ionicons name="business" size={20} color={colors.brandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.shareTitle}>{t('home.companies')}</Text>
            <Text style={s.shareSub}>{t('home.companiesSub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        {/* Photos strip */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>{t('home.progressPhotos')}</Text>
            <Pressable onPress={() => router.push('/photos')} testID="home-photos-link">
              <Text style={s.linkTxt}>{t('home.viewAll')}</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photosRow}>
            <Pressable style={s.photoAdd} onPress={() => router.push('/photos')} testID="home-photo-add">
              <Ionicons name="add" size={28} color={colors.brandDark} />
              <Text style={s.photoAddTxt}>{t('food.addMore').split(' ')[0]}</Text>
            </Pressable>
            {(data?.photos ?? []).map(p => (
              <View key={p.id} style={s.photoItem}>
                <View style={s.photoPh}><Ionicons name="image" size={22} color={colors.muted} /></View>
                <Text style={s.photoDate}>{formatShort(p.date)}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

function Stat({ colors, label, value }: { colors: ThemeColors; label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ ...typography.small, color: colors.muted, marginBottom: 2 }}>{label}</Text>
      <Text style={{ ...typography.bodyStrong, color: colors.onSurface }}>{value}</Text>
    </View>
  );
}

function MacroChip({ colors, label, value, tint }: { colors: ThemeColors; label: string; value: number; tint: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: tint, borderRadius: radius.md, padding: spacing.md }}>
      <Text style={{ ...typography.small, color: colors.onTint }}>{label}</Text>
      <Text style={{ ...typography.headline, color: colors.onTint, marginTop: 2 }}>{Math.round(value)}g</Text>
    </View>
  );
}

function StatCard({ colors, tint, icon, iconColor, label, value, unit, progress, sub, action }: any) {
  return (
    <View style={{
      flex: 1, backgroundColor: tint, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, minHeight: 130,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <View style={{
          width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.6)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
        <Text style={{ ...typography.caption, color: colors.onTint, fontWeight: '600' }}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.onTint }}>{value}</Text>
        <Text style={{ ...typography.small, color: colors.onTint, opacity: 0.7 }}>{unit}</Text>
      </View>
      {progress !== undefined && (
        <View style={{ height: 6, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 3, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${progress}%`, backgroundColor: iconColor, borderRadius: 3 }} />
        </View>
      )}
      {sub && <Text style={{ ...typography.small, color: colors.onTint, opacity: 0.75 }}>{sub}</Text>}
      {action}
    </View>
  );
}

function formatBrDate(d: Date): string {
  const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]}`;
}
function formatDate(d: Date, locale: string): string {
  const map: Record<string, string> = { 'pt-BR': 'pt-BR', en: 'en-US', es: 'es-ES' };
  try {
    const s = d.toLocaleDateString(map[locale] || 'pt-BR', { weekday: 'long', day: '2-digit', month: 'short' });
    return s;
  } catch {
    return formatBrDate(d);
  }
}
function formatShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerSafe: { backgroundColor: colors.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  greeting: { ...typography.displayMedium, color: colors.onSurface },
  subGreeting: { ...typography.caption, color: colors.muted, marginTop: 2, textTransform: 'capitalize' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarTxt: { color: colors.onBrandPrimary, fontSize: 20, fontWeight: '700' },
  content: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingTop: spacing.xs },

  quoteBox: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.md,
  },
  quoteTxt: { flex: 1, ...typography.caption, color: colors.brandDark, fontWeight: '600', lineHeight: 18 },

  heroCard: { backgroundColor: colors.surfaceInverse, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroLabel: { ...typography.caption, color: colors.onSurfaceInverse, opacity: 0.7 },
  heroValue: { fontSize: 44, fontWeight: '700', color: colors.onSurfaceInverse, letterSpacing: -1, marginTop: 2 },
  heroUnit: { fontSize: 18, fontWeight: '600', color: colors.onSurfaceInverse, opacity: 0.7 },
  heroMeta: { ...typography.caption, color: colors.onSurfaceInverse, opacity: 0.7, marginTop: 4 },
  daysBadge: {
    backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', minWidth: 96,
  },
  daysNum: { fontSize: 32, fontWeight: '700', color: colors.brandDark, letterSpacing: -1 },
  daysTxt: { ...typography.small, color: colors.brandDark, textAlign: 'center', fontWeight: '700' },
  bmiRow: { flexDirection: 'row' },
  bmiPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  bmiValue: { color: colors.onSurfaceInverse, ...typography.caption, fontWeight: '700' },
  bmiLabel: { color: colors.onSurfaceInverse, ...typography.caption, opacity: 0.85 },

  mainCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  mainLabel: { ...typography.caption, color: colors.muted },
  mainRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.xs, gap: spacing.sm },
  mainValue: { fontSize: 48, fontWeight: '700', color: colors.onSurface, letterSpacing: -1 },
  mainUnit: { fontSize: 16, color: colors.muted, fontWeight: '600' },
  progressTrack: { height: 8, backgroundColor: colors.divider, borderRadius: 4, marginTop: spacing.md, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.brandPrimary, borderRadius: 4 },
  mainStats: { flexDirection: 'row', marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md },

  macrosRow: { flexDirection: 'row', gap: spacing.sm },

  grid: { flexDirection: 'row', gap: spacing.md },
  miniActions: { flexDirection: 'row', gap: 4, marginTop: 4 },
  miniBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.55)' },
  miniBtnTxt: { ...typography.small, color: colors.onTint, fontWeight: '700' },

  ctaRow: { flexDirection: 'row', gap: spacing.md },
  aiCta: { flex: 1, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.lg },
  aiIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  aiTitle: { color: colors.brandDark, fontWeight: '700', fontSize: 14 },
  aiSub: { color: colors.brandDark, opacity: 0.7, fontSize: 11, marginTop: 1 },
  aiCta2: { flex: 1, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.surfaceInverse, padding: spacing.md, borderRadius: radius.lg },
  aiIcon2: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(198,241,75,0.15)', alignItems: 'center', justifyContent: 'center' },
  aiTitle2: { color: colors.onSurfaceInverse, fontWeight: '700', fontSize: 14 },
  aiSub2: { color: colors.onSurfaceInverse, opacity: 0.7, fontSize: 11, marginTop: 1 },

  recipesCta: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.tintPeach, padding: spacing.md, borderRadius: radius.lg },
  recipesIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
  recipesTitle: { color: colors.onTint, fontWeight: '700', fontSize: 14 },
  recipesSub: { color: colors.onTint, opacity: 0.7, fontSize: 12, marginTop: 1 },

  gamiCta: { flex: 1, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.tintButter, padding: spacing.md, borderRadius: radius.lg },
  gamiIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
  gamiTitle: { color: colors.onTint, fontWeight: '700', fontSize: 14 },
  gamiSub: { color: colors.onTint, opacity: 0.7, fontSize: 11, marginTop: 1 },
  commCta: { flex: 1, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.tintLavender, padding: spacing.md, borderRadius: radius.lg },
  commIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(198,241,75,0.18)', alignItems: 'center', justifyContent: 'center' },
  commTitle: { color: colors.onTint, fontWeight: '700', fontSize: 14 },
  commSub: { color: colors.onTint, opacity: 0.7, fontSize: 11, marginTop: 1 },

  shareCta: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, padding: spacing.md, borderRadius: radius.lg },
  shareIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  shareTitle: { color: colors.onSurface, fontWeight: '700', ...typography.bodyStrong },
  shareSub: { color: colors.muted, ...typography.small, marginTop: 2 },

  fastCta: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.lg },
  fastIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  fastTitle: { color: colors.brandDark, fontWeight: '700', ...typography.bodyStrong },
  fastSub: { color: colors.brandDark, opacity: 0.7, ...typography.small, marginTop: 2 },

  compCta: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, padding: spacing.md, borderRadius: radius.lg },
  compIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  compTitle: { color: colors.onSurface, fontWeight: '700', ...typography.bodyStrong },
  compSub: { color: colors.muted, ...typography.small, marginTop: 2 },

  section: { gap: spacing.sm, marginTop: spacing.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...typography.headline, color: colors.onSurface },
  linkTxt: { ...typography.caption, color: colors.muted, fontWeight: '600' },
  photosRow: { gap: spacing.sm, paddingRight: spacing.xl },
  photoAdd: {
    width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.brandPrimary,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  photoAddTxt: { ...typography.small, color: colors.brandDark, fontWeight: '700' },
  photoItem: { width: 96, gap: 4 },
  photoPh: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  photoDate: { ...typography.small, color: colors.muted, textAlign: 'center' },
  offlineBar: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(244,162,97,0.15)', paddingHorizontal: spacing.xl, paddingVertical: 6, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(244,162,97,0.3)' },
  offlineTxt: { ...typography.small, color: colors.warning, fontWeight: '700' },
});
