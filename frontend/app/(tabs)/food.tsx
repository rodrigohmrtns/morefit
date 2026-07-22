import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { useLocale } from '@/src/i18n';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';
import { ThemedRefreshControl, usePullRefresh } from '@/src/components/refresh';
import { SkeletonList } from '@/src/components/skeleton';
import { toast } from '@/src/components/toast';

type Meal = {
  id: string; name: string; meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  calories: number; protein_g: number; carbs_g: number; fat_g: number; portion?: string;
};

const CATS: { key: Meal['meal_type']; labelKey: string; icon: any; tintKey: keyof ThemeColors }[] = [
  { key: 'breakfast', labelKey: 'food.breakfast', icon: 'sunny', tintKey: 'tintButter' },
  { key: 'lunch', labelKey: 'food.lunch', icon: 'restaurant', tintKey: 'tintMint' },
  { key: 'dinner', labelKey: 'food.dinner', icon: 'moon', tintKey: 'tintLavender' },
  { key: 'snack', labelKey: 'food.snack', icon: 'nutrition', tintKey: 'tintPeach' },
];

export default function FoodDiary() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLocale();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { const r = await api<{ items: Meal[] }>('/meals'); setMeals(r.items || []); } catch {}
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const { refreshing, onRefresh } = usePullRefresh(load);

  const total = meals.reduce((s, m) => s + (m.calories || 0), 0);
  const del = async (id: string) => {
    try {
      await api(`/meals/${id}`, { method: 'DELETE' });
      toast.success('Refeição removida');
      load();
    } catch {
      toast.error('Erro ao remover');
    }
  };

  return (
    <View style={s.root} testID="food-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>{t('food.diaryTitle')}</Text>
            <Text style={s.sub}>{t('food.today')} • {Math.round(total)} {t('food.kcalLogged')}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable style={s.searchPill} onPress={() => router.push('/food-add')} testID="food-add-fab">
              <Ionicons name="search" size={16} color={colors.onSurface} />
            </Pressable>
            <Pressable style={s.aiPill} onPress={() => router.push('/scan')} testID="food-ai-fab">
              <Ionicons name="sparkles" size={16} color={colors.brandDark} />
              <Text style={s.aiPillTxt}>{t('food.scanAI')}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && meals.length === 0 ? (
          <SkeletonList count={4} />
        ) : (
        <>
        {CATS.map(cat => {
          const items = meals.filter(m => m.meal_type === cat.key);
          const cal = items.reduce((sum, m) => sum + m.calories, 0);
          const tint = colors[cat.tintKey] as string;
          return (
            <View key={cat.key} style={s.section}>
              <View style={s.sectionHead}>
                <View style={s.sectionHeadLeft}>
                  <View style={[s.catIcon, { backgroundColor: tint }]}>
                    <Ionicons name={cat.icon} size={16} color={colors.onTint} />
                  </View>
                  <Text style={s.sectionTitle}>{t(cat.labelKey)}</Text>
                </View>
                <Text style={s.sectionMeta}>{Math.round(cal)} kcal</Text>
              </View>
              <View style={s.list}>
                {items.length === 0 ? (
                  <Pressable onPress={() => router.push({ pathname: '/food-add', params: { meal_type: cat.key } })}
                    style={s.emptyRow} testID={`food-empty-${cat.key}`}>
                    <View style={s.plusBadge}><Ionicons name="add" size={18} color={colors.brandDark} /></View>
                    <Text style={s.emptyTxt}>{t('food.addMeal')}</Text>
                  </Pressable>
                ) : items.map(m => (
                  <View key={m.id} style={s.mealRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.mealName}>{m.name}</Text>
                      <Text style={s.mealMeta}>
                        {Math.round(m.calories)} kcal • P {Math.round(m.protein_g)}g • C {Math.round(m.carbs_g)}g • G {Math.round(m.fat_g)}g
                      </Text>
                    </View>
                    <Pressable onPress={() => del(m.id)} hitSlop={12} testID={`food-del-${m.id}`}>
                      <Ionicons name="trash-outline" size={18} color={colors.muted} />
                    </Pressable>
                  </View>
                ))}
                {items.length > 0 && (
                  <Pressable onPress={() => router.push({ pathname: '/food-add', params: { meal_type: cat.key } })}
                    style={s.addMore} testID={`food-add-${cat.key}`}>
                    <Ionicons name="add" size={16} color={colors.brandPrimary} />
                    <Text style={s.addMoreTxt}>{t('food.addMore')}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
        </>
        )}
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.displayMedium, color: colors.onSurface },
  sub: { ...typography.caption, color: colors.muted, marginTop: 2 },
  aiPill: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill },
  aiPillTxt: { color: colors.brandDark, ...typography.caption, fontWeight: '700' },
  searchPill: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl, gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  catIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...typography.headline, color: colors.onSurface },
  sectionMeta: { ...typography.caption, color: colors.muted },
  list: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  plusBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { ...typography.body, color: colors.onSurfaceSecondary },
  mealRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: spacing.md },
  mealName: { ...typography.bodyStrong, color: colors.onSurface },
  mealMeta: { ...typography.small, color: colors.muted, marginTop: 2 },
  addMore: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, justifyContent: 'center' },
  addMoreTxt: { color: colors.brandPrimary, fontWeight: '700', ...typography.caption },
});
