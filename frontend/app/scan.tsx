import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { colors, radius, shadow, spacing, typography } from '@/src/theme';

type Analysis = {
  name: string; portion?: string; calories: number; protein_g: number;
  carbs_g: number; fat_g: number; confidence?: number; tips?: string;
};

const MEAL_LABEL: Record<string, string> = {
  breakfast: 'Café da manhã', lunch: 'Almoço', dinner: 'Jantar', snack: 'Lanche',
};

export default function Scan() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal_type?: string }>();
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mealType, setMealType] = useState<string>(params.meal_type || 'snack');

  const pickImage = async (source: 'camera' | 'library') => {
    setError(null);
    let perm;
    if (source === 'camera') {
      perm = await ImagePicker.requestCameraPermissionsAsync();
    } else {
      perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
    if (!perm.granted) { setError('Permissão negada'); return; }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6, mediaTypes: ImagePicker.MediaTypeOptions.Images })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    setImageBase64(result.assets[0].base64);
    setImageUri(result.assets[0].uri);
    analyze(result.assets[0].base64);
  };

  const analyze = async (b64: string) => {
    setAnalyzing(true); setAnalysis(null); setError(null);
    try {
      const r = await api<{ analysis: Analysis }>('/meals/analyze', {
        method: 'POST', body: { image_base64: b64, meal_type: mealType },
      });
      setAnalysis(r.analysis);
    } catch (e: any) {
      setError(e?.message || 'Falha ao analisar');
    } finally { setAnalyzing(false); }
  };

  const save = async () => {
    if (!analysis) return;
    setSaving(true);
    try {
      await api('/meals', {
        method: 'POST',
        body: {
          name: analysis.name,
          meal_type: mealType,
          portion: analysis.portion,
          calories: analysis.calories,
          protein_g: analysis.protein_g,
          carbs_g: analysis.carbs_g,
          fat_g: analysis.fat_g,
        },
      });
      router.replace('/(tabs)/food');
    } catch (e: any) { setError(e?.message || 'Falha ao salvar'); }
    finally { setSaving(false); }
  };

  return (
    <View style={styles.root} testID="scan-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back} testID="scan-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Escaneamento IA</Text>
          <View style={{ width: 34 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Meal type chips */}
        <View style={styles.chipsRow}>
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(k => (
            <Pressable
              key={k}
              onPress={() => setMealType(k)}
              style={[styles.chip, mealType === k && styles.chipActive]}
              testID={`scan-mealtype-${k}`}
            >
              <Text style={[styles.chipTxt, mealType === k && { color: colors.brandDark, fontWeight: '700' }]}>{MEAL_LABEL[k]}</Text>
            </Pressable>
          ))}
        </View>

        {/* Image area */}
        <View style={styles.imageBox}>
          {imageUri ? (
            <Image source={imageUri} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          ) : (
            <View style={styles.imageEmpty}>
              <Ionicons name="restaurant-outline" size={44} color={colors.muted} />
              <Text style={styles.imageHint}>Tire ou envie uma foto da sua refeição</Text>
            </View>
          )}
          {analyzing && (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.overlayTxt}>Analisando com IA…</Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable style={styles.actBtn} onPress={() => pickImage('camera')} testID="scan-camera-btn">
            <Ionicons name="camera" size={20} color={colors.onSurface} />
            <Text style={styles.actTxt}>Câmera</Text>
          </Pressable>
          <Pressable style={styles.actBtn} onPress={() => pickImage('library')} testID="scan-library-btn">
            <Ionicons name="images" size={20} color={colors.onSurface} />
            <Text style={styles.actTxt}>Galeria</Text>
          </Pressable>
        </View>

        {error && <Text style={styles.error} testID="scan-error">{error}</Text>}

        {/* Analysis result */}
        {analysis && (
          <View style={styles.result} testID="scan-result">
            <View style={styles.resultHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName}>{analysis.name}</Text>
                {analysis.portion && <Text style={styles.resultPortion}>{analysis.portion}</Text>}
              </View>
              <View style={styles.calBadge}>
                <Text style={styles.calTxt}>{Math.round(analysis.calories)}</Text>
                <Text style={styles.calUnit}>kcal</Text>
              </View>
            </View>

            <View style={styles.macroRow}>
              <Macro label="Proteína" value={analysis.protein_g} tint="#E07A5F" />
              <Macro label="Carbo" value={analysis.carbs_g} tint="#F4A261" />
              <Macro label="Gordura" value={analysis.fat_g} tint="#4A7258" />
            </View>

            {analysis.tips && (
              <View style={styles.tipBox}>
                <Ionicons name="bulb" size={16} color={colors.brandDark} />
                <Text style={styles.tipTxt}>{analysis.tips}</Text>
              </View>
            )}

            <Pressable
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={save}
              disabled={saving}
              testID="scan-save-button"
            >
              {saving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.saveTxt}>Adicionar ao Diário</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

function Macro({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <View style={[styles.macroBox, { borderLeftColor: tint }]}>
      <Text style={{ ...typography.small, color: colors.muted }}>{label}</Text>
      <Text style={{ ...typography.headline, color: colors.onSurface }}>{Math.round(value)}g</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.headline, color: colors.onSurface },
  content: { padding: spacing.xl, gap: spacing.lg },
  chipsRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, flexShrink: 0 },
  chipActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary },
  chipTxt: { ...typography.caption, color: colors.onSurfaceSecondary },
  imageBox: { height: 240, borderRadius: radius.lg, backgroundColor: colors.surfaceTertiary, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  imageEmpty: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  imageHint: { ...typography.caption, color: colors.muted, textAlign: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  overlayTxt: { color: '#fff', ...typography.bodyStrong },
  actions: { flexDirection: 'row', gap: spacing.md },
  actBtn: { flex: 1, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  actTxt: { ...typography.body, color: colors.onSurface, fontWeight: '600' },
  error: { ...typography.caption, color: colors.error, textAlign: 'center' },
  result: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card, gap: spacing.md },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  resultName: { ...typography.title, color: colors.onSurface },
  resultPortion: { ...typography.caption, color: colors.muted, marginTop: 2 },
  calBadge: { alignItems: 'center', backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, minWidth: 80 },
  calTxt: { fontSize: 20, fontWeight: '700', color: colors.brandDark },
  calUnit: { ...typography.small, color: colors.brandDark },
  macroRow: { flexDirection: 'row', gap: spacing.sm },
  macroBox: { flex: 1, borderLeftWidth: 3, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.sm, gap: 2 },
  tipBox: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', backgroundColor: colors.brandTertiary, padding: spacing.md, borderRadius: radius.md },
  tipTxt: { flex: 1, ...typography.caption, color: colors.brandDark, lineHeight: 18 },
  saveBtn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPrimary, paddingVertical: 14, borderRadius: radius.pill },
  saveTxt: { color: '#fff', fontWeight: '700', ...typography.body },
});
