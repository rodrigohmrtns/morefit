import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Entry = {
  id: string; date: string; weight_kg: number;
  body_fat_pct?: number; muscle_mass_kg?: number; body_water_pct?: number;
  protein_pct?: number; lean_mass_kg?: number; bone_mass_kg?: number;
  visceral_fat?: number; bmr_kcal?: number; metabolic_age?: number;
};

const BMI_CLASS = (b: number) => {
  if (b < 18.5) return { label: 'Abaixo do peso', color: '#F4A261' };
  if (b < 25) return { label: 'Saudável', color: '#7FCB8E' };
  if (b < 30) return { label: 'Sobrepeso', color: '#F4A261' };
  return { label: 'Obesidade', color: '#E05A5F' };
};

export default function BodyComposition() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [items, setItems] = useState<Entry[]>([]);

  const load = useCallback(async () => {
    try { const r = await api<{ items: Entry[] }>('/weight?limit=30'); setItems(r.items || []); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const latest = items[0];
  const prev = items[1];
  const heightM = ((user?.height_cm || 0) / 100);
  const bmi = latest && heightM > 0 ? +(latest.weight_kg / (heightM * heightM)).toFixed(1) : null;
  const bmiCls = bmi != null ? BMI_CLASS(bmi) : null;

  const diff = (field: keyof Entry): string => {
    if (!latest || !prev) return '';
    const a = latest[field] as number | undefined;
    const b = prev[field] as number | undefined;
    if (a == null || b == null) return '';
    const d = +(a - b).toFixed(1);
    return d === 0 ? '' : `${d > 0 ? '+' : ''}${d}`;
  };

  return (
    <View style={s.root} testID="body-composition-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={s.back} testID="body-comp-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title}>Composição corporal</Text>
          <Pressable onPress={() => router.push('/weight-log')} style={s.addBtn} testID="body-comp-add">
            <Ionicons name="add" size={22} color={colors.brandDark} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.content}>
        {!latest ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}><Ionicons name="body" size={40} color={colors.brandDark} /></View>
            <Text style={s.emptyTitle}>Nenhuma medição ainda</Text>
            <Text style={s.emptyTxt}>Registre seu peso e composição corporal para ver aqui.</Text>
            <Pressable style={s.emptyBtn} onPress={() => router.push('/weight-log')} testID="body-comp-empty-log">
              <Text style={s.emptyBtnTxt}>Registrar agora</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Header */}
            <View style={s.headCard}>
              <Text style={s.headLabel}>Última medição</Text>
              <Text style={s.headDate}>
                {new Date(latest.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </Text>
            </View>

            {/* Big cards row */}
            <View style={s.bigRow}>
              <View style={[s.bigCard, { backgroundColor: colors.tintMint }]}>
                <Text style={s.bigLabel}>Peso</Text>
                <Text style={s.bigVal}>{latest.weight_kg.toFixed(1)}<Text style={s.bigUnit}> kg</Text></Text>
                {diff('weight_kg') && <Text style={s.bigDiff}>{diff('weight_kg')} kg</Text>}
              </View>
              <View style={[s.bigCard, { backgroundColor: colors.tintPeach }]}>
                <Text style={s.bigLabel}>IMC</Text>
                <Text style={s.bigVal}>{bmi ?? '—'}</Text>
                {bmiCls && <Text style={[s.bigDiff, { color: bmiCls.color, fontWeight: '700' }]}>{bmiCls.label}</Text>}
              </View>
            </View>

            {/* Grid métricas */}
            <View style={s.grid}>
              <Metric colors={colors} icon="water" label="Gordura" value={latest.body_fat_pct} unit="%" diff={diff('body_fat_pct')} />
              <Metric colors={colors} icon="water-outline" label="Água" value={latest.body_water_pct} unit="%" diff={diff('body_water_pct')} />
              <Metric colors={colors} icon="fitness" label="Massa Muscular" value={latest.muscle_mass_kg} unit="kg" diff={diff('muscle_mass_kg')} />
              <Metric colors={colors} icon="pulse" label="Proteína" value={latest.protein_pct} unit="%" diff={diff('protein_pct')} />
              <Metric colors={colors} icon="body" label="Massa Magra" value={latest.lean_mass_kg} unit="kg" diff={diff('lean_mass_kg')} />
              <Metric colors={colors} icon="skull" label="Massa Óssea" value={latest.bone_mass_kg} unit="kg" diff={diff('bone_mass_kg')} />
              <Metric colors={colors} icon="warning" label="Gordura Visceral" value={latest.visceral_fat} unit="" diff={diff('visceral_fat')} />
              <Metric colors={colors} icon="flame" label="TMB" value={latest.bmr_kcal} unit="kcal" diff={diff('bmr_kcal')} />
              <Metric colors={colors} icon="hourglass" label="Idade Metabólica" value={latest.metabolic_age} unit="anos" diff={diff('metabolic_age')} />
            </View>

            {/* CTA */}
            <Pressable style={s.cta} onPress={() => router.push('/weight-log')} testID="body-comp-log-cta">
              <Ionicons name="add-circle" size={20} color={colors.brandDark} />
              <Text style={s.ctaTxt}>Nova medição</Text>
            </Pressable>
          </>
        )}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

function Metric({ colors, icon, label, value, unit, diff }: any) {
  const isDown = diff?.startsWith('-');
  return (
    <View style={{
      width: '48%', backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
      padding: spacing.md, gap: 4, borderWidth: 1, borderColor: colors.border,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={14} color={colors.brandDark} />
        </View>
        <Text style={{ ...typography.small, color: colors.muted }}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.onSurface }}>
          {value != null ? (typeof value === 'number' ? value.toFixed(unit === '%' || unit === 'kg' ? 1 : 0) : value) : '—'}
        </Text>
        {unit && value != null && <Text style={{ ...typography.small, color: colors.muted }}>{unit}</Text>}
      </View>
      {diff && <Text style={{ ...typography.small, color: isDown ? colors.success : colors.warning, fontWeight: '600' }}>{diff}</Text>}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.headline, color: colors.onSurface },
  addBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl, gap: spacing.md },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...typography.title, color: colors.onSurface },
  emptyTxt: { ...typography.caption, color: colors.muted, textAlign: 'center', maxWidth: 280 },
  emptyBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl, paddingVertical: 12, borderRadius: radius.pill, marginTop: spacing.md },
  emptyBtnTxt: { color: colors.onBrandPrimary, fontWeight: '700' },
  headCard: { gap: 4 },
  headLabel: { ...typography.caption, color: colors.muted },
  headDate: { ...typography.headline, color: colors.onSurface },
  bigRow: { flexDirection: 'row', gap: spacing.sm },
  bigCard: { flex: 1, padding: spacing.lg, borderRadius: radius.lg, gap: 4 },
  bigLabel: { ...typography.caption, color: colors.onTint, opacity: 0.75 },
  bigVal: { fontSize: 32, fontWeight: '700', color: colors.onTint, letterSpacing: -1 },
  bigUnit: { fontSize: 16, color: colors.onTint, opacity: 0.7, fontWeight: '600' },
  bigDiff: { ...typography.small, color: colors.onTint },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cta: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, marginTop: spacing.md },
  ctaTxt: { color: colors.brandDark, fontWeight: '700', ...typography.body },
});
