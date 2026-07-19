import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { colors, radius, shadow, spacing, typography } from '@/src/theme';

type Meal = {
  id: string; name: string; meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  calories: number; protein_g: number; carbs_g: number; fat_g: number; portion?: string;
};

const CATS: { key: Meal['meal_type']; label: string; icon: any }[] = [
  { key: 'breakfast', label: 'Café da manhã', icon: 'sunny' },
  { key: 'lunch', label: 'Almoço', icon: 'restaurant' },
  { key: 'dinner', label: 'Jantar', icon: 'moon' },
  { key: 'snack', label: 'Lanches', icon: 'nutrition' },
];

export default function FoodDiary() {
  const router = useRouter();
  const [meals, setMeals] = useState<Meal[]>([]);

  const load = useCallback(async () => {
    try { const r = await api<{ items: Meal[] }>('/meals'); setMeals(r.items || []); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const total = meals.reduce((s, m) => s + (m.calories || 0), 0);

  const del = async (id: string) => {
    try { await api(`/meals/${id}`, { method: 'DELETE' }); load(); } catch {}
  };

  return (
    <View style={styles.root} testID="food-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Diário Alimentar</Text>
            <Text style={styles.sub}>Hoje • {Math.round(total)} kcal registradas</Text>
          </View>
          <Pressable style={styles.aiPill} onPress={() => router.push('/scan')} testID="food-ai-fab">
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text style={styles.aiPillTxt}>Scan IA</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        {CATS.map(cat => {
          const items = meals.filter(m => m.meal_type === cat.key);
          const cal = items.reduce((s, m) => s + m.calories, 0);
          return (
            <View key={cat.key} style={styles.section}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionHeadLeft}>
                  <Ionicons name={cat.icon} size={18} color={colors.brandPrimary} />
                  <Text style={styles.sectionTitle}>{cat.label}</Text>
                </View>
                <Text style={styles.sectionMeta}>{Math.round(cal)} kcal</Text>
              </View>
              <View style={styles.list}>
                {items.length === 0 ? (
                  <Pressable
                    onPress={() => router.push({ pathname: '/scan', params: { meal_type: cat.key } })}
                    style={styles.emptyRow}
                    testID={`food-empty-${cat.key}`}
                  >
                    <View style={styles.plusBadge}><Ionicons name="add" size={18} color={colors.brandPrimary} /></View>
                    <Text style={styles.emptyTxt}>Adicionar refeição</Text>
                  </Pressable>
                ) : items.map(m => (
                  <View key={m.id} style={styles.mealRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mealName}>{m.name}</Text>
                      <Text style={styles.mealMeta}>
                        {Math.round(m.calories)} kcal • P {Math.round(m.protein_g)}g • C {Math.round(m.carbs_g)}g • G {Math.round(m.fat_g)}g
                      </Text>
                    </View>
                    <Pressable onPress={() => del(m.id)} hitSlop={12} testID={`food-del-${m.id}`}>
                      <Ionicons name="trash-outline" size={18} color={colors.muted} />
                    </Pressable>
                  </View>
                ))}
                {items.length > 0 && (
                  <Pressable onPress={() => router.push({ pathname: '/scan', params: { meal_type: cat.key } })} style={styles.addMore} testID={`food-add-${cat.key}`}>
                    <Ionicons name="add" size={16} color={colors.brandPrimary} />
                    <Text style={styles.addMoreTxt}>Adicionar mais</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.displayMedium, color: colors.onSurface },
  sub: { ...typography.caption, color: colors.muted, marginTop: 2 },
  aiPill: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill },
  aiPillTxt: { color: '#fff', ...typography.caption, fontWeight: '700' },
  content: { padding: spacing.xl, gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { ...typography.headline, color: colors.onSurface },
  sectionMeta: { ...typography.caption, color: colors.muted },
  list: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  plusBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { ...typography.body, color: colors.onSurfaceSecondary },
  mealRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: spacing.md },
  mealName: { ...typography.bodyStrong, color: colors.onSurface },
  mealMeta: { ...typography.small, color: colors.muted, marginTop: 2 },
  addMore: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, justifyContent: 'center' },
  addMoreTxt: { color: colors.brandPrimary, fontWeight: '700', ...typography.caption },
});
