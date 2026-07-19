import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Source = 'manual' | 'bluetooth';

function pad(n: number): string { return n < 10 ? `0${n}` : `${n}`; }
function todayIso(): string { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function nowHm(): string { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function isoToBr(iso: string): string { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
function brToIso(br: string): string | null {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export default function WeightLog() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [weight, setWeight] = useState('');
  const [dateBr, setDateBr] = useState(isoToBr(todayIso()));
  const [time, setTime] = useState(nowHm());
  const [note, setNote] = useState('');
  const [source, setSource] = useState<Source>('manual');
  const [bodyFat, setBodyFat] = useState('');
  const [muscle, setMuscle] = useState('');
  const [waterPct, setWaterPct] = useState('');
  const [waist, setWaist] = useState('');
  const [hip, setHip] = useState('');
  const [showExtra, setShowExtra] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const kg = parseFloat(weight.replace(',', '.'));
    if (!kg || kg < 20 || kg > 400) { setError('Informe um peso válido (20–400 kg)'); return; }
    const iso = brToIso(dateBr);
    if (!iso) { setError('Data inválida (use dd/mm/aaaa)'); return; }
    setSaving(true);
    try {
      const body: any = {
        weight_kg: kg, date: iso, time,
        source, note: note.trim() || undefined,
      };
      const num = (v: string) => v ? parseFloat(v.replace(',', '.')) : undefined;
      if (bodyFat) body.body_fat_pct = num(bodyFat);
      if (muscle) body.muscle_mass_kg = num(muscle);
      if (waterPct) body.body_water_pct = num(waterPct);
      if (waist) body.waist_cm = num(waist);
      if (hip) body.hip_cm = num(hip);
      await api('/weight', { method: 'POST', body });
      router.back();
    } catch (e: any) {
      setError(e?.message || 'Falha ao salvar');
    } finally { setSaving(false); }
  };

  return (
    <View style={s.root} testID="weight-log-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.back} testID="weight-log-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title}>Registrar peso</Text>
          <View style={{ width: 34 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* Hero weight input */}
          <View style={s.hero}>
            <Text style={s.heroLabel}>Peso</Text>
            <View style={s.heroInputRow}>
              <TextInput
                testID="weight-log-weight"
                style={s.heroInput}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder="0,0"
                placeholderTextColor={colors.muted}
              />
              <Text style={s.heroUnit}>kg</Text>
            </View>
          </View>

          {/* Date & Time */}
          <View style={s.gridRow}>
            <View style={{ flex: 1 }}>
              <Label colors={colors} text="Data" />
              <TextInput style={s.input} value={dateBr} onChangeText={setDateBr}
                placeholder="dd/mm/aaaa" placeholderTextColor={colors.muted}
                keyboardType="numbers-and-punctuation" testID="weight-log-date" />
            </View>
            <View style={{ flex: 1 }}>
              <Label colors={colors} text="Hora" />
              <TextInput style={s.input} value={time} onChangeText={setTime}
                placeholder="HH:MM" placeholderTextColor={colors.muted}
                keyboardType="numbers-and-punctuation" testID="weight-log-time" />
            </View>
          </View>

          {/* Origem */}
          <Label colors={colors} text="Origem" />
          <View style={s.originRow}>
            <SourceChip colors={colors} icon="hand-left" label="Manual" active={source === 'manual'}
              onPress={() => setSource('manual')} testID="weight-log-source-manual" />
            <SourceChip colors={colors} icon="bluetooth" label="Balança Bluetooth" active={source === 'bluetooth'}
              onPress={() => setSource('bluetooth')} testID="weight-log-source-bluetooth" />
          </View>
          {source === 'bluetooth' && (
            <View style={s.hint}>
              <Ionicons name="information-circle" size={16} color={colors.brandDark} />
              <Text style={s.hintTxt}>Conexão com balança Bluetooth chega em breve. Por enquanto os dados são registrados manualmente.</Text>
            </View>
          )}

          {/* Observação */}
          <Label colors={colors} text="Observação (opcional)" />
          <TextInput
            style={[s.input, { minHeight: 88, textAlignVertical: 'top' }]}
            value={note} onChangeText={setNote}
            placeholder="Como você se sente hoje?" placeholderTextColor={colors.muted}
            multiline testID="weight-log-note"
          />

          {/* Composição corporal (opcional) */}
          <Pressable style={s.toggle} onPress={() => setShowExtra(v => !v)} testID="weight-log-extra-toggle">
            <Ionicons name={showExtra ? 'chevron-up' : 'body'} size={18} color={colors.onSurface} />
            <Text style={s.toggleTxt}>Composição corporal (opcional)</Text>
          </Pressable>
          {showExtra && (
            <View style={s.extraBox}>
              <View style={s.gridRow}>
                <View style={{ flex: 1 }}>
                  <Label colors={colors} text="Gordura (%)" />
                  <TextInput style={s.input} value={bodyFat} onChangeText={setBodyFat} keyboardType="decimal-pad"
                    placeholder="0,0" placeholderTextColor={colors.muted} testID="weight-log-fat" />
                </View>
                <View style={{ flex: 1 }}>
                  <Label colors={colors} text="Massa muscular (kg)" />
                  <TextInput style={s.input} value={muscle} onChangeText={setMuscle} keyboardType="decimal-pad"
                    placeholder="0,0" placeholderTextColor={colors.muted} testID="weight-log-muscle" />
                </View>
              </View>
              <View style={s.gridRow}>
                <View style={{ flex: 1 }}>
                  <Label colors={colors} text="Água (%)" />
                  <TextInput style={s.input} value={waterPct} onChangeText={setWaterPct} keyboardType="decimal-pad"
                    placeholder="0,0" placeholderTextColor={colors.muted} testID="weight-log-water" />
                </View>
              </View>
              <View style={s.gridRow}>
                <View style={{ flex: 1 }}>
                  <Label colors={colors} text="Cintura (cm)" />
                  <TextInput style={s.input} value={waist} onChangeText={setWaist} keyboardType="decimal-pad"
                    placeholder="0,0" placeholderTextColor={colors.muted} testID="weight-log-waist" />
                </View>
                <View style={{ flex: 1 }}>
                  <Label colors={colors} text="Quadril (cm)" />
                  <TextInput style={s.input} value={hip} onChangeText={setHip} keyboardType="decimal-pad"
                    placeholder="0,0" placeholderTextColor={colors.muted} testID="weight-log-hip" />
                </View>
              </View>
            </View>
          )}

          {error && <Text style={s.err} testID="weight-log-error">{error}</Text>}

          <Pressable style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} testID="weight-log-save">
            {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
              <>
                <Ionicons name="checkmark" size={18} color={colors.onBrandPrimary} />
                <Text style={s.saveTxt}>Salvar medição</Text>
              </>
            )}
          </Pressable>
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Label({ colors, text }: { colors: ThemeColors; text: string }) {
  return <Text style={{ ...typography.caption, color: colors.muted, marginTop: spacing.md, marginBottom: 6, marginLeft: 4 }}>{text}</Text>;
}

function SourceChip({ colors, icon, label, active, onPress, testID }: any) {
  return (
    <Pressable onPress={onPress} testID={testID}
      style={{
        flex: 1, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center',
        padding: spacing.md, borderRadius: radius.md,
        backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary,
        borderWidth: 1, borderColor: active ? colors.brandPrimary : colors.border,
      }}>
      <Ionicons name={icon} size={16} color={active ? colors.brandDark : colors.onSurface} />
      <Text style={{
        ...typography.caption, color: active ? colors.brandDark : colors.onSurface,
        fontWeight: active ? '700' : '500',
      }}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.headline, color: colors.onSurface },
  content: { padding: spacing.xl, paddingTop: spacing.sm },

  hero: { backgroundColor: colors.surfaceInverse, borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.md, alignItems: 'center' },
  heroLabel: { ...typography.caption, color: colors.onSurfaceInverse, opacity: 0.7 },
  heroInputRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.sm },
  heroInput: {
    fontSize: 56, fontWeight: '700', color: colors.brandPrimary, letterSpacing: -1,
    textAlign: 'center', minWidth: 140,
  },
  heroUnit: { fontSize: 20, color: colors.onSurfaceInverse, opacity: 0.7, fontWeight: '600' },

  gridRow: { flexDirection: 'row', gap: spacing.md },
  input: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, color: colors.onSurface, ...typography.body,
  },
  originRow: { flexDirection: 'row', gap: spacing.md },
  hint: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.sm },
  hintTxt: { flex: 1, ...typography.caption, color: colors.brandDark, lineHeight: 18, fontWeight: '600' },

  toggle: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, marginTop: spacing.md },
  toggleTxt: { ...typography.body, color: colors.onSurface, fontWeight: '600' },
  extraBox: { gap: 0 },

  err: { ...typography.caption, color: colors.error, marginTop: spacing.md, textAlign: 'center' },
  saveBtn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingVertical: 16, marginTop: spacing.xl },
  saveTxt: { color: colors.onBrandPrimary, fontWeight: '700', ...typography.body },
});
