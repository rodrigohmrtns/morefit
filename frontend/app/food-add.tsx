import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Food = {
  id: string; name: string; unit?: string; barcode?: string;
  calories: number; protein_g: number; carbs_g: number; fat_g: number;
  source_id?: string; image?: string | null;
};
type Tab = 'search' | 'favorites' | 'barcode' | 'manual';
const MEAL_LABEL: Record<string, string> = {
  breakfast: 'Café da manhã', lunch: 'Almoço', dinner: 'Jantar', snack: 'Lanche',
};

export default function FoodAdd() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal_type?: string }>();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [tab, setTab] = useState<Tab>('search');
  const [mealType, setMealType] = useState<string>(params.meal_type || 'snack');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [favs, setFavs] = useState<Food[]>([]);
  const [barcode, setBarcode] = useState('');
  const [barcodeResult, setBarcodeResult] = useState<Food | null>(null);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Food | null>(null);
  const [portion, setPortion] = useState('1');
  const [saving, setSaving] = useState(false);
  // manual
  const [mName, setMName] = useState('');
  const [mCal, setMCal] = useState('');
  const [mProt, setMProt] = useState('');
  const [mCarb, setMCarb] = useState('');
  const [mFat, setMFat] = useState('');

  const search = useCallback(async (q: string) => {
    try { const r = await api<{ items: Food[] }>(`/foods/search?q=${encodeURIComponent(q)}`); setResults(r.items || []); } catch {}
  }, []);
  const loadFavs = useCallback(async () => {
    try { const r = await api<{ items: Food[] }>('/foods/favorites'); setFavs(r.items || []); } catch {}
  }, []);
  useEffect(() => { search(''); loadFavs(); }, [search, loadFavs]);
  useEffect(() => { const t = setTimeout(() => search(query), 250); return () => clearTimeout(t); }, [query, search]);

  const lookupBarcode = async () => {
    if (!barcode.trim()) return;
    setBarcodeError(null); setBarcodeResult(null); setBarcodeLoading(true);
    try { const r = await api<Food>(`/foods/barcode/${barcode.trim()}`); setBarcodeResult(r); }
    catch (e: any) { setBarcodeError(e?.message || 'Produto não encontrado'); }
    finally { setBarcodeLoading(false); }
  };

  const addFav = async (f: Food) => {
    try {
      await api('/foods/favorites', { method: 'POST', body: {
        name: f.name, unit: f.unit, calories: f.calories, protein_g: f.protein_g,
        carbs_g: f.carbs_g, fat_g: f.fat_g, source_id: f.id,
      } });
      loadFavs();
    } catch {}
  };

  const delFav = async (id: string) => { try { await api(`/foods/favorites/${id}`, { method: 'DELETE' }); loadFavs(); } catch {} };

  const save = async (food: Food, mult: number) => {
    setSaving(true);
    try {
      await api('/meals', {
        method: 'POST',
        body: {
          name: food.name, meal_type: mealType,
          portion: `${mult}× ${food.unit || ''}`.trim(),
          calories: food.calories * mult,
          protein_g: food.protein_g * mult,
          carbs_g: food.carbs_g * mult,
          fat_g: food.fat_g * mult,
        },
      });
      router.replace('/(tabs)/food');
    } catch {} finally { setSaving(false); setSelected(null); }
  };

  const saveManual = async () => {
    const cal = parseFloat(mCal.replace(',', '.'));
    if (!mName || !cal) return;
    setSaving(true);
    try {
      await api('/meals', {
        method: 'POST',
        body: {
          name: mName, meal_type: mealType, calories: cal,
          protein_g: parseFloat((mProt || '0').replace(',', '.')),
          carbs_g: parseFloat((mCarb || '0').replace(',', '.')),
          fat_g: parseFloat((mFat || '0').replace(',', '.')),
        },
      });
      router.replace('/(tabs)/food');
    } catch {} finally { setSaving(false); }
  };

  const renderFoodItem = (f: Food, showFavBtn = true, isFav = false, favId?: string) => (
    <View style={s.item} key={f.id}>
      <View style={{ flex: 1 }}>
        <Text style={s.itemName}>{f.name}</Text>
        <Text style={s.itemMeta}>
          {f.unit ? `${f.unit} • ` : ''}{Math.round(f.calories)} kcal • P {Math.round(f.protein_g)}g • C {Math.round(f.carbs_g)}g • G {Math.round(f.fat_g)}g
        </Text>
      </View>
      {showFavBtn && !isFav && (
        <Pressable onPress={() => addFav(f)} hitSlop={10} testID={`food-fav-${f.id}`}>
          <Ionicons name="heart-outline" size={20} color={colors.muted} />
        </Pressable>
      )}
      {isFav && favId && (
        <Pressable onPress={() => delFav(favId)} hitSlop={10} testID={`food-unfav-${favId}`}>
          <Ionicons name="heart" size={20} color={colors.brandSecondary} />
        </Pressable>
      )}
      <Pressable onPress={() => setSelected(f)} style={s.pickBtn} testID={`food-pick-${f.id}`}>
        <Ionicons name="add" size={16} color={colors.brandDark} />
      </Pressable>
    </View>
  );

  return (
    <View style={s.root} testID="food-add-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.back} testID="food-add-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title}>Adicionar alimento</Text>
          <View style={{ width: 34 }} />
        </View>

        {/* Meal type */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.mealRow}>
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(k => (
            <Pressable key={k} onPress={() => setMealType(k)} style={[s.mealChip, mealType === k && s.mealChipActive]} testID={`food-add-meal-${k}`}>
              <Text style={[s.mealChipTxt, mealType === k && { color: colors.onBrandPrimary, fontWeight: '700' }]}>{MEAL_LABEL[k]}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Tabs */}
        <View style={s.tabsRow}>
          {(['search', 'favorites', 'barcode', 'manual'] as Tab[]).map(t => (
            <Pressable key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabActive]} testID={`food-add-tab-${t}`}>
              <Ionicons
                name={t === 'search' ? 'search' : t === 'favorites' ? 'heart' : t === 'barcode' ? 'barcode' : 'create'}
                size={14}
                color={tab === t ? colors.onSurface : colors.muted}
              />
              <Text style={[s.tabTxt, tab === t && { color: colors.onSurface, fontWeight: '700' }]}>
                {t === 'search' ? 'Buscar' : t === 'favorites' ? 'Favoritos' : t === 'barcode' ? 'Barra' : 'Manual'}
              </Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {tab === 'search' && (
            <>
              <View style={s.searchBox}>
                <Ionicons name="search" size={18} color={colors.muted} />
                <TextInput
                  style={s.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Ex.: arroz, banana, whey…"
                  placeholderTextColor={colors.muted}
                  testID="food-search-input"
                />
              </View>
              <View style={{ gap: spacing.sm }}>
                {results.length === 0 ? (
                  <Text style={s.emptyTxt}>Nada encontrado.</Text>
                ) : results.map(f => renderFoodItem(f))}
              </View>
            </>
          )}

          {tab === 'favorites' && (
            <View style={{ gap: spacing.sm }}>
              {favs.length === 0 ? (
                <View style={s.empty}>
                  <Ionicons name="heart-outline" size={40} color={colors.muted} />
                  <Text style={s.emptyTitle}>Sem favoritos ainda</Text>
                  <Text style={s.emptyTxt}>Toque no coração para favoritar alimentos frequentes.</Text>
                </View>
              ) : favs.map(f => renderFoodItem(f, true, true, f.id))}
            </View>
          )}

          {tab === 'barcode' && (
            <View style={{ gap: spacing.md }}>
              <View style={s.searchBox}>
                <Ionicons name="barcode" size={18} color={colors.muted} />
                <TextInput
                  style={s.searchInput}
                  value={barcode}
                  onChangeText={setBarcode}
                  placeholder="Digite o código de barras (EAN)"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  testID="food-barcode-input"
                />
                <Pressable style={s.searchBtn} onPress={lookupBarcode} disabled={barcodeLoading} testID="food-barcode-lookup">
                  {barcodeLoading ? <ActivityIndicator color={colors.onBrandPrimary} size="small" /> : (
                    <Text style={s.searchBtnTxt}>Buscar</Text>
                  )}
                </Pressable>
              </View>
              <Text style={s.hint}>Consulta o banco público OpenFoodFacts (grátis). Um scanner de câmera chega em breve.</Text>
              {barcodeError && <Text style={s.err}>{barcodeError}</Text>}
              {barcodeResult && renderFoodItem(barcodeResult)}
            </View>
          )}

          {tab === 'manual' && (
            <View style={{ gap: spacing.sm }}>
              <Label colors={colors} text="Nome" />
              <TextInput style={s.input} value={mName} onChangeText={setMName} placeholder="Ex.: Marmita fitness"
                placeholderTextColor={colors.muted} testID="food-manual-name" />
              <View style={s.gridRow}>
                <View style={{ flex: 1 }}>
                  <Label colors={colors} text="Calorias" />
                  <TextInput style={s.input} value={mCal} onChangeText={setMCal} keyboardType="decimal-pad"
                    placeholder="kcal" placeholderTextColor={colors.muted} testID="food-manual-cal" />
                </View>
                <View style={{ flex: 1 }}>
                  <Label colors={colors} text="Proteína (g)" />
                  <TextInput style={s.input} value={mProt} onChangeText={setMProt} keyboardType="decimal-pad"
                    placeholder="0,0" placeholderTextColor={colors.muted} testID="food-manual-prot" />
                </View>
              </View>
              <View style={s.gridRow}>
                <View style={{ flex: 1 }}>
                  <Label colors={colors} text="Carbo (g)" />
                  <TextInput style={s.input} value={mCarb} onChangeText={setMCarb} keyboardType="decimal-pad"
                    placeholder="0,0" placeholderTextColor={colors.muted} testID="food-manual-carb" />
                </View>
                <View style={{ flex: 1 }}>
                  <Label colors={colors} text="Gordura (g)" />
                  <TextInput style={s.input} value={mFat} onChangeText={setMFat} keyboardType="decimal-pad"
                    placeholder="0,0" placeholderTextColor={colors.muted} testID="food-manual-fat" />
                </View>
              </View>
              <Pressable style={[s.saveBtn, (!mName || !mCal || saving) && { opacity: 0.5 }]}
                onPress={saveManual} disabled={!mName || !mCal || saving} testID="food-manual-save">
                {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.saveTxt}>Adicionar ao diário</Text>}
              </Pressable>
            </View>
          )}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Portion modal */}
      {selected && (
        <View style={s.modalBg}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>{selected.name}</Text>
            <Text style={s.modalUnit}>1× = {selected.unit || 'porção'} ({Math.round(selected.calories)} kcal)</Text>
            <View style={s.qtyRow}>
              <Text style={s.qtyLabel}>Porções</Text>
              <TextInput style={s.qtyInput} value={portion} onChangeText={setPortion} keyboardType="decimal-pad" testID="food-portion-input" />
            </View>
            <View style={s.macroPreview}>
              <Text style={s.macroPrevTxt}>
                Total: {Math.round(selected.calories * (parseFloat(portion.replace(',', '.')) || 1))} kcal
              </Text>
            </View>
            <View style={s.modalActions}>
              <Pressable style={s.modalCancel} onPress={() => setSelected(null)} testID="food-portion-cancel">
                <Text style={s.modalCancelTxt}>Cancelar</Text>
              </Pressable>
              <Pressable style={s.modalConfirm}
                onPress={() => save(selected, parseFloat(portion.replace(',', '.')) || 1)}
                disabled={saving}
                testID="food-portion-save"
              >
                {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.modalConfirmTxt}>Adicionar</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function Label({ colors, text }: { colors: ThemeColors; text: string }) {
  return <Text style={{ ...typography.caption, color: colors.muted, marginLeft: 4 }}>{text}</Text>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.headline, color: colors.onSurface },
  mealRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, height: 40, alignItems: 'center' },
  mealChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, flexShrink: 0 },
  mealChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  mealChipTxt: { ...typography.small, color: colors.onSurfaceSecondary },
  tabsRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.xs, paddingBottom: spacing.md, marginTop: spacing.sm },
  tab: { flex: 1, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  tabTxt: { ...typography.small, color: colors.muted },

  content: { padding: spacing.xl, gap: spacing.md },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 48, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, ...typography.body, color: colors.onSurface },
  searchBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill },
  searchBtnTxt: { color: colors.onBrandPrimary, fontWeight: '700', ...typography.caption },

  item: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  itemName: { ...typography.bodyStrong, color: colors.onSurface },
  itemMeta: { ...typography.small, color: colors.muted, marginTop: 2 },
  pickBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },

  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.xxl },
  emptyTitle: { ...typography.title, color: colors.onSurface },
  emptyTxt: { ...typography.caption, color: colors.muted, textAlign: 'center' },
  hint: { ...typography.small, color: colors.muted, textAlign: 'center' },
  err: { ...typography.caption, color: colors.error, textAlign: 'center' },

  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, color: colors.onSurface, ...typography.body },
  gridRow: { flexDirection: 'row', gap: spacing.md },
  saveBtn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingVertical: 14, marginTop: spacing.md },
  saveTxt: { color: colors.onBrandPrimary, fontWeight: '700', ...typography.body },

  modalBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surface, padding: spacing.xl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, gap: spacing.md },
  modalTitle: { ...typography.title, color: colors.onSurface },
  modalUnit: { ...typography.caption, color: colors.muted },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  qtyLabel: { flex: 1, ...typography.body, color: colors.onSurface },
  qtyInput: { ...typography.headline, color: colors.onSurface, textAlign: 'right', minWidth: 80 },
  macroPreview: { backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  macroPrevTxt: { color: colors.brandDark, fontWeight: '700', ...typography.body },
  modalActions: { flexDirection: 'row', gap: spacing.md },
  modalCancel: { flex: 1, padding: 14, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  modalCancelTxt: { color: colors.onSurface, fontWeight: '600' },
  modalConfirm: { flex: 1, padding: 14, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: 'center' },
  modalConfirmTxt: { color: colors.onBrandPrimary, fontWeight: '700' },
});
