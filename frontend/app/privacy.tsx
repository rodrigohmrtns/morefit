import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, getToken } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { radius, shadow, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Summary = {
  user_id: string;
  email: string;
  counts: Record<string, number>;
  total_records: number;
  deletion_scheduled_at: string | null;
  deletion_effective_at: string | null;
};

type AuditItem = {
  id: string;
  event_type: string;
  timestamp: string;
  ip?: string;
  user_agent?: string;
  severity: 'info' | 'warn' | 'error';
};

const EVENT_LABEL: Record<string, { label: string; icon: any }> = {
  'auth.login': { label: 'Login', icon: 'log-in' },
  'auth.login_failed': { label: 'Tentativa de login', icon: 'warning' },
  'auth.register': { label: 'Cadastro', icon: 'person-add' },
  'lgpd.export': { label: 'Exportação de dados', icon: 'cloud-download' },
  'lgpd.deletion_scheduled': { label: 'Exclusão agendada', icon: 'trash' },
  'lgpd.deletion_cancelled': { label: 'Exclusão cancelada', icon: 'refresh' },
};

const COLLECTION_LABEL: Record<string, string> = {
  weights: 'Pesos',
  meals: 'Refeições',
  waters: 'Água',
  exercises: 'Exercícios',
  sleeps: 'Sono',
  moods: 'Humor',
  photos: 'Fotos',
  steps: 'Passos',
  fasts: 'Jejuns',
  food_favorites: 'Alimentos favoritos',
  coach_messages: 'Mensagens com Coach IA',
  shares: 'Compartilhamentos',
  posts: 'Posts na comunidade',
  comments: 'Comentários',
  payment_transactions: 'Transações',
  webhook_events: 'Eventos de pagamento',
  campaign_participations: 'Campanhas',
  company_members: 'Empresas',
  audit_logs: 'Registros de auditoria',
};

export default function PrivacyScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sum, aud] = await Promise.all([
        api<Summary>('/lgpd/summary'),
        api<{ items: AuditItem[] }>('/lgpd/audit?limit=30'),
      ]);
      setSummary(sum);
      setAudit(aud.items);
    } catch (e) { console.log(e); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const exportData = async () => {
    setExporting(true);
    try {
      const token = await getToken();
      const url = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/lgpd/export`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token ?? ''}` } });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const filename = `morefit-lgpd-${summary?.email?.replace('@', '_at_') ?? 'user'}.json`;
      if (typeof window !== 'undefined' && (window as any).URL?.createObjectURL) {
        const blob = await res.blob();
        const dlUrl = (window as any).URL.createObjectURL(blob);
        const a = (window as any).document.createElement('a');
        a.href = dlUrl; a.download = filename; a.click();
        setTimeout(() => (window as any).URL.revokeObjectURL(dlUrl), 500);
      } else {
        const FileSystem = await import('expo-file-system');
        const Sharing = await import('expo-sharing');
        const txt = await res.text();
        const path = FileSystem.cacheDirectory + filename;
        await FileSystem.writeAsStringAsync(path, txt, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
      }
      Alert.alert('Sucesso', 'Seus dados foram exportados. A ação foi registrada na auditoria.');
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao exportar');
    } finally { setExporting(false); }
  };

  const scheduleDeletion = () => {
    Alert.alert(
      'Excluir conta?',
      'Sua conta será marcada para exclusão em 30 dias. Durante esse período, você pode cancelar a qualquer momento fazendo login novamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive', onPress: async () => {
            setBusy(true);
            try {
              await api('/lgpd/delete-account', { method: 'POST' });
              await refresh();
              await load();
              Alert.alert('Exclusão agendada', 'Sua conta será removida em 30 dias.');
            } catch (e: any) {
              Alert.alert('Erro', e?.message || 'Falha');
            } finally { setBusy(false); }
          },
        },
      ],
    );
  };

  const cancelDeletion = async () => {
    setBusy(true);
    try {
      await api('/lgpd/cancel-deletion', { method: 'POST' });
      await refresh();
      await load();
      Alert.alert('Exclusão cancelada', 'Sua conta continuará ativa normalmente.');
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha');
    } finally { setBusy(false); }
  };

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={s.iconBtn} testID="privacy-back">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title}>Privacidade & LGPD</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <Ionicons name="shield-checkmark" size={22} color={colors.brandPrimary} />
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle}>Seus direitos, seus dados</Text>
            <Text style={s.heroSub}>
              De acordo com a LGPD, você pode acessar, exportar e excluir todos os seus dados a qualquer momento.
            </Text>
          </View>
        </View>

        {/* Deletion warning */}
        {summary?.deletion_scheduled_at && (
          <View style={s.warnCard}>
            <Ionicons name="warning" size={20} color={colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={s.warnTitle}>Sua conta será excluída em breve</Text>
              <Text style={s.warnSub}>
                Excluída em {summary.deletion_effective_at ? new Date(summary.deletion_effective_at).toLocaleDateString('pt-BR') : '—'}.
                Cancele antes dessa data para preservar seus dados.
              </Text>
              <Pressable style={s.cancelBtn} onPress={cancelDeletion} disabled={busy} testID="privacy-cancel-deletion">
                {busy ? <ActivityIndicator color={colors.brandDark} /> : (
                  <><Ionicons name="refresh" size={16} color={colors.brandDark} /><Text style={s.cancelBtnTxt}>Cancelar exclusão</Text></>
                )}
              </Pressable>
            </View>
          </View>
        )}

        <Text style={s.sectionLbl}>Meus dados</Text>
        <View style={s.card}>
          <View style={s.statRow}>
            <View style={s.statBox}>
              <Text style={s.statVal}>{summary?.total_records ?? 0}</Text>
              <Text style={s.statLbl}>Registros no total</Text>
            </View>
            <View style={s.statBox}>
              <Text style={s.statVal}>{Object.values(summary?.counts ?? {}).filter(v => v > 0).length}</Text>
              <Text style={s.statLbl}>Categorias com dados</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <Pressable style={s.actionRow} onPress={exportData} disabled={exporting} testID="privacy-export">
          <View style={[s.actionIcon, { backgroundColor: colors.brandPrimary }]}>
            <Ionicons name="cloud-download" size={20} color={colors.brandDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.actionTitle}>Exportar meus dados</Text>
            <Text style={s.actionSub}>Baixe um arquivo JSON com tudo</Text>
          </View>
          {exporting ? <ActivityIndicator color={colors.brandPrimary} /> : <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
        </Pressable>

        {!summary?.deletion_scheduled_at && (
          <Pressable style={[s.actionRow, s.dangerRow]} onPress={scheduleDeletion} disabled={busy} testID="privacy-delete">
            <View style={[s.actionIcon, { backgroundColor: colors.error }]}>
              <Ionicons name="trash" size={20} color={colors.surface} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.actionTitle, { color: colors.error }]}>Excluir minha conta</Text>
              <Text style={s.actionSub}>Grace period de 30 dias antes da remoção definitiva</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.error} />
          </Pressable>
        )}

        <Text style={s.sectionLbl}>Detalhamento por categoria</Text>
        <View style={s.card}>
          {Object.entries(summary?.counts ?? {}).map(([key, count], i, arr) => (
            <View key={key} style={[s.countRow, i < arr.length - 1 && s.rowDivider]}>
              <Text style={s.countLbl}>{COLLECTION_LABEL[key] ?? key}</Text>
              <View style={s.countPill}>
                <Text style={s.countTxt}>{count}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={s.sectionLbl}>Histórico de auditoria</Text>
        <Text style={s.sectionSub}>Últimas ações realizadas na sua conta</Text>
        <View style={s.card}>
          {audit.length === 0 && <Text style={s.emptyTxt}>Sem eventos registrados</Text>}
          {audit.map((a, i) => {
            const meta = EVENT_LABEL[a.event_type] ?? { label: a.event_type, icon: 'ellipse' };
            return (
              <View key={a.id} style={[s.auditRow, i < audit.length - 1 && s.rowDivider]}>
                <View style={[s.auditIcon, a.severity === 'warn' && { backgroundColor: '#FFF4CC' }, a.severity === 'error' && { backgroundColor: '#FFD5D5' }]}>
                  <Ionicons name={meta.icon} size={14} color={a.severity === 'error' ? colors.error : colors.brandDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.auditTitle}>{meta.label}</Text>
                  <Text style={s.auditMeta}>
                    {new Date(a.timestamp).toLocaleString('pt-BR')} • {a.ip ?? '—'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={s.legal}>
          <Text style={s.legalTitle}>Sobre a LGPD</Text>
          <Text style={s.legalTxt}>
            A Lei Geral de Proteção de Dados (Lei 13.709/2018) garante seus direitos sobre dados pessoais.
            Todos os dados são criptografados em trânsito (HTTPS) e senhas são armazenadas com bcrypt.
            {'\n\n'}
            Você pode entrar em contato conosco para outras solicitações relacionadas aos seus dados.
          </Text>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
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

  warnCard: { flexDirection: 'row', gap: spacing.md, backgroundColor: '#FEF2F2', borderColor: colors.error, borderWidth: 1, padding: spacing.md, borderRadius: radius.md },
  warnTitle: { ...typography.bodyStrong, color: colors.error },
  warnSub: { ...typography.small, color: colors.error, marginTop: 4, lineHeight: 17 },
  cancelBtn: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', backgroundColor: colors.brandPrimary, alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, marginTop: spacing.sm },
  cancelBtnTxt: { ...typography.small, color: colors.brandDark, fontWeight: '800' },

  sectionLbl: { ...typography.caption, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.sm },
  sectionSub: { ...typography.small, color: colors.muted, marginTop: -spacing.xs },

  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.card },
  statRow: { flexDirection: 'row', padding: spacing.md, gap: spacing.md },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 28, fontWeight: '800', color: colors.brandDark, letterSpacing: -0.5 },
  statLbl: { ...typography.small, color: colors.muted, textAlign: 'center', marginTop: 2 },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadow.card },
  dangerRow: { borderColor: '#FEE2E2', backgroundColor: '#FEF7F7' },
  actionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { ...typography.bodyStrong, color: colors.onSurface },
  actionSub: { ...typography.small, color: colors.muted, marginTop: 2 },

  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  countLbl: { ...typography.body, color: colors.onSurface },
  countPill: { backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, minWidth: 34, alignItems: 'center' },
  countTxt: { ...typography.small, color: colors.onBrandTertiary, fontWeight: '800' },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },

  auditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  auditIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  auditTitle: { ...typography.bodyStrong, color: colors.onSurface, fontSize: 13 },
  auditMeta: { ...typography.small, color: colors.muted, marginTop: 2 },

  emptyTxt: { textAlign: 'center', ...typography.body, color: colors.muted, padding: spacing.lg },

  legal: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  legalTitle: { ...typography.caption, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700', marginBottom: spacing.xs },
  legalTxt: { ...typography.small, color: colors.muted, lineHeight: 18 },
});
