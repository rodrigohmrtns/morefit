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
import { colors, radius, spacing, typography } from '@/src/theme';

type Goal = 'lose' | 'maintain' | 'gain';
type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
type Gender = 'male' | 'female' | 'other';

const GOAL_LABEL: Record<Goal, string> = { lose: 'Perder peso', maintain: 'Manter peso', gain: 'Ganhar massa' };
const ACTIVITY_LABEL: Record<Activity, string> = {
  sedentary: 'Sedentário', light: 'Leve', moderate: 'Moderado', active: 'Ativo', very_active: 'Muito ativo',
};
const GENDER_LABEL: Record<Gender, string> = { male: 'Masculino', female: 'Feminino', other: 'Outro' };

const ACT_FACTOR: Record<Activity, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };

export default function Setup() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [gender, setGender] = useState<Gender>('male');
  const [age, setAge] = useState('30');
  const [height, setHeight] = useState('170');
  const [weight, setWeight] = useState('75');
  const [target, setTarget] = useState('70');
  const [goal, setGoal] = useState<Goal>('lose');
  const [activity, setActivity] = useState<Activity>('moderate');
  const [saving, setSaving] = useState(false);

  const calorieGoal = useMemo(() => {
    const a = parseFloat(age) || 30;
    const h = parseFloat(height) || 170;
    const w = parseFloat(weight) || 75;
    // Mifflin-St Jeor
    const bmr = gender === 'female'
      ? 10 * w + 6.25 * h - 5 * a - 161
      : 10 * w + 6.25 * h - 5 * a + 5;
    const tdee = bmr * ACT_FACTOR[activity];
    const delta = goal === 'lose' ? -500 : goal === 'gain' ? 300 : 0;
    return Math.round((tdee + delta) / 10) * 10;
  }, [age, height, weight, gender, activity, goal]);

  const submit = async () => {
    setSaving(true);
    try {
      const birthYear = new Date().getFullYear() - (parseInt(age, 10) || 30);
      await api('/profile', {
        method: 'PUT',
        body: {
          gender,
          birth_date: `${birthYear}-01-01`,
          height_cm: parseFloat(height),
          starting_weight_kg: parseFloat(weight),
          goal_weight_kg: parseFloat(target),
          goal,
          activity_level: activity,
          daily_calorie_goal: calorieGoal,
        },
      });
      // also register initial weight
      await api('/weight', { method: 'POST', body: { weight_kg: parseFloat(weight) } });
      await refresh();
      router.replace('/(tabs)');
    } catch (e) { console.log(e); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <Text style={styles.step}>Passo {step + 1} de 4</Text>
          <View style={styles.progress}>
            <View style={[styles.progressFill, { width: `${((step + 1) / 4) * 100}%` }]} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <View style={styles.section}>
              <Text style={styles.title}>Olá, {user?.name?.split(' ')[0]}! 👋</Text>
              <Text style={styles.sub}>Vamos personalizar o VitaTracker para você.</Text>
              <Text style={styles.label}>Sexo</Text>
              <View style={styles.chipsRow}>
                {(Object.keys(GENDER_LABEL) as Gender[]).map(g => (
                  <Chip key={g} label={GENDER_LABEL[g]} active={gender === g} onPress={() => setGender(g)} testID={`setup-gender-${g}`} />
                ))}
              </View>
              <Text style={styles.label}>Idade</Text>
              <TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="number-pad" testID="setup-age" />
            </View>
          )}
          {step === 1 && (
            <View style={styles.section}>
              <Text style={styles.title}>Suas medidas</Text>
              <Text style={styles.sub}>Usamos para calcular seu metabolismo basal.</Text>
              <Text style={styles.label}>Altura (cm)</Text>
              <TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="decimal-pad" testID="setup-height" />
              <Text style={styles.label}>Peso atual (kg)</Text>
              <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" testID="setup-weight" />
              <Text style={styles.label}>Peso meta (kg)</Text>
              <TextInput style={styles.input} value={target} onChangeText={setTarget} keyboardType="decimal-pad" testID="setup-target" />
            </View>
          )}
          {step === 2 && (
            <View style={styles.section}>
              <Text style={styles.title}>Seu objetivo</Text>
              <Text style={styles.sub}>Isso define seu plano diário.</Text>
              {(Object.keys(GOAL_LABEL) as Goal[]).map(g => (
                <OptionRow key={g} label={GOAL_LABEL[g]} active={goal === g} onPress={() => setGoal(g)} testID={`setup-goal-${g}`}
                  icon={g === 'lose' ? 'trending-down' : g === 'gain' ? 'trending-up' : 'remove'} />
              ))}
              <Text style={styles.label}>Nível de atividade</Text>
              <View style={styles.chipsWrap}>
                {(Object.keys(ACTIVITY_LABEL) as Activity[]).map(a => (
                  <Chip key={a} label={ACTIVITY_LABEL[a]} active={activity === a} onPress={() => setActivity(a)} testID={`setup-act-${a}`} />
                ))}
              </View>
            </View>
          )}
          {step === 3 && (
            <View style={styles.section}>
              <Text style={styles.title}>Seu plano diário</Text>
              <Text style={styles.sub}>Calculamos com base nas suas informações.</Text>
              <View style={styles.summary}>
                <SummaryRow icon="flame" label="Meta de calorias" value={`${calorieGoal} kcal`} />
                <SummaryRow icon="water" label="Meta de água" value="2000 ml" />
                <SummaryRow icon="footsteps" label="Meta de passos" value="8000 passos" />
                <SummaryRow icon="fitness" label="Objetivo" value={GOAL_LABEL[goal]} />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 && (
            <Pressable onPress={() => setStep(s => s - 1)} style={styles.secondaryBtn} testID="setup-back">
              <Text style={styles.secondaryTxt}>Voltar</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => (step < 3 ? setStep(s => s + 1) : submit())}
            style={styles.primaryBtn}
            disabled={saving}
            testID="setup-next"
          >
            {saving ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.primaryTxt}>{step < 3 ? 'Continuar' : 'Concluir'}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress, testID }: any) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={[styles.chip, active && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}
    >
      <Text style={[styles.chipTxt, active && { color: colors.brandDark, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}
function OptionRow({ icon, label, active, onPress, testID }: any) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={[styles.optionRow, active && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}
    >
      <Ionicons name={icon} size={22} color={active ? colors.brandDark : colors.onSurfaceSecondary} />
      <Text style={[styles.optionTxt, active && { color: colors.brandDark, fontWeight: '700' }]}>{label}</Text>
      {active && <Ionicons name="checkmark-circle" size={22} color={colors.brandPrimary} style={{ marginLeft: 'auto' }} />}
    </Pressable>
  );
}
function SummaryRow({ icon, label, value }: any) {
  return (
    <View style={styles.sumRow}>
      <View style={styles.sumIcon}><Ionicons name={icon} size={20} color={colors.brandPrimary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.caption, color: colors.muted }}>{label}</Text>
        <Text style={{ ...typography.headline, color: colors.onSurface }}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.sm },
  step: { ...typography.caption, color: colors.muted },
  progress: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.brandPrimary, borderRadius: 3 },
  content: { padding: spacing.xl },
  section: { gap: spacing.md },
  title: { ...typography.displayMedium, color: colors.onSurface },
  sub: { ...typography.body, color: colors.onSurfaceSecondary, marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.onSurfaceSecondary, marginTop: spacing.md },
  input: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border, ...typography.headline, color: colors.onSurface,
  },
  chipsRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chipsWrap: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary,
  },
  chipTxt: { ...typography.caption, color: colors.onSurfaceSecondary },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary,
  },
  optionTxt: { ...typography.body, color: colors.onSurface },
  summary: { gap: spacing.md, marginTop: spacing.md },
  sumRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  sumIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', gap: spacing.md, padding: spacing.xl, paddingTop: spacing.md },
  primaryBtn: { flex: 1, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
  primaryTxt: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 16, paddingHorizontal: spacing.xl, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  secondaryTxt: { color: colors.onSurface, fontSize: 16, fontWeight: '600' },
});
