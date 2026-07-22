import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
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

const GOALS: { key: string; label: string; icon: any }[] = [
  { key: 'lose', label: 'Perder peso', icon: 'trending-down' },
  { key: 'maintain', label: 'Manter peso', icon: 'remove' },
  { key: 'gain', label: 'Ganhar massa', icon: 'trending-up' },
  { key: 'improve_health', label: 'Melhorar saúde', icon: 'heart' },
];
const GENDERS: { key: string; label: string }[] = [
  { key: 'male', label: 'Masculino' }, { key: 'female', label: 'Feminino' }, { key: 'other', label: 'Outro' },
];

function parseDateBr(s: string): string | null {
  // Accepts dd/mm/yyyy → iso
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const iso = `${y}-${mo}-${d}`;
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return null;
  return iso;
}
function isoToBr(iso?: string | null): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export default function ProfileEdit() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { user, refresh } = useAuth();
  const [photo, setPhoto] = useState<string | null>(user?.photo_base64 || null);
  const [name, setName] = useState(user?.name || '');
  const [gender, setGender] = useState<string>(user?.gender || 'male');
  const [birth, setBirth] = useState(isoToBr(user?.birth_date));
  const [height, setHeight] = useState(user?.height_cm ? String(user.height_cm) : '');
  const [startWeight, setStartWeight] = useState(user?.starting_weight_kg ? String(user.starting_weight_kg) : '');
  const [goalWeight, setGoalWeight] = useState(user?.goal_weight_kg ? String(user.goal_weight_kg) : '');
  const [currentWeight, setCurrentWeight] = useState('');
  const [goal, setGoal] = useState<string>(user?.goal || 'maintain');
  const [targetDate, setTargetDate] = useState(isoToBr(user?.target_date));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError('Permissão negada'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({
      base64: true, quality: 0.6, allowsEditing: true, aspect: [1, 1],
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (r.canceled || !r.assets?.[0]?.base64) return;
    setPhoto(r.assets[0].base64);
  };

  const save = async () => {
    setError(null); setSaving(true);
    try {
      const body: any = { name, gender, goal };
      if (birth) {
        const iso = parseDateBr(birth);
        if (!iso) throw new Error('Data de nascimento inválida (use dd/mm/aaaa)');
        body.birth_date = iso;
      }
      if (targetDate) {
        const iso = parseDateBr(targetDate);
        if (!iso) throw new Error('Data-meta inválida (use dd/mm/aaaa)');
        body.target_date = iso;
      }
      if (height) body.height_cm = parseFloat(height.replace(',', '.'));
      if (startWeight) body.starting_weight_kg = parseFloat(startWeight.replace(',', '.'));
      if (goalWeight) body.goal_weight_kg = parseFloat(goalWeight.replace(',', '.'));
      if (photo !== user?.photo_base64) body.photo_base64 = photo;
      await api('/profile', { method: 'PUT', body });
      if (currentWeight) {
        await api('/weight', { method: 'POST', body: { weight_kg: parseFloat(currentWeight.replace(',', '.')) } });
      }
      await refresh();
      router.back();
    } catch (e: any) {
      setError(e?.message || 'Falha ao salvar');
    } finally { setSaving(false); }
  };

  return (
    <View style={s.root} testID="profile-edit-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={s.back} testID="profile-edit-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title}>Editar perfil</Text>
          <View style={{ width: 34 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* Photo */}
          <View style={s.photoWrap}>
            <Pressable style={s.photoBtn} onPress={pickPhoto} testID="profile-edit-photo">
              {photo ? (
                <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={s.photoImg} contentFit="cover" />
              ) : (
                <Ionicons name="camera" size={32} color={colors.brandDark} />
              )}
              <View style={s.photoBadge}>
                <Ionicons name="pencil" size={14} color={colors.onBrandPrimary} />
              </View>
            </Pressable>
            <Text style={s.photoTxt}>Toque para {photo ? 'alterar' : 'adicionar'} foto</Text>
          </View>

          <Label colors={colors} text="Nome" />
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Seu nome"
            placeholderTextColor={colors.muted} testID="profile-edit-name" />

          <Label colors={colors} text="Sexo" />
          <View style={s.chipsRow}>
            {GENDERS.map(g => (
              <Pressable key={g.key} onPress={() => setGender(g.key)}
                style={[s.chip, gender === g.key && s.chipActive]} testID={`profile-edit-gender-${g.key}`}>
                <Text style={[s.chipTxt, gender === g.key && { color: colors.onBrandPrimary, fontWeight: '700' }]}>{g.label}</Text>
              </Pressable>
            ))}
          </View>

          <Label colors={colors} text="Data de nascimento" />
          <TextInput style={s.input} value={birth} onChangeText={setBirth} placeholder="dd/mm/aaaa"
            placeholderTextColor={colors.muted} keyboardType="numbers-and-punctuation" testID="profile-edit-birth" />

          <View style={s.gridRow}>
            <View style={{ flex: 1 }}>
              <Label colors={colors} text="Altura (cm)" />
              <TextInput style={s.input} value={height} onChangeText={setHeight} keyboardType="decimal-pad"
                placeholder="170" placeholderTextColor={colors.muted} testID="profile-edit-height" />
            </View>
            <View style={{ flex: 1 }}>
              <Label colors={colors} text="Peso inicial (kg)" />
              <TextInput style={s.input} value={startWeight} onChangeText={setStartWeight} keyboardType="decimal-pad"
                placeholder="0.0" placeholderTextColor={colors.muted} testID="profile-edit-start" />
            </View>
          </View>

          <View style={s.gridRow}>
            <View style={{ flex: 1 }}>
              <Label colors={colors} text="Peso atual (kg)" />
              <TextInput style={s.input} value={currentWeight} onChangeText={setCurrentWeight} keyboardType="decimal-pad"
                placeholder="registra novo" placeholderTextColor={colors.muted} testID="profile-edit-current" />
            </View>
            <View style={{ flex: 1 }}>
              <Label colors={colors} text="Peso meta (kg)" />
              <TextInput style={s.input} value={goalWeight} onChangeText={setGoalWeight} keyboardType="decimal-pad"
                placeholder="0.0" placeholderTextColor={colors.muted} testID="profile-edit-goal-weight" />
            </View>
          </View>

          <Label colors={colors} text="Objetivo" />
          <View style={s.goalsCol}>
            {GOALS.map(g => (
              <Pressable key={g.key} onPress={() => setGoal(g.key)}
                style={[s.goalRow, goal === g.key && s.goalRowActive]} testID={`profile-edit-goal-${g.key}`}>
                <View style={[s.goalIcon, goal === g.key && { backgroundColor: colors.brandDark }]}>
                  <Ionicons name={g.icon} size={18} color={goal === g.key ? colors.brandPrimary : colors.brandDark} />
                </View>
                <Text style={[s.goalTxt, goal === g.key && { fontWeight: '700' }]}>{g.label}</Text>
                {goal === g.key && <Ionicons name="checkmark-circle" size={20} color={colors.brandDark} style={{ marginLeft: 'auto' }} />}
              </Pressable>
            ))}
          </View>

          <Label colors={colors} text="Data-meta" />
          <TextInput style={s.input} value={targetDate} onChangeText={setTargetDate} placeholder="dd/mm/aaaa"
            placeholderTextColor={colors.muted} keyboardType="numbers-and-punctuation" testID="profile-edit-target-date" />

          {error && <Text style={s.err} testID="profile-edit-error">{error}</Text>}

          <Pressable style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} testID="profile-edit-save">
            {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.saveTxt}>Salvar alterações</Text>}
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

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.headline, color: colors.onSurface },
  content: { padding: spacing.xl, paddingTop: spacing.sm },
  photoWrap: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  photoBtn: { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  photoImg: { width: '100%', height: '100%', borderRadius: 55 },
  photoBadge: { position: 'absolute', right: 0, bottom: 4, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandDark, borderWidth: 3, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  photoTxt: { ...typography.caption, color: colors.muted },

  input: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, color: colors.onSurface, ...typography.body,
  },
  gridRow: { flexDirection: 'row', gap: spacing.md },
  chipsRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, flexShrink: 0 },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipTxt: { ...typography.caption, color: colors.onSurfaceSecondary },
  goalsCol: { gap: spacing.sm },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  goalRowActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  goalIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  goalTxt: { ...typography.body, color: colors.onSurface },
  err: { ...typography.caption, color: colors.error, marginTop: spacing.md, textAlign: 'center' },
  saveBtn: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center', marginTop: spacing.xl },
  saveTxt: { color: colors.onBrandPrimary, fontWeight: '700', ...typography.body },
});
