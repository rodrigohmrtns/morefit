import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Cat = 'gym' | 'running' | 'bike' | 'walking' | 'swimming' | 'crossfit' | 'pilates' | 'yoga' | 'custom';
type Intensity = 'low' | 'moderate' | 'high';

// MET values (kcal per kg per hour)
const MET_TABLE: Record<Cat, { low: number; moderate: number; high: number }> = {
  gym: { low: 3.5, moderate: 5, high: 6.5 },
  running: { low: 7, moderate: 9.8, high: 12.5 },
  bike: { low: 4, moderate: 8, high: 12 },
  walking: { low: 2.8, moderate: 3.8, high: 5 },
  swimming: { low: 4.5, moderate: 6, high: 9.8 },
  crossfit: { low: 6, moderate: 8, high: 12 },
  pilates: { low: 3, moderate: 4, high: 5 },
  yoga: { low: 2.5, moderate: 3, high: 4 },
  custom: { low: 3, moderate: 5, high: 7 },
};

const CATS: { key: Cat; label: string; icon: any }[] = [
  { key: 'gym', label: 'Academia', icon: 'barbell' },
  { key: 'running', label: 'Corrida', icon: 'walk' },
  { key: 'bike', label: 'Bike', icon: 'bicycle' },
  { key: 'walking', label: 'Caminhada', icon: 'footsteps' },
  { key: 'swimming', label: 'Natação', icon: 'water' },
  { key: 'crossfit', label: 'Crossfit', icon: 'flame' },
  { key: 'pilates', label: 'Pilates', icon: 'body' },
  { key: 'yoga', label: 'Yoga', icon: 'leaf' },
  { key: 'custom', label: 'Personalizado', icon: 'construct' },
];

export default function ExerciseLog() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [cat, setCat] = useState<Cat>('gym');
  const [duration, setDuration] = useState('30');
  const [intensity, setIntensity] = useState<Intensity>('moderate');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weight = user?.starting_weight_kg || 70;
  const kcal = useMemo(() => {
    const met = MET_TABLE[cat][intensity];
    const min = parseInt(duration, 10) || 0;
    return Math.round((met * weight * min) / 60);
  }, [cat, intensity, duration, weight]);

  const save = async () => {
    setError(null);
    const min = parseInt(duration, 10);
    if (!min || min < 1) { setError('Informe a duração'); return; }
    setSaving(true);
    try {
      const label = CATS.find(c => c.key === cat)!.label;
      await api('/exercises', {
        method: 'POST',
        body: {
          name: name.trim() || label,
          category: cat,
          duration_min: min,
          calories_burned: kcal,
          intensity,
          note: note.trim() || undefined,
        },
      });
      router.back();
    } catch (e: any) { setError(e?.message || 'Falha ao salvar'); }
    finally { setSaving(false); }
  };

  return (
    <View style={s.root} testID="exercise-log-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={s.back} testID="exercise-log-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title}>Registrar exercício</Text>
          <View style={{ width: 34 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* Categorias */}
          <Text style={s.label}>Categoria</Text>
          <View style={s.grid}>
            {CATS.map(c => (
              <Pressable key={c.key} onPress={() => setCat(c.key)}
                style={[s.catCard, cat === c.key && s.catCardActive]} testID={`exercise-cat-${c.key}`}>
                <Ionicons name={c.icon} size={22} color={cat === c.key ? colors.brandDark : colors.onSurface} />
                <Text style={[s.catTxt, cat === c.key && { color: colors.brandDark, fontWeight: '700' }]}>{c.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Nome custom */}
          {cat === 'custom' && (
            <>
              <Text style={s.label}>Nome do exercício</Text>
              <TextInput style={s.input} value={name} onChangeText={setName}
                placeholder="Ex.: HIIT em casa" placeholderTextColor={colors.muted} testID="exercise-name" />
            </>
          )}

          <View style={s.gridRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Duração (min)</Text>
              <TextInput style={s.input} value={duration} onChangeText={setDuration}
                keyboardType="number-pad" testID="exercise-duration" placeholderTextColor={colors.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Intensidade</Text>
              <View style={s.intensityRow}>
                {(['low', 'moderate', 'high'] as Intensity[]).map(i => (
                  <Pressable key={i} onPress={() => setIntensity(i)}
                    style={[s.intChip, intensity === i && s.intChipActive]} testID={`exercise-intensity-${i}`}>
                    <Text style={[s.intTxt, intensity === i && { color: colors.brandDark, fontWeight: '700' }]}>
                      {i === 'low' ? 'Leve' : i === 'moderate' ? 'Moderada' : 'Alta'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Calorias estimadas */}
          <View style={s.kcalBox}>
            <View style={s.kcalIcon}><Ionicons name="flame" size={22} color={colors.brandDark} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.kcalLabel}>Calorias estimadas</Text>
              <Text style={s.kcalVal}>{kcal} <Text style={s.kcalUnit}>kcal</Text></Text>
            </View>
          </View>

          <Text style={s.label}>Observação (opcional)</Text>
          <TextInput style={[s.input, { minHeight: 72, textAlignVertical: 'top' }]}
            value={note} onChangeText={setNote} multiline
            placeholder="Como se sentiu?" placeholderTextColor={colors.muted} testID="exercise-note" />

          {error && <Text style={s.err} testID="exercise-log-error">{error}</Text>}

          <Pressable style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} testID="exercise-log-save">
            {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
              <>
                <Ionicons name="checkmark" size={18} color={colors.onBrandPrimary} />
                <Text style={s.saveTxt}>Registrar</Text>
              </>
            )}
          </Pressable>
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
  content: { padding: spacing.xl, gap: spacing.sm },
  label: { ...typography.caption, color: colors.muted, marginLeft: 4, marginTop: spacing.md },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, color: colors.onSurface, ...typography.body },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  catCard: { width: '31%', paddingVertical: spacing.md, gap: 6, alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  catCardActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  catTxt: { ...typography.small, color: colors.onSurface, textAlign: 'center' },
  gridRow: { flexDirection: 'row', gap: spacing.md },
  intensityRow: { flexDirection: 'row', gap: 4, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colors.border },
  intChip: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: 'center' },
  intChipActive: { backgroundColor: colors.brandPrimary },
  intTxt: { ...typography.small, color: colors.onSurface },
  kcalBox: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.tintMint, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  kcalIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  kcalLabel: { ...typography.small, color: colors.onTint, opacity: 0.75 },
  kcalVal: { fontSize: 24, fontWeight: '700', color: colors.onTint, letterSpacing: -0.5 },
  kcalUnit: { fontSize: 14, color: colors.onTint, opacity: 0.7, fontWeight: '600' },
  err: { ...typography.caption, color: colors.error, textAlign: 'center', marginTop: spacing.sm },
  saveBtn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingVertical: 16, marginTop: spacing.xl },
  saveTxt: { color: colors.onBrandPrimary, fontWeight: '700', ...typography.body },
});
