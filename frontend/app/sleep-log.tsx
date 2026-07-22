import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Quality = 'poor' | 'ok' | 'good' | 'great';
type Sleep = {
  id: string; date: string; hours: number; quality?: Quality;
  rem_hours?: number; deep_hours?: number; light_hours?: number;
  bedtime?: string; wake_time?: string; note?: string;
};

const Q: { key: Quality; label: string; icon: any; color: string }[] = [
  { key: 'poor', label: 'Ruim', icon: 'sad', color: '#E05A5F' },
  { key: 'ok', label: 'Ok', icon: 'remove-circle', color: '#F4A261' },
  { key: 'good', label: 'Bom', icon: 'happy', color: '#7FCB8E' },
  { key: 'great', label: 'Ótimo', icon: 'star', color: '#C6F14B' },
];

export default function SleepLog() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [items, setItems] = useState<Sleep[]>([]);
  const [hours, setHours] = useState('8');
  const [quality, setQuality] = useState<Quality>('good');
  const [bedtime, setBedtime] = useState('23:00');
  const [wake, setWake] = useState('07:00');
  const [rem, setRem] = useState('');
  const [deep, setDeep] = useState('');
  const [light, setLight] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api<{ items: Sleep[] }>('/sleep'); setItems(r.items || []); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    const h = parseFloat(hours.replace(',', '.'));
    if (!h || h <= 0 || h > 20) return;
    setSaving(true);
    try {
      const num = (v: string) => v ? parseFloat(v.replace(',', '.')) : undefined;
      await api('/sleep', { method: 'POST', body: {
        hours: h, quality,
        bedtime: bedtime || undefined, wake_time: wake || undefined,
        rem_hours: num(rem), deep_hours: num(deep), light_hours: num(light),
        note: note.trim() || undefined,
      } });
      setNote(''); setRem(''); setDeep(''); setLight('');
      await load();
    } finally { setSaving(false); }
  };

  const goal = user?.daily_sleep_hours_goal ?? 8;
  const last7 = items.slice(0, 7).reverse();

  return (
    <View style={s.root} testID="sleep-log-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={s.back} testID="sleep-log-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title}>Sono</Text>
          <View style={{ width: 34 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* Hero */}
          {items[0] && (
            <View style={s.hero}>
              <Ionicons name="moon" size={28} color={colors.brandPrimary} />
              <Text style={s.heroVal}>{items[0].hours}h</Text>
              <Text style={s.heroMeta}>última noite • meta {goal}h</Text>
              {(items[0].rem_hours || items[0].deep_hours || items[0].light_hours) && (
                <View style={s.stagesRow}>
                  <StageChip colors={colors} label="Leve" value={items[0].light_hours} color="#8AB4C9" />
                  <StageChip colors={colors} label="Profundo" value={items[0].deep_hours} color="#4A5D8C" />
                  <StageChip colors={colors} label="REM" value={items[0].rem_hours} color="#C6F14B" />
                </View>
              )}
            </View>
          )}

          {/* Week chart */}
          {last7.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Últimos 7 dias</Text>
              <SleepChart colors={colors} data={last7} goal={goal} />
            </View>
          )}

          {/* Registrar */}
          <Text style={s.sectionLabel}>Registrar noite</Text>
          <View style={s.gridRow}>
            <View style={{ flex: 1 }}>
              <Label colors={colors} text="Horas dormidas" />
              <TextInput style={s.input} value={hours} onChangeText={setHours}
                keyboardType="decimal-pad" testID="sleep-hours" placeholderTextColor={colors.muted} />
            </View>
          </View>

          <View style={s.gridRow}>
            <View style={{ flex: 1 }}>
              <Label colors={colors} text="Dormiu às" />
              <TextInput style={s.input} value={bedtime} onChangeText={setBedtime}
                placeholder="23:00" placeholderTextColor={colors.muted} testID="sleep-bedtime" />
            </View>
            <View style={{ flex: 1 }}>
              <Label colors={colors} text="Acordou às" />
              <TextInput style={s.input} value={wake} onChangeText={setWake}
                placeholder="07:00" placeholderTextColor={colors.muted} testID="sleep-wake" />
            </View>
          </View>

          <Label colors={colors} text="Qualidade" />
          <View style={s.qualityRow}>
            {Q.map(q => (
              <Pressable key={q.key} onPress={() => setQuality(q.key)}
                style={[s.qChip, quality === q.key && { backgroundColor: q.color, borderColor: q.color }]}
                testID={`sleep-quality-${q.key}`}>
                <Ionicons name={q.icon} size={16} color={quality === q.key ? '#0F1110' : colors.onSurface} />
                <Text style={[s.qTxt, quality === q.key && { color: '#0F1110', fontWeight: '700' }]}>{q.label}</Text>
              </Pressable>
            ))}
          </View>

          <Label colors={colors} text="Estágios (opcional, se rastreado por wearable)" />
          <View style={s.gridRow}>
            <View style={{ flex: 1 }}>
              <TextInput style={s.input} value={light} onChangeText={setLight}
                placeholder="Leve (h)" keyboardType="decimal-pad" placeholderTextColor={colors.muted} testID="sleep-light" />
            </View>
            <View style={{ flex: 1 }}>
              <TextInput style={s.input} value={deep} onChangeText={setDeep}
                placeholder="Profundo (h)" keyboardType="decimal-pad" placeholderTextColor={colors.muted} testID="sleep-deep" />
            </View>
            <View style={{ flex: 1 }}>
              <TextInput style={s.input} value={rem} onChangeText={setRem}
                placeholder="REM (h)" keyboardType="decimal-pad" placeholderTextColor={colors.muted} testID="sleep-rem" />
            </View>
          </View>

          <Pressable style={[s.saveBtn, saving && { opacity: 0.5 }]} onPress={save} disabled={saving} testID="sleep-save">
            {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.saveTxt}>Salvar noite</Text>}
          </Pressable>

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function StageChip({ colors, label, value, color }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ ...typography.small, color: colors.onSurfaceInverse, opacity: 0.7 }}>{label}</Text>
      <Text style={{ ...typography.bodyStrong, color: colors.onSurfaceInverse }}>{value != null ? `${value}h` : '—'}</Text>
    </View>
  );
}

function SleepChart({ colors, data, goal }: { colors: ThemeColors; data: Sleep[]; goal: number }) {
  const W = 320, H = 140, P = 24;
  const bw = (W - P * 2) / data.length - 6;
  const maxH = Math.max(goal + 1, ...data.map(d => d.hours || 0));
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {data.map((d, i) => {
        const h = ((d.hours || 0) / maxH) * (H - P * 2);
        const x = P + i * (bw + 6);
        const y = H - P - h;
        const fill = (d.hours || 0) >= goal * 0.9 ? colors.brandPrimary : colors.muted;
        return <Rect key={i} x={x} y={y} width={bw} height={h} rx={4} fill={fill} />;
      })}
      <Rect x={P} y={H - P - (goal / maxH) * (H - P * 2)} width={W - P * 2} height={1.5} fill={colors.brandSecondary} opacity={0.6} />
    </Svg>
  );
}

function Label({ colors, text }: { colors: ThemeColors; text: string }) {
  return <Text style={{ ...typography.caption, color: colors.muted, marginLeft: 4, marginTop: spacing.sm }}>{text}</Text>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.headline, color: colors.onSurface },
  content: { padding: spacing.xl, gap: spacing.sm },
  hero: { backgroundColor: colors.surfaceInverse, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', gap: spacing.xs },
  heroVal: { fontSize: 44, fontWeight: '700', color: colors.brandPrimary, letterSpacing: -1, marginTop: spacing.sm },
  heroMeta: { ...typography.caption, color: colors.onSurfaceInverse, opacity: 0.7 },
  stagesRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', width: '100%' },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...typography.bodyStrong, color: colors.onSurface, marginBottom: spacing.sm },
  sectionLabel: { ...typography.caption, color: colors.muted, marginLeft: spacing.md, marginTop: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, color: colors.onSurface, ...typography.body },
  gridRow: { flexDirection: 'row', gap: spacing.sm },
  qualityRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  qChip: { flex: 1, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  qTxt: { ...typography.small, color: colors.onSurface },
  saveBtn: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: spacing.xl },
  saveTxt: { color: colors.onBrandPrimary, fontWeight: '700', ...typography.body },
});
