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
type Tab = 'album' | 'timeline' | 'compare';
type Analysis = { progress_score?: number; changes?: string[]; encouragement?: string; summary?: string };

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export default function Photos() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [items, setItems] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<Tab>('album');
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    try { await api('/photos', { method: 'POST', body: { image_base64: r.assets[0].base64 } }); await load(); }
    catch {} finally { setUploading(false); }
  };

  const del = async (id: string) => { try { await api(`/photos/${id}`, { method: 'DELETE' }); load(); } catch {} };

  // Timeline: group by month desc
  const timeline = useMemo(() => {
    const groups: Record<string, Photo[]> = {};
    for (const p of items) {
      const key = fmtMonth(p.date);
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return Object.entries(groups);
  }, [items]);

  const beforePhoto = items.find(p => p.id === beforeId) || null;
  const afterPhoto = items.find(p => p.id === afterId) || null;

  // auto-suggest first and last
  const suggestPair = () => {
    if (items.length >= 2) {
      const asc = [...items].reverse();
      setBeforeId(asc[0].id);
      setAfterId(asc[asc.length - 1].id);
    }
  };

  const compareIA = async () => {
    if (!beforeId || !afterId || beforeId === afterId) {
      setError('Selecione duas fotos diferentes'); return;
    }
    setError(null); setAnalysis(null); setAnalyzing(true);
    try {
      const r = await api<{ analysis: Analysis }>('/photos/compare', {
        method: 'POST', body: { photo_id_before: beforeId, photo_id_after: afterId },
      });
      setAnalysis(r.analysis);
    } catch (e: any) { setError(e?.message || 'Falha ao comparar'); }
    finally { setAnalyzing(false); }
  };

  return (
    <View style={s.root} testID="photos-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.back} testID="photos-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title}>Fotos</Text>
          <Pressable onPress={upload} style={s.addBtn} testID="photos-add" disabled={uploading}>
            {uploading ? <ActivityIndicator size="small" color={colors.brandDark} /> :
              <Ionicons name="add" size={20} color={colors.brandDark} />}
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={s.tabsRow}>
          {(['album', 'timeline', 'compare'] as Tab[]).map(t => (
            <Pressable key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabActive]} testID={`photos-tab-${t}`}>
              <Text style={[s.tabTxt, tab === t && { color: colors.onSurface, fontWeight: '700' }]}>
                {t === 'album' ? 'Álbum' : t === 'timeline' ? 'Linha do tempo' : 'Comparador IA'}
              </Text>
            </Pressable>
          ))}
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
        ) : tab === 'album' ? (
          <View style={s.grid}>
            {items.map(p => (
              <View key={p.id} style={s.item}>
                <Image source={{ uri: `data:image/jpeg;base64,${p.image_base64}` }} style={s.img} contentFit="cover" />
                <View style={s.itemFooter}>
                  <Text style={s.itemDate}>{fmtDate(p.date)}</Text>
                  <Pressable onPress={() => del(p.id)} hitSlop={12} testID={`photos-del-${p.id}`}>
                    <Ionicons name="trash-outline" size={16} color={colors.muted} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : tab === 'timeline' ? (
          <View style={{ gap: spacing.lg }}>
            {timeline.map(([month, group]) => (
              <View key={month} style={{ gap: spacing.sm }}>
                <Text style={s.monthLabel}>{month.charAt(0).toUpperCase() + month.slice(1)}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                  {group.map(p => (
                    <View key={p.id} style={s.tlItem}>
                      <Image source={{ uri: `data:image/jpeg;base64,${p.image_base64}` }} style={s.tlImg} contentFit="cover" />
                      <Text style={s.tlDate}>{fmtDate(p.date)}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ))}
          </View>
        ) : (
          /* Compare */
          <View style={{ gap: spacing.md }}>
            <View style={s.compareRow}>
              <ComparePicker colors={colors} label="Antes" selected={beforePhoto} items={items} onSelect={setBeforeId} testID="compare-before" />
              <View style={s.arrowBox}><Ionicons name="arrow-forward" size={22} color={colors.brandDark} /></View>
              <ComparePicker colors={colors} label="Depois" selected={afterPhoto} items={items} onSelect={setAfterId} testID="compare-after" />
            </View>

            <View style={s.compareActions}>
              <Pressable style={s.suggestBtn} onPress={suggestPair} testID="compare-suggest">
                <Ionicons name="sparkles" size={16} color={colors.onSurface} />
                <Text style={s.suggestTxt}>Sugerir par</Text>
              </Pressable>
              <Pressable
                style={[s.iaBtn, (!beforeId || !afterId || analyzing) && { opacity: 0.5 }]}
                onPress={compareIA}
                disabled={!beforeId || !afterId || analyzing}
                testID="compare-analyze"
              >
                {analyzing ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
                  <>
                    <Ionicons name="analytics" size={18} color={colors.onBrandPrimary} />
                    <Text style={s.iaBtnTxt}>Analisar com IA</Text>
                  </>
                )}
              </Pressable>
            </View>

            {error && <Text style={s.err} testID="compare-error">{error}</Text>}

            {beforePhoto && afterPhoto && (
              <View style={s.sideBySide}>
                <View style={{ flex: 1 }}>
                  <Image source={{ uri: `data:image/jpeg;base64,${beforePhoto.image_base64}` }} style={s.compareImg} contentFit="cover" />
                  <Text style={s.compareCaption}>Antes • {fmtDate(beforePhoto.date)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Image source={{ uri: `data:image/jpeg;base64,${afterPhoto.image_base64}` }} style={s.compareImg} contentFit="cover" />
                  <Text style={s.compareCaption}>Depois • {fmtDate(afterPhoto.date)}</Text>
                </View>
              </View>
            )}

            {analysis && (
              <View style={s.analysisCard} testID="compare-result">
                <View style={s.scoreRow}>
                  <View style={s.scoreBadge}>
                    <Text style={s.scoreNum}>{analysis.progress_score ?? 0}</Text>
                    <Text style={s.scoreLbl}>/ 100</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.scoreTitle}>Progresso detectado</Text>
                    {analysis.summary && <Text style={s.scoreSub}>{analysis.summary}</Text>}
                  </View>
                </View>

                {!!analysis.changes?.length && (
                  <View style={{ gap: 6 }}>
                    <Text style={s.chLabel}>Mudanças observadas</Text>
                    {analysis.changes.map((c, i) => (
                      <View key={i} style={s.chRow}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.brandPrimary} />
                        <Text style={s.chTxt}>{c}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {analysis.encouragement && (
                  <View style={s.encBox}>
                    <Ionicons name="sparkles" size={16} color={colors.brandDark} />
                    <Text style={s.encTxt}>{analysis.encouragement}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

function ComparePicker({ colors, label, selected, items, onSelect, testID }: any) {
  const s = makeStyles(colors);
  return (
    <View style={s.picker}>
      <Text style={s.pickerLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {items.map((p: Photo) => (
          <Pressable
            key={p.id}
            onPress={() => onSelect(p.id)}
            style={[s.pickerThumb, selected?.id === p.id && { borderColor: colors.brandPrimary, borderWidth: 3 }]}
            testID={`${testID}-${p.id}`}
          >
            <Image source={{ uri: `data:image/jpeg;base64,${p.image_base64}` }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.headline, color: colors.onSurface },
  addBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },

  tabsRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.md },
  tab: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  tabTxt: { ...typography.caption, color: colors.onSurfaceSecondary },

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

  monthLabel: { ...typography.headline, color: colors.onSurface, textTransform: 'capitalize' },
  tlItem: { width: 110, gap: 4 },
  tlImg: { width: 110, height: 110, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  tlDate: { ...typography.small, color: colors.muted },

  compareRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  arrowBox: { width: 32, alignItems: 'center', justifyContent: 'center' },
  picker: { flex: 1, gap: 6 },
  pickerLabel: { ...typography.caption, color: colors.muted, marginLeft: 4 },
  pickerThumb: { width: 72, height: 72, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceTertiary },

  compareActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  suggestBtn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  suggestTxt: { ...typography.caption, color: colors.onSurface, fontWeight: '600' },
  iaBtn: { flex: 1, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  iaBtnTxt: { color: colors.onBrandPrimary, fontWeight: '700', ...typography.body },

  err: { ...typography.caption, color: colors.error, textAlign: 'center' },

  sideBySide: { flexDirection: 'row', gap: spacing.sm },
  compareImg: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  compareCaption: { ...typography.small, color: colors.muted, textAlign: 'center', marginTop: 4 },

  analysisCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  scoreRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  scoreBadge: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center', minWidth: 76 },
  scoreNum: { fontSize: 28, fontWeight: '700', color: colors.brandDark, letterSpacing: -0.5 },
  scoreLbl: { ...typography.small, color: colors.brandDark },
  scoreTitle: { ...typography.bodyStrong, color: colors.onSurface },
  scoreSub: { ...typography.caption, color: colors.onSurfaceSecondary, marginTop: 2, lineHeight: 18 },
  chLabel: { ...typography.caption, color: colors.muted, marginTop: spacing.sm, marginLeft: 2 },
  chRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  chTxt: { flex: 1, ...typography.caption, color: colors.onSurface, lineHeight: 18 },
  encBox: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.md },
  encTxt: { flex: 1, ...typography.caption, color: colors.brandDark, fontWeight: '600', lineHeight: 18 },
});
