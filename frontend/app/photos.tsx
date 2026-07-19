import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Photo = { id: string; date: string; weight_kg?: number; note?: string; image_base64: string };

export default function Photos() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [items, setItems] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api<{ items: Photo[] }>('/photos'); setItems(r.items || []); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const upload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      base64: true, quality: 0.5, mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (r.canceled || !r.assets?.[0]?.base64) return;
    setUploading(true);
    try {
      await api('/photos', { method: 'POST', body: { image_base64: r.assets[0].base64 } });
      await load();
    } catch {} finally { setUploading(false); }
  };

  const del = async (id: string) => { try { await api(`/photos/${id}`, { method: 'DELETE' }); load(); } catch {} };

  return (
    <View style={s.root} testID="photos-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.back} testID="photos-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title}>Fotos de progresso</Text>
          <Pressable onPress={upload} style={s.addBtn} testID="photos-add" disabled={uploading}>
            {uploading ? <ActivityIndicator size="small" color={colors.brandDark} /> :
              <Ionicons name="add" size={20} color={colors.brandDark} />}
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.content}>
        {items.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}><Ionicons name="images" size={40} color={colors.brandDark} /></View>
            <Text style={s.emptyTitle}>Adicione sua primeira foto</Text>
            <Text style={s.emptyTxt}>Documente sua evolução com fotos periódicas.</Text>
            <Pressable style={s.emptyBtn} onPress={upload} testID="photos-empty-add">
              <Ionicons name="camera" size={18} color={colors.onBrandPrimary} />
              <Text style={s.emptyBtnTxt}>Enviar foto</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.grid}>
            {items.map(p => (
              <View key={p.id} style={s.item}>
                <Image source={{ uri: `data:image/jpeg;base64,${p.image_base64}` }} style={s.img} contentFit="cover" />
                <View style={s.itemFooter}>
                  <Text style={s.itemDate}>{new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                  <Pressable onPress={() => del(p.id)} hitSlop={12} testID={`photos-del-${p.id}`}>
                    <Ionicons name="trash-outline" size={16} color={colors.muted} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.headline, color: colors.onSurface },
  addBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...typography.title, color: colors.onSurface },
  emptyTxt: { ...typography.caption, color: colors.muted, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl, paddingVertical: 12, borderRadius: radius.pill, marginTop: spacing.md },
  emptyBtnTxt: { color: colors.onBrandPrimary, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  item: { width: '48%', gap: spacing.xs },
  img: { width: '100%', aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 },
  itemDate: { ...typography.small, color: colors.muted },
});
