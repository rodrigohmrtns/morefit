import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { radius, shadow, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Company = {
  id: string; name: string; industry?: string | null;
  plan: 'free' | 'starter' | 'business' | 'enterprise';
  code: string; owner_id: string; role: 'admin' | 'member'; member_count: number;
  logo_base64?: string | null;
};

const PLAN_LABEL: Record<Company['plan'], string> = {
  free: 'Grátis', starter: 'Starter', business: 'Business', enterprise: 'Enterprise',
};

export default function CompaniesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [items, setItems] = useState<Company[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [modalOpen, setModalOpen] = useState(false);

  // Create form
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [plan, setPlan] = useState<Company['plan']>('business');
  // Join form
  const [code, setCode] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: Company[] }>('/companies/mine');
      setItems(res.items);
    } catch (e) { console.log(e); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openCreate = () => { setMode('create'); setModalOpen(true); };
  const openJoin = () => { setMode('join'); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setName(''); setIndustry(''); setCode(''); setPlan('business'); };

  const submit = async () => {
    setSubmitting(true);
    try {
      if (mode === 'create') {
        if (!name.trim()) { Alert.alert('Erro', 'Informe o nome'); setSubmitting(false); return; }
        await api('/companies', { method: 'POST', body: { name: name.trim(), industry: industry.trim() || null, plan } });
      } else {
        if (!code.trim()) { Alert.alert('Erro', 'Informe o código'); setSubmitting(false); return; }
        await api('/companies/join', { method: 'POST', body: { code: code.trim().toUpperCase() } });
      }
      closeModal();
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha');
    } finally { setSubmitting(false); }
  };

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={s.iconBtn} testID="co-back">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title}>Empresas</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        <View style={s.hero}>
          <Ionicons name="business" size={22} color={colors.brandPrimary} />
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle}>Plano Corporativo</Text>
            <Text style={s.heroSub}>Engaje sua equipe em desafios de saúde. Métricas anônimas para gestão.</Text>
          </View>
        </View>

        <View style={s.actionRow}>
          <Pressable style={s.actionPrimary} onPress={openCreate} testID="co-create-btn">
            <Ionicons name="add-circle" size={20} color={colors.brandDark} />
            <Text style={s.actionPrimaryTxt}>Criar empresa</Text>
          </Pressable>
          <Pressable style={s.actionSecondary} onPress={openJoin} testID="co-join-btn">
            <Ionicons name="enter" size={20} color={colors.onSurface} />
            <Text style={s.actionSecondaryTxt}>Entrar com código</Text>
          </Pressable>
        </View>

        <Text style={s.sectionLbl}>Minhas empresas</Text>
        {items.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="business-outline" size={48} color={colors.muted} />
            <Text style={s.emptyTitle}>Nenhuma empresa ainda</Text>
            <Text style={s.emptySub}>Crie uma para sua equipe ou peça o código do administrador.</Text>
          </View>
        )}

        {items.map(c => (
          <Pressable key={c.id} style={s.card} onPress={() => router.push(`/company/${c.id}`)} testID={`co-item-${c.id}`}>
            <View style={s.logo}>
              <Ionicons name="business" size={22} color={colors.brandDark} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Text style={s.cardTitle}>{c.name}</Text>
                {c.role === 'admin' && (
                  <View style={s.adminBadge}><Text style={s.adminTxt}>Admin</Text></View>
                )}
              </View>
              <Text style={s.cardSub}>
                {c.industry ? `${c.industry} • ` : ''}{PLAN_LABEL[c.plan]} • {c.member_count} {c.member_count === 1 ? 'membro' : 'membros'}
              </Text>
              <Text style={s.cardCode}>Código: {c.code}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        ))}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>{mode === 'create' ? 'Criar empresa' : 'Entrar com código'}</Text>
              <Pressable onPress={closeModal}><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>

            {mode === 'create' ? (
              <>
                <Text style={s.lbl}>Nome</Text>
                <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Ex.: Acme Tech" placeholderTextColor={colors.muted} testID="co-form-name" />
                <Text style={s.lbl}>Setor (opcional)</Text>
                <TextInput style={s.input} value={industry} onChangeText={setIndustry} placeholder="Ex.: Tecnologia, Saúde" placeholderTextColor={colors.muted} testID="co-form-industry" />
                <Text style={s.lbl}>Plano</Text>
                <View style={s.planRow}>
                  {(['free', 'starter', 'business', 'enterprise'] as const).map(p => (
                    <Pressable
                      key={p}
                      style={[s.planChip, plan === p && s.planChipActive]}
                      onPress={() => setPlan(p)}
                      testID={`co-form-plan-${p}`}
                    >
                      <Text style={[s.planChipTxt, plan === p && { color: colors.brandDark, fontWeight: '800' }]}>{PLAN_LABEL[p]}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={s.lbl}>Código de convite</Text>
                <TextInput
                  style={[s.input, s.codeInput]}
                  value={code}
                  onChangeText={t => setCode(t.toUpperCase())}
                  placeholder="V-XXXXX"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="characters"
                  testID="co-form-code"
                />
                <Text style={s.hint}>Peça o código para o administrador da empresa.</Text>
              </>
            )}

            <Pressable
              style={[s.submit, submitting && { opacity: 0.5 }]}
              onPress={submit}
              disabled={submitting}
              testID="co-form-submit"
            >
              {submitting ? <ActivityIndicator color={colors.brandDark} /> : (
                <>
                  <Ionicons name={mode === 'create' ? 'checkmark' : 'enter'} size={18} color={colors.brandDark} />
                  <Text style={s.submitTxt}>{mode === 'create' ? 'Criar' : 'Entrar'}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.title, color: colors.onSurface },
  content: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingTop: spacing.xs },

  hero: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.surfaceInverse, padding: spacing.lg, borderRadius: radius.lg },
  heroTitle: { ...typography.headline, color: colors.onSurfaceInverse },
  heroSub: { ...typography.small, color: colors.onSurfaceInverse, opacity: 0.75, marginTop: 2, lineHeight: 17 },

  actionRow: { flexDirection: 'row', gap: spacing.sm },
  actionPrimary: { flex: 1, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.md },
  actionPrimaryTxt: { ...typography.bodyStrong, color: colors.brandDark },
  actionSecondary: { flex: 1, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  actionSecondaryTxt: { ...typography.bodyStrong, color: colors.onSurface },

  sectionLbl: { ...typography.caption, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadow.card },
  logo: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...typography.bodyStrong, color: colors.onSurface },
  cardSub: { ...typography.small, color: colors.muted, marginTop: 2 },
  cardCode: { ...typography.small, color: colors.brandDark, fontWeight: '700', marginTop: 4, backgroundColor: colors.brandTertiary, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  adminBadge: { backgroundColor: colors.brandPrimary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  adminTxt: { ...typography.small, color: colors.brandDark, fontWeight: '800', fontSize: 10 },

  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { ...typography.headline, color: colors.onSurface },
  emptySub: { ...typography.caption, color: colors.muted, textAlign: 'center', paddingHorizontal: spacing.xl },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sheetTitle: { ...typography.title, color: colors.onSurface },
  lbl: { ...typography.caption, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, color: colors.onSurface, ...typography.body },
  codeInput: { fontSize: 24, fontWeight: '700', letterSpacing: 2, textAlign: 'center' },
  hint: { ...typography.small, color: colors.muted },
  planRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  planChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  planChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  planChipTxt: { ...typography.small, color: colors.onSurface, fontWeight: '600' },
  submit: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  submitTxt: { ...typography.bodyStrong, color: colors.brandDark },
});
