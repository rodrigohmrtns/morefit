import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
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

const BMI_LABEL = (bmi: number) => {
  if (bmi < 18.5) return 'Abaixo';
  if (bmi < 25) return 'Saudável';
  if (bmi < 30) return 'Sobrepeso';
  return 'Obesidade';
};

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [data, setData] = useState<Summary | null>(null);
  const [quote, setQuote] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sum, q] = await Promise.all([
        api<Summary>('/dashboard/summary'),
        api<{ quote: string }>('/motivation'),
      ]);
      setData(sum); setQuote(q.quote);
    } catch (e) { console.log(e); }
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

  const steps = data?.steps.count ?? 0;
  const stepsGoal = data?.steps.goal ?? 8000;
  const stepsPct = Math.min(100, (steps / stepsGoal) * 100);

  const addWater = async (amt: number) => {
    try { await api('/water', { method: 'POST', body: { amount_ml: amt } }); await load(); } catch {}
  };

  return (
    <View style={s.root} testID="home-screen">
      <SafeAreaView edges={['top']} style={s.headerSafe}>
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Olá, {user?.name?.split(' ')[0] ?? 'você'}</Text>
            <Text style={s.subGreeting}>{formatBrDate(new Date())}</Text>
          </View>
          <Pressable style={s.avatar} onPress={() => router.push('/(tabs)/profile')} testID="home-avatar">
            {user?.photo_base64 ? (
              <Image source={{ uri: `data:image/jpeg;base64,${user.photo_base64}` }} style={s.avatarImg} contentFit="cover" />
            ) : (
              <Text style={s.avatarTxt}>{(user?.name?.[0] ?? 'V').toUpperCase()}</Text>
            )}
          </Pressable>
        </View>
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
              <Text style={s.heroLabel}>Peso atual</Text>
              <Text style={s.heroValue}>
                {data?.weight.current_kg ? data.weight.current_kg.toFixed(1) : '—'}
                <Text style={s.heroUnit}> kg</Text>
              </Text>
              <Text style={s.heroMeta}>
                Meta: {data?.weight.goal_kg ? `${data.weight.goal_kg} kg` : '—'}
              </Text>
            </View>
            <View style={s.daysBadge}>
              <Text style={s.daysNum}>{data?.days_remaining ?? '—'}</Text>
              <Text style={s.daysTxt}>dias{'\n'}restantes</Text>
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
          <Text style={s.mainLabel}>Calorias restantes</Text>
          <View style={s.mainRow}>
            <Text style={s.mainValue}>{remaining}</Text>
            <Text style={s.mainUnit}>kcal</Text>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <View style={s.mainStats}>
            <Stat colors={colors} label="Meta" value={`${kcalGoal}`} />
            <Stat colors={colors} label="Consumidas" value={`${Math.round(kcalConsumed)}`} />
            <Stat colors={colors} label="Queimadas" value={`${Math.round(kcalBurned)}`} />
          </View>
        </View>

        {/* Macros row */}
        <View style={s.macrosRow}>
          <MacroChip colors={colors} label="Proteína" value={data?.macros.protein_g ?? 0} tint={colors.tintCoral} />
          <MacroChip colors={colors} label="Carbo" value={data?.macros.carbs_g ?? 0} tint={colors.tintButter} />
          <MacroChip colors={colors} label="Gordura" value={data?.macros.fat_g ?? 0} tint={colors.tintMint} />
        </View>

        {/* 2x2 stat grid: água, passos, sono, exercícios */}
        <View style={s.grid}>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/water')} testID="home-water-card">
            <StatCard
              colors={colors} tint={colors.tintSky} icon="water" iconColor={colors.info}
              label="Hidratação" value={`${waterTotal}`} unit="ml" progress={waterPct}
              action={<View style={s.miniActions}>
                {[200, 300, 500].map(ml => (
                  <Pressable key={ml} onPress={() => addWater(ml)} style={s.miniBtn} testID={`home-water-${ml}`}>
                    <Text style={s.miniBtnTxt}>+{ml}</Text>
                  </Pressable>
                ))}
              </View>}
            />
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/steps')} testID="home-steps-card">
            <StatCard
              colors={colors} tint={colors.tintLavender} icon="footsteps" iconColor="#8B7FD9"
              label="Passos" value={`${steps}`} unit={`/ ${stepsGoal}`} progress={stepsPct}
            />
          </Pressable>
        </View>

        <View style={s.grid}>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/sleep-log')} testID="home-sleep-card">
            <StatCard
              colors={colors} tint={colors.tintPeach} icon="moon" iconColor="#D07A45"
              label="Sono" value={data?.sleep.last_hours != null ? `${data.sleep.last_hours}` : '—'} unit="h"
              progress={data?.sleep.last_hours ? Math.min(100, (data.sleep.last_hours / (data.sleep.goal_hours || 8)) * 100) : 0}
            />
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/exercise-log')} testID="home-exercise-card">
            <StatCard
              colors={colors} tint={colors.tintMint} icon="flame" iconColor={colors.success}
              label="Exercícios" value={`${data?.exercises.minutes ?? 0}`} unit="min"
              progress={Math.min(100, ((data?.exercises.minutes ?? 0) / 60) * 100)}
              sub={`${data?.exercises.count ?? 0} atividades`}
            />
          </Pressable>
        </View>

        {/* Body composition shortcut */}
        <Pressable style={s.compCta} onPress={() => router.push('/body-composition')} testID="home-body-comp-cta">
          <View style={s.compIcon}><Ionicons name="body" size={20} color={colors.brandDark} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.compTitle}>Composição corporal</Text>
            <Text style={s.compSub}>Peso, IMC, gordura, TMB, idade metabólica</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        {/* Fasting CTA */}
        <Pressable style={s.fastCta} onPress={() => router.push('/fasting')} testID="home-fasting-cta">
          <View style={s.fastIcon}><Ionicons name="timer-outline" size={22} color={colors.brandDark} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.fastTitle}>Jejum Intermitente</Text>
            <Text style={s.fastSub}>Cronômetro, protocolos 16:8, 18:6, 20:4, OMAD</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.brandDark} />
        </Pressable>

        {/* AI CTA */}
        <View style={s.ctaRow}>
          <Pressable style={s.aiCta} onPress={() => router.push('/scan')} testID="home-ai-scan-cta">
            <View style={s.aiIcon}><Ionicons name="sparkles" size={22} color={colors.brandDark} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.aiTitle}>Escanear com IA</Text>
              <Text style={s.aiSub}>Foto → macros em segundos</Text>
            </View>
          </Pressable>
          <Pressable style={s.aiCta2} onPress={() => router.push('/coach')} testID="home-ai-coach-cta">
            <View style={s.aiIcon2}><Ionicons name="chatbubbles" size={22} color={colors.brandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.aiTitle2}>Coach IA</Text>
              <Text style={s.aiSub2}>Pergunte ao seu nutri</Text>
            </View>
          </Pressable>
        </View>

        {/* Gamification + Community + Share */}
        <View style={s.ctaRow}>
          <Pressable style={s.gamiCta} onPress={() => router.push('/gamification')} testID="home-gami-cta">
            <View style={s.gamiIcon}><Ionicons name="trophy" size={22} color={colors.brandDark} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.gamiTitle}>Conquistas</Text>
              <Text style={s.gamiSub}>XP, ranking global</Text>
            </View>
          </Pressable>
          <Pressable style={s.commCta} onPress={() => router.push('/community')} testID="home-community-cta">
            <View style={s.commIcon}><Ionicons name="people" size={22} color={colors.brandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.commTitle}>Comunidade</Text>
              <Text style={s.commSub}>Feed & posts</Text>
            </View>
          </Pressable>
        </View>

        <Pressable style={s.shareCta} onPress={() => router.push('/professional-share')} testID="home-share-cta">
          <View style={s.shareIconWrap}><Ionicons name="document-text" size={20} color={colors.brandDark} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.shareTitle}>Compartilhar com profissionais</Text>
            <Text style={s.shareSub}>PDF ou link para Nutri, Personal e Médico</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <Pressable style={s.shareCta} onPress={() => router.push('/companies')} testID="home-companies-cta">
          <View style={[s.shareIconWrap, { backgroundColor: colors.brandDark }]}>
            <Ionicons name="business" size={20} color={colors.brandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.shareTitle}>Empresas & Equipes</Text>
            <Text style={s.shareSub}>Plano corporativo, campanhas e desafios coletivos</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        {/* Photos strip */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Fotos de progresso</Text>
            <Pressable onPress={() => router.push('/photos')} testID="home-photos-link">
              <Text style={s.linkTxt}>Ver todas</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photosRow}>
            <Pressable style={s.photoAdd} onPress={() => router.push('/photos')} testID="home-photo-add">
              <Ionicons name="add" size={28} color={colors.brandDark} />
              <Text style={s.photoAddTxt}>Adicionar</Text>
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
});
