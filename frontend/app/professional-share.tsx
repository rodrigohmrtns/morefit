import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, getToken } from '@/src/api/client';
import { radius, shadow, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type ProType = 'nutritionist' | 'personal' | 'doctor';

type Share = {
  id: string; token: string; user_id: string;
  professional_type: ProType; professional_name?: string; professional_email?: string;
  created_at: string; expires_at: string;
};

const PROS: { key: ProType; label: string; icon: any; desc: string; tint: 'tintMint' | 'tintPeach' | 'tintCoral' }[] = [
  { key: 'nutritionist', label: 'Nutricionista', icon: 'nutrition', desc: 'Peso + refeições + macros', tint: 'tintMint' },
  { key: 'personal', label: 'Personal Trainer', icon: 'barbell', desc: 'Peso + medidas + exercícios', tint: 'tintPeach' },
  { key: 'doctor', label: 'Médico', icon: 'medkit', desc: 'Relatório completo (peso, refeições, exercícios, sono)', tint: 'tintCoral' },
];

const PRO_META: Record<string, { label: string; icon: any }> = {
  nutritionist: { label: 'Nutricionista', icon: 'nutrition' },
  personal: { label: 'Personal Trainer', icon: 'barbell' },
  doctor: { label: 'Médico', icon: 'medkit' },
  all: { label: 'Completo', icon: 'document-text' },
};

export default function ProfessionalShareScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [shares, setShares] = useState<Share[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [proType, setProType] = useState<ProType>('nutritionist');
  const [proName, setProName] = useState('');
  const [proEmail, setProEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: Share[] }>('/professionals/shares');
      setShares(res.items);
    } catch (e) { console.log(e); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';

  const createShare = async () => {
    setCreating(true);
    try {
      await api('/professionals/share', {
        method: 'POST',
        body: {
          professional_type: proType,
          professional_name: proName.trim() || undefined,
          professional_email: proEmail.trim() || undefined,
        },
      });
      setProName(''); setProEmail(''); setModalOpen(false);
      await load();
      Alert.alert('Link criado!', 'Compartilhe o link com o profissional. Ele expira em 30 dias.');
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao criar link');
    } finally { setCreating(false); }
  };

  const copyLink = async (token: string) => {
    const url = `${backendUrl}/api/reports/public/${token}`;
    await Clipboard.setStringAsync(url);
    Alert.alert('Link copiado', url);
  };

  const openLink = (token: string) => {
    const url = `${backendUrl}/api/reports/public/${token}`;
    Linking.openURL(url).catch(() => Alert.alert('Não foi possível abrir', url));
  };

  const revoke = (sh: Share) => {
    Alert.alert('Revogar link?', 'O profissional não conseguirá mais acessar.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Revogar', style: 'destructive', onPress: async () => {
        try { await api(`/professionals/shares/${sh.id}`, { method: 'DELETE' }); await load(); }
        catch (e: any) { Alert.alert('Erro', e?.message || 'Falha'); }
      } },
    ]);
  };

  const downloadPdf = async (type: ProType | 'all') => {
    setDownloading(type);
    try {
      const token = await getToken();
      const url = `${backendUrl}/api/report/pdf?type=${type}`;
      // On web we can open directly; on native, share via URL (best-effort).
      // Use Linking with token appended as query param won't help for auth.
      // Simplest cross-platform: use fetch → blob → download on web, share sheet on native.
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token ?? ''}` } });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      if (typeof window !== 'undefined' && (window as any).URL?.createObjectURL) {
        const blob = await res.blob();
        const dlUrl = (window as any).URL.createObjectURL(blob);
        const a = (window as any).document.createElement('a');
        a.href = dlUrl;
        a.download = `morefit-${type}.pdf`;
        a.click();
        setTimeout(() => (window as any).URL.revokeObjectURL(dlUrl), 500);
      } else {
        // Native fallback — write to cache and share
        const FileSystem = await import('expo-file-system');
        const Sharing = await import('expo-sharing');
        const b64 = arrayBufferToBase64(await res.arrayBuffer());
        const path = FileSystem.cacheDirectory + `morefit-${type}.pdf`;
        await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
        else Alert.alert('PDF salvo', path);
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível gerar o PDF');
    } finally { setDownloading(null); }
  };

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={s.iconBtn} testID="share-back">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title}>Compartilhar</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.content} refreshControl={undefined /* pull-refresh via list button */}>
        <View style={s.hero}>
          <Ionicons name="document-text" size={22} color={colors.brandPrimary} />
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle}>Relatórios profissionais</Text>
            <Text style={s.heroSub}>
              Gere um PDF ou link seguro para nutricionista, personal ou médico. Cada perfil recebe apenas as seções relevantes.
            </Text>
          </View>
        </View>

        {/* PDF Downloads */}
        <Text style={s.sectionLabel}>Baixar PDF</Text>
        <View style={s.pdfGrid}>
          {(['all', 'nutritionist', 'personal', 'doctor'] as const).map(t => {
            const meta = PRO_META[t];
            const tint = t === 'all' ? colors.surfaceSecondary : (colors as any)[PROS.find(p => p.key === t)?.tint ?? 'surfaceSecondary'];
            const isLoading = downloading === t;
            return (
              <Pressable
                key={t}
                style={[s.pdfCard, { backgroundColor: tint }]}
                onPress={() => downloadPdf(t)}
                disabled={!!downloading}
                testID={`share-pdf-${t}`}
              >
                <View style={s.pdfIcon}><Ionicons name={meta.icon} size={20} color={colors.brandDark} /></View>
                <Text style={s.pdfLabel}>{meta.label}</Text>
                {isLoading ? <ActivityIndicator size="small" color={colors.brandDark} /> :
                  <View style={s.pdfActionRow}>
                    <Ionicons name="download" size={14} color={colors.onTint} />
                    <Text style={s.pdfActionTxt}>PDF</Text>
                  </View>}
              </Pressable>
            );
          })}
        </View>

        {/* Shared links */}
        <View style={s.sectionRow}>
          <Text style={s.sectionLabel}>Links ativos</Text>
          <Pressable onPress={onRefresh} style={s.iconMini}>
            <Ionicons name={refreshing ? 'refresh' : 'refresh-outline'} size={16} color={colors.muted} />
          </Pressable>
        </View>
        <View style={s.card}>
          {shares.length === 0 && (
            <View style={{ padding: spacing.lg, alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="link" size={32} color={colors.muted} />
              <Text style={{ color: colors.muted, ...typography.body, textAlign: 'center' }}>
                Nenhum link ativo. Crie um para compartilhar seu progresso.
              </Text>
            </View>
          )}
          {shares.map((sh, i) => {
            const meta = PRO_META[sh.professional_type];
            return (
              <View key={sh.id} style={[s.shareRow, i < shares.length - 1 && s.rowDivider]}>
                <View style={s.shareIcon}><Ionicons name={meta.icon} size={18} color={colors.brandDark} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.shareTitle}>{sh.professional_name || meta.label}</Text>
                  <Text style={s.shareSub}>
                    {meta.label} • Expira {new Date(sh.expires_at).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
                <View style={s.shareActions}>
                  <Pressable onPress={() => copyLink(sh.token)} style={s.miniBtn} testID={`share-copy-${sh.id}`}>
                    <Ionicons name="copy-outline" size={16} color={colors.onSurface} />
                  </Pressable>
                  <Pressable onPress={() => openLink(sh.token)} style={s.miniBtn} testID={`share-open-${sh.id}`}>
                    <Ionicons name="open-outline" size={16} color={colors.onSurface} />
                  </Pressable>
                  <Pressable onPress={() => revoke(sh)} style={s.miniBtn} testID={`share-revoke-${sh.id}`}>
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        <Pressable style={s.newBtn} onPress={() => setModalOpen(true)} testID="share-new-link">
          <Ionicons name="add-circle" size={20} color={colors.brandDark} />
          <Text style={s.newBtnTxt}>Criar novo link</Text>
        </Pressable>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>Novo link</Text>
              <Pressable onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.onSurface} />
              </Pressable>
            </View>
            <Text style={s.formLbl}>Profissional</Text>
            <View style={{ gap: spacing.sm }}>
              {PROS.map(p => (
                <Pressable
                  key={p.key}
                  onPress={() => setProType(p.key)}
                  style={[s.proOpt, proType === p.key && s.proOptActive]}
                  testID={`share-form-type-${p.key}`}
                >
                  <View style={[s.proOptIcon, { backgroundColor: proType === p.key ? colors.brandPrimary : colors.surfaceTertiary }]}>
                    <Ionicons name={p.icon} size={18} color={proType === p.key ? colors.brandDark : colors.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.proOptTitle}>{p.label}</Text>
                    <Text style={s.proOptDesc}>{p.desc}</Text>
                  </View>
                  {proType === p.key && <Ionicons name="checkmark-circle" size={22} color={colors.brandPrimary} />}
                </Pressable>
              ))}
            </View>
            <Text style={s.formLbl}>Nome (opcional)</Text>
            <TextInput
              style={s.input}
              placeholder="Ex.: Dra. Marina Silva"
              placeholderTextColor={colors.muted}
              value={proName}
              onChangeText={setProName}
              testID="share-form-name"
            />
            <Text style={s.formLbl}>E-mail (opcional)</Text>
            <TextInput
              style={s.input}
              placeholder="marina@clinica.com"
              placeholderTextColor={colors.muted}
              value={proEmail}
              onChangeText={setProEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              testID="share-form-email"
            />
            <Pressable
              style={[s.submit, creating && { opacity: 0.5 }]}
              disabled={creating}
              onPress={createShare}
              testID="share-form-submit"
            >
              {creating ? <ActivityIndicator color={colors.brandDark} /> :
                <><Ionicons name="link" size={16} color={colors.brandDark} /><Text style={s.submitTxt}>Gerar link</Text></>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  // btoa is available in web + hermes has it via polyfill in recent RN; fallback below
  if (typeof btoa !== 'undefined') return btoa(bin);
  // simple polyfill
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '', i = 0;
  while (i < bin.length) {
    const c1 = bin.charCodeAt(i++);
    const c2 = bin.charCodeAt(i++);
    const c3 = bin.charCodeAt(i++);
    out += chars[c1 >> 2];
    out += chars[((c1 & 3) << 4) | (c2 >> 4)];
    out += isNaN(c2) ? '=' : chars[((c2 & 15) << 2) | (c3 >> 6)];
    out += isNaN(c3) ? '=' : chars[c3 & 63];
  }
  return out;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  iconMini: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.title, color: colors.onSurface },
  content: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingTop: spacing.xs },

  hero: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.surfaceInverse, padding: spacing.lg, borderRadius: radius.lg },
  heroTitle: { ...typography.headline, color: colors.onSurfaceInverse },
  heroSub: { ...typography.small, color: colors.onSurfaceInverse, opacity: 0.75, marginTop: 2, lineHeight: 17 },

  sectionLabel: { ...typography.caption, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.sm, marginLeft: spacing.xs },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },

  pdfGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pdfCard: { width: '48.5%', borderRadius: radius.md, padding: spacing.md, gap: 6, borderWidth: 1, borderColor: colors.border, minHeight: 110 },
  pdfIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  pdfLabel: { ...typography.bodyStrong, color: colors.onTint },
  pdfActionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  pdfActionTxt: { ...typography.small, color: colors.onTint, fontWeight: '700' },

  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.card },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  shareIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  shareTitle: { ...typography.bodyStrong, color: colors.onSurface },
  shareSub: { ...typography.small, color: colors.muted, marginTop: 2 },
  shareActions: { flexDirection: 'row', gap: 4 },
  miniBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },

  newBtn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.sm },
  newBtnTxt: { ...typography.bodyStrong, color: colors.brandDark },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { ...typography.title, color: colors.onSurface },
  formLbl: { ...typography.caption, color: colors.muted, marginTop: spacing.sm, marginBottom: -spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  proOpt: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  proOptActive: { borderColor: colors.brandPrimary, borderWidth: 2 },
  proOptIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  proOptTitle: { ...typography.bodyStrong, color: colors.onSurface },
  proOptDesc: { ...typography.small, color: colors.muted, marginTop: 2 },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, color: colors.onSurface, ...typography.body },
  submit: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.sm },
  submitTxt: { ...typography.bodyStrong, color: colors.brandDark },
});
