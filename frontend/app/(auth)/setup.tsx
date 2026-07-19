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

type Goal = 'lose' | 'maintain' | 'gain' | 'improve_health';
type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
type Gender = 'male' | 'female' | 'other';

const GOAL_LABEL: Record<Goal, string> = {
  lose: 'Perder peso', maintain: 'Manter peso', gain: 'Ganhar massa', improve_health: 'Melhorar saúde',
};
const GOAL_ICON: Record<Goal, any> = {
  lose: 'trending-down', maintain: 'remove', gain: 'trending-up', improve_health: 'heart',
};
const ACTIVITY_LABEL: Record<Activity, string> = {
  sedentary: 'Sedentário', light: 'Leve', moderate: 'Moderado', active: 'Ativo', very_active: 'Muito ativo',
};
const GENDER_LABEL: Record<Gender, string> = { male: 'Masculino', female: 'Feminino', other: 'Outro' };

const ACT_FACTOR: Record<Activity, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };

export default function Setup() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
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
      // default 90 days from now as target date
      const td = new Date(); td.setDate(td.getDate() + 90);
      await api('/profile', {
        method: 'PUT',
        body: {
          gender, birth_date: `${birthYear}-01-01`,
          height_cm: parseFloat(height),
          starting_weight_kg: parseFloat(weight),
          goal_weight_kg: parseFloat(target),
          goal, activity_level: activity,
          daily_calorie_goal: calorieGoal,
          target_date: td.toISOString().slice(0, 10),
        },
      });
      await api('/weight', { method: 'POST', body: { weight_kg: parseFloat(weight) } });
      await refresh();
      router.replace('/(tabs)');
    } catch (e) { console.log(e); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.header}>
          <Text style={s.step}>Passo {step + 1} de 4</Text>
          <View style={s.progress}>
            <View style={[s.progressFill, { width: `${((step + 1) / 4) * 100}%` }]} />
          </View>
        </View>

        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <View style={s.section}>
              <Text style={s.title}>Olá, {user?.name?.split(' ')[0]}! 👋</Text>
              <Text style={s.sub}>Vamos personalizar o VitaTracker para você.</Text>
              <Text style={s.label}>Sexo</Text>
              <View style={s.chipsRow}>
                {(Object.keys(GENDER_LABEL) as Gender[]).map(g => (
                  <Chip key={g} colors={colors} label={GENDER_LABEL[g]} active={gender === g} onPress={() => setGender(g)} testID={`setup-gender-${g}`} />
                ))}
              </View>
              <Text style={s.label}>Idade</Text>
              <TextInput style={s.input} value={age} onChangeText={setAge} keyboardType="number-pad" testID="setup-age" placeholderTextColor={colors.muted} />
            </View>
          )}
          {step === 1 && (
            <View style={s.section}>
              <Text style={s.title}>Suas medidas</Text>
              <Text style={s.sub}>Usamos para calcular seu metabolismo basal.</Text>
              <Text style={s.label}>Altura (cm)</Text>
              <TextInput style={s.input} value={height} onChangeText={setHeight} keyboardType="decimal-pad" testID="setup-height" placeholderTextColor={colors.muted} />
              <Text style={s.label}>Peso atual (kg)</Text>
              <TextInput style={s.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" testID="setup-weight" placeholderTextColor={colors.muted} />
              <Text style={s.label}>Peso meta (kg)</Text>
              <TextInput style={s.input} value={target} onChangeText={setTarget} keyboardType="decimal-pad" testID="setup-target" placeholderTextColor={colors.muted} />
            </View>
          )}
          {step === 2 && (
            <View style={s.section}>
              <Text style={s.title}>Seu objetivo</Text>
              <Text style={s.sub}>Isso define seu plano diário.</Text>
              {(Object.keys(GOAL_LABEL) as Goal[]).map(g => (
                <OptionRow key={g} colors={colors} label={GOAL_LABEL[g]} active={goal === g} onPress={() => setGoal(g)}
                  testID={`setup-goal-${g}`} icon={GOAL_ICON[g]} />
              ))}
              <Text style={s.label}>Nível de atividade</Text>
              <View style={s.chipsWrap}>
                {(Object.keys(ACTIVITY_LABEL) as Activity[]).map(a => (
                  <Chip key={a} colors={colors} label={ACTIVITY_LABEL[a]} active={activity === a} onPress={() => setActivity(a)} testID={`setup-act-${a}`} />
                ))}
              </View>
            </View>
          )}
          {step === 3 && (
            <View style={s.section}>
              <Text style={s.title}>Seu plano diário</Text>
              <Text style={s.sub}>Calculamos com base nas suas informações.</Text>
              <View style={s.summary}>
                <SummaryRow colors={colors} icon="flame" label="Meta de calorias" value={`${calorieGoal} kcal`} />
                <SummaryRow colors={colors} icon="water" label="Meta de água" value="2000 ml" />
                <SummaryRow colors={colors} icon="footsteps" label="Meta de passos" value="8000 passos" />
                <SummaryRow colors={colors} icon="fitness" label="Objetivo" value={GOAL_LABEL[goal]} />
                <SummaryRow colors={colors} icon="calendar" label="Meta em" value="90 dias" />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={s.footer}>
          {step > 0 && (
            <Pressable onPress={() => setStep(x => x - 1)} style={s.secondaryBtn} testID="setup-back">
              <Text style={s.secondaryTxt}>Voltar</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => (step < 3 ? setStep(x => x + 1) : submit())}
            style={s.primaryBtn}
            disabled={saving}
            testID="setup-next"
          >
            {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
              <Text style={s.primaryTxt}>{step < 3 ? 'Continuar' : 'Concluir'}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Chip({ colors, label, active, onPress, testID }: any) {
  const s = makeStyles(colors);
  return (
    <Pressable onPress={onPress} testID={testID}
      style={[s.chip, active && { borderColor: colors.brandPrimary, backgroundColor: colors.brandPrimary }]}>
      <Text style={[s.chipTxt, active && { color: colors.onBrandPrimary, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}
function OptionRow({ colors, icon, label, active, onPress, testID }: any) {
  const s = makeStyles(colors);
  return (
    <Pressable onPress={onPress} testID={testID}
      style={[s.optionRow, active && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}>
      <Ionicons name={icon} size={22} color={active ? colors.onBrandTertiary : colors.onSurfaceSecondary} />
      <Text style={[s.optionTxt, active && { color: colors.onBrandTertiary, fontWeight: '700' }]}>{label}</Text>
      {active && <Ionicons name="checkmark-circle" size={22} color={colors.brandPrimary} style={{ marginLeft: 'auto' }} />}
    </Pressable>
  );
}
function SummaryRow({ colors, icon, label, value }: any) {
  const s = makeStyles(colors);
  return (
    <View style={s.sumRow}>
      <View style={s.sumIcon}><Ionicons name={icon} size={20} color={colors.brandDark} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.caption, color: colors.muted }}>{label}</Text>
        <Text style={{ ...typography.headline, color: colors.onSurface }}>{value}</Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
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
  sumIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', gap: spacing.md, padding: spacing.xl, paddingTop: spacing.md },
  primaryBtn: { flex: 1, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
  primaryTxt: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 16, paddingHorizontal: spacing.xl, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  secondaryTxt: { color: colors.onSurface, fontSize: 16, fontWeight: '600' },
});
