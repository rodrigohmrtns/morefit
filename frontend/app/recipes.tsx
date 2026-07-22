import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { useLocale } from '@/src/i18n';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';
import { haptic } from '@/src/utils/haptic';

type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type Recipe = {
  name: string; emoji?: string; time_min?: number; servings?: number;
  ingredients: string[]; instructions: string[];
  macros?: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number };
  tags?: string[];
};

const MEALS: { key: Meal; icon: any; hour: string }[] = [
  { key: 'breakfast', icon: 'cafe', hour: '☕' },
  { key: 'lunch', icon: 'restaurant', hour: '🍽️' },
  { key: 'dinner', icon: 'moon', hour: '🌙' },
  { key: 'snack', icon: 'nutrition', hour: '🥜' },
];

export default function Recipes() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLocale();
  const { user } = useAuth();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [meal, setMeal] = useState<Meal>('lunch');
  const [restrictions, setRestrictions] = useState('');
  const [maxKcal, setMaxKcal] = useState('');
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isPremium = !!user?.is_premium;

  // Pulse animation for the CTA button while loading
  const pulse = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const generate = async () => {
    if (loading) return;
    haptic.tap();
    setLoading(true); setError(null);
    pulse.value = withRepeat(withTiming(1.04, { duration: 600 }), -1, true);
    try {
      const rest = restrictions.split(',').map(x => x.trim()).filter(Boolean);
      const body: any = { meal_type: meal };
      if (rest.length) body.dietary_restrictions = rest;
      const kcal = parseInt(maxKcal, 10);
      if (!isNaN(kcal) && kcal > 0) body.max_calories = kcal;
      const r = await api<{ recipes: Recipe[] }>('/coach/recipes', { method: 'POST', body });
      setRecipes(r.recipes || []);
      haptic.success();
    } catch (e: any) {
      setError(e?.message || t('common.error'));
      haptic.error();
    } finally {
      setLoading(false);
      pulse.value = withTiming(1, { duration: 200 });
    }
  };

  // Premium gate
  if (!isPremium) {
    return (
      <View style={s.root} testID="recipes-screen">
        <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
          <View style={s.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={s.back} testID="recipes-back">
              <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
            </Pressable>
            <Text style={s.title}>{t('recipes.title')}</Text>
            <View style={{ width: 34 }} />
          </View>
        </SafeAreaView>
        <View style={s.gateBox}>
          <View style={s.gateIcon}><Text style={{ fontSize: 44 }}>🔒</Text></View>
          <Text style={s.gateTitle}>{t('recipes.premiumOnly')}</Text>
          <Text style={s.gateSub}>{t('recipes.premiumSub')}</Text>
          <Pressable style={s.gateCta} onPress={() => router.push('/paywall')} testID="recipes-upgrade">
            <Ionicons name="diamond" size={16} color={colors.brandDark} />
            <Text style={s.gateCtaTxt}>{t('recipes.upgrade')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root} testID="recipes-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={s.back} testID="recipes-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{t('recipes.title')}</Text>
            <Text style={s.sub}>{t('recipes.subtitle')}</Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Meal selector */}
          <Text style={s.sectionLabel}>{t('recipes.mealType')}</Text>
          <View style={s.mealRow}>
            {MEALS.map(m => (
              <Pressable
                key={m.key}
                onPress={() => { haptic.select(); setMeal(m.key); }}
                style={[s.mealChip, meal === m.key && s.mealChipActive]}
                testID={`recipes-meal-${m.key}`}
              >
                <Text style={{ fontSize: 20 }}>{m.hour}</Text>
                <Text style={[s.mealChipTxt, meal === m.key && { color: colors.onBrandPrimary, fontWeight: '700' }]}>
                  {t(`recipes.${m.key}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Restrictions */}
          <Text style={s.sectionLabel}>{t('recipes.restrictions')}</Text>
          <TextInput
            style={s.input}
            value={restrictions}
            onChangeText={setRestrictions}
            placeholder={t('recipes.restrictionsPlaceholder')}
            placeholderTextColor={colors.muted}
            testID="recipes-restrictions"
          />

          {/* Max calories */}
          <Text style={s.sectionLabel}>{t('recipes.maxCalories')}</Text>
          <TextInput
            style={s.input}
            value={maxKcal}
            onChangeText={setMaxKcal}
            placeholder="600"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            testID="recipes-max-kcal"
          />

          {/* CTA */}
          <Animated.View style={btnStyle}>
            <Pressable
              onPress={generate}
              style={[s.cta, loading && { opacity: 0.85 }]}
              disabled={loading}
              testID="recipes-generate"
            >
              {loading ? (
                <>
                  <ActivityIndicator size="small" color={colors.brandDark} />
                  <Text style={s.ctaTxt}>{t('recipes.generating')}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color={colors.brandDark} />
                  <Text style={s.ctaTxt}>{t('recipes.generate')}</Text>
                </>
              )}
            </Pressable>
          </Animated.View>

          {/* Error */}
          {error && (
            <Animated.View entering={FadeInDown} style={s.errorBox}>
              <Ionicons name="warning" size={16} color={colors.error} />
              <Text style={s.errorTxt}>{error}</Text>
            </Animated.View>
          )}

          {/* Recipes */}
          {recipes.length === 0 && !loading && !error && (
            <View style={s.emptyBox}>
              <Text style={s.emptyTxt}>{t('recipes.empty')}</Text>
            </View>
          )}

          {recipes.map((r, i) => (
            <Animated.View
              key={`${r.name}-${i}`}
              entering={FadeInUp.delay(i * 80).springify().damping(14)}
              style={s.card}
            >
              <View style={s.cardHead}>
                <Text style={s.cardEmoji}>{r.emoji || '🍽️'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{r.name}</Text>
                  <View style={s.cardMeta}>
                    {r.time_min != null && (
                      <View style={s.metaPill}>
                        <Ionicons name="time-outline" size={12} color={colors.onSurfaceSecondary} />
                        <Text style={s.metaTxt}>{r.time_min} {t('recipes.minutes')}</Text>
                      </View>
                    )}
                    {r.servings != null && (
                      <View style={s.metaPill}>
                        <Ionicons name="people-outline" size={12} color={colors.onSurfaceSecondary} />
                        <Text style={s.metaTxt}>{r.servings} {t('recipes.servings')}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Macros */}
              {r.macros && (
                <View style={s.macroRow}>
                  <MacroCell colors={colors} label="kcal" value={r.macros.calories} />
                  <MacroCell colors={colors} label="P" value={r.macros.protein_g} unit="g" />
                  <MacroCell colors={colors} label="C" value={r.macros.carbs_g} unit="g" />
                  <MacroCell colors={colors} label="G" value={r.macros.fat_g} unit="g" />
                </View>
              )}

              {/* Ingredients */}
              <Text style={s.blockLabel}>{t('recipes.ingredients')}</Text>
              <View style={{ gap: 4 }}>
                {r.ingredients?.map((ing, k) => (
                  <View key={k} style={s.bulletRow}>
                    <View style={s.bulletDot} />
                    <Text style={s.bulletTxt}>{ing}</Text>
                  </View>
                ))}
              </View>

              {/* Instructions */}
              <Text style={s.blockLabel}>{t('recipes.instructions')}</Text>
              <View style={{ gap: 6 }}>
                {r.instructions?.map((step, k) => (
                  <View key={k} style={s.stepRow}>
                    <View style={s.stepNum}><Text style={s.stepNumTxt}>{k + 1}</Text></View>
                    <Text style={s.stepTxt}>{step}</Text>
                  </View>
                ))}
              </View>

              {/* Tags */}
              {r.tags && r.tags.length > 0 && (
                <View style={s.tagRow}>
                  {r.tags.map((tg, k) => (
                    <View key={k} style={s.tag}><Text style={s.tagTxt}>{tg}</Text></View>
                  ))}
                </View>
              )}
            </Animated.View>
          ))}

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function MacroCell({ colors, label, value, unit }: { colors: ThemeColors; label: string; value?: number; unit?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 8, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md }}>
      <Text style={{ ...typography.bodyStrong, color: colors.onSurface }}>
        {value != null ? Math.round(value) : '—'}{unit || ''}
      </Text>
      <Text style={{ ...typography.small, color: colors.muted }}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.title, color: colors.onSurface },
  sub: { ...typography.small, color: colors.muted, marginTop: 2 },

  content: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingTop: spacing.sm },
  sectionLabel: { ...typography.caption, color: colors.muted, marginTop: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },

  mealRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  mealChip: { flex: 1, minWidth: '22%', alignItems: 'center', gap: 4, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  mealChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  mealChipTxt: { ...typography.small, color: colors.onSurface },

  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md - 2, borderWidth: 1, borderColor: colors.border, color: colors.onSurface, ...typography.body },

  cta: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md + 2, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, marginTop: spacing.md },
  ctaTxt: { ...typography.bodyStrong, color: colors.brandDark },

  errorBox: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: 'rgba(224,90,95,0.12)', padding: spacing.md, borderRadius: radius.md },
  errorTxt: { flex: 1, ...typography.caption, color: colors.error },

  emptyBox: { padding: spacing.xxl, alignItems: 'center' },
  emptyTxt: { ...typography.body, color: colors.muted, textAlign: 'center' },

  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm, marginTop: spacing.sm },
  cardHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  cardEmoji: { fontSize: 34 },
  cardTitle: { ...typography.headline, color: colors.onSurface },
  cardMeta: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  metaPill: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: colors.surfaceTertiary, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  metaTxt: { ...typography.small, color: colors.onSurfaceSecondary },

  macroRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },

  blockLabel: { ...typography.caption, color: colors.brandDark, marginTop: spacing.sm, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },

  bulletRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brandPrimary, marginTop: 8 },
  bulletTxt: { flex: 1, ...typography.body, color: colors.onSurface, lineHeight: 22 },

  stepRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  stepNumTxt: { ...typography.small, color: colors.brandDark, fontWeight: '700' },
  stepTxt: { flex: 1, ...typography.body, color: colors.onSurface, lineHeight: 22 },

  tagRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginTop: spacing.xs },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.brandTertiary },
  tagTxt: { ...typography.small, color: colors.onBrandTertiary, fontWeight: '600' },

  gateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.sm },
  gateIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  gateTitle: { ...typography.title, color: colors.onSurface, textAlign: 'center', marginTop: spacing.md },
  gateSub: { ...typography.body, color: colors.muted, textAlign: 'center', maxWidth: 300 },
  gateCta: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, marginTop: spacing.md },
  gateCtaTxt: { ...typography.bodyStrong, color: colors.brandDark },
});
