import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, getToken } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { radius, shadow, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Metric = 'water_ml' | 'steps' | 'sleep_hours' | 'weight_loss_kg' | 'exercise_min' | 'meals_count';

type Company = {
  id: string; name: string; industry?: string | null; plan: string; code: string;
  owner_id: string; role: 'admin' | 'member'; member_count: number;
};
type Dashboard = {
  member_count: number; active_today: number; engagement_pct: number; period_days: number;
  totals: { water_ml: number; steps: number; exercise_min: number; meals: number };
  averages: { water_ml_per_user: number; steps_per_user: number; exercise_min_per_user: number; sleep_hours: number };
};
type LbItem = { user_id: string; name: string; avatar?: string | null; xp: number; level: number; streak: number; is_me: boolean; rank: number };
type Member = { user_id: string; name: string; email?: string; avatar?: string | null; role: string; joined_at: string; membership_id: string };
type Campaign = {
  id: string; title: string; description?: string; metric: Metric; target_value: number;
  start_date: string; end_date: string; participant_count: number; joined: boolean;
};

const METRIC_META: Record<Metric, { label: string; unit: string; icon: any }> = {
  water_ml: { label: 'Hidratação total', unit: 'ml', icon: 'water' },
  steps: { label: 'Passos', unit: 'passos', icon: 'footsteps' },
  sleep_hours: { label: 'Horas de sono', unit: 'h', icon: 'moon' },
  weight_loss_kg: { label: 'Perda de peso', unit: 'kg', icon: 'arrow-down' },
  exercise_min: { label: 'Minutos de exercício', unit: 'min', icon: 'flame' },
  meals_count: { label: 'Refeições registradas', unit: 'ref.', icon: 'restaurant' },
};

const PLAN_LABEL: Record<string, string> = {
  free: 'Grátis', starter: 'Starter', business: 'Business', enterprise: 'Enterprise',
};

const TABS = ['Painel', 'Campanhas', 'Ranking', 'Membros'] as const;

export default function CompanyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [tab, setTab] = useState<(typeof TABS)[number]>('Painel');
  const [company, setCompany] = useState<Company | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [lb, setLb] = useState<{ items: LbItem[]; my_rank: number | null; total: number } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [newCampOpen, setNewCampOpen] = useState(false);
  const [cTitle, setCTitle] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cMetric, setCMetric] = useState<Metric>('water_ml');
  const [cTarget, setCTarget] = useState('');
  const [creating, setCreating] = useState(false);

  const isAdmin = company?.role === 'admin';

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const co = await api<Company>(`/companies/${id}`);
      setCompany(co);
      const camps = await api<{ items: Campaign[] }>(`/companies/${id}/campaigns`);
      setCampaigns(camps.items);
      const rk = await api<{ items: LbItem[]; my_rank: number | null; total: number }>(`/companies/${id}/leaderboard`);
      setLb(rk);
      if (co.role === 'admin') {
        const [d, m] = await Promise.all([
          api<Dashboard>(`/companies/${id}/dashboard`),
          api<{ items: Member[] }>(`/companies/${id}/members`),
        ]);
        setDash(d);
        setMembers(m.items);
      } else {
        setDash(null); setMembers([]);
      }
    } catch (e: any) {
      console.log(e);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const copyCode = async () => {
    if (!company) return;
    await Clipboard.setStringAsync(company.code);
    Alert.alert('Código copiado', company.code);
  };

  const leave = () => {
    Alert.alert('Sair da empresa?', 'Você poderá entrar novamente com o mesmo código.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => {
        try { await api(`/companies/${id}/leave`, { method: 'POST' }); router.back(); }
        catch (e: any) { Alert.alert('Erro', e?.message || 'Falha'); }
      } },
    ]);
  };

  const deleteCompany = () => {
    Alert.alert('Excluir empresa?', 'Todos os dados corporativos serão removidos.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        try { await api(`/companies/${id}`, { method: 'DELETE' }); router.back(); }
        catch (e: any) { Alert.alert('Erro', e?.message || 'Falha'); }
      } },
    ]);
  };

  const removeMember = (m: Member) => {
    if (!isAdmin) return;
    Alert.alert('Remover membro?', `${m.name} não terá mais acesso.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        try { await api(`/companies/${id}/members/${m.user_id}`, { method: 'DELETE' }); await load(); }
        catch (e: any) { Alert.alert('Erro', e?.message || 'Falha'); }
      } },
    ]);
  };

  const createCampaign = async () => {
    const target = parseFloat(cTarget.replace(',', '.'));
    if (!cTitle.trim() || isNaN(target) || target <= 0) {
      Alert.alert('Erro', 'Preencha título e meta válidos'); return;
    }
    setCreating(true);
    try {
      await api(`/companies/${id}/campaigns`, {
        method: 'POST', body: { title: cTitle.trim(), description: cDesc.trim() || null, metric: cMetric, target_value: target },
      });
      setNewCampOpen(false); setCTitle(''); setCDesc(''); setCMetric('water_ml'); setCTarget('');
      await load();
    } catch (e: any) { Alert.alert('Erro', e?.message || 'Falha'); }
    finally { setCreating(false); }
  };

  const toggleJoinCampaign = async (c: Campaign) => {
    try {
      if (c.joined) await api(`/campaigns/${c.id}/leave`, { method: 'POST' });
      else await api(`/campaigns/${c.id}/join`, { method: 'POST' });
      await load();
    } catch (e: any) { Alert.alert('Erro', e?.message || 'Falha'); }
  };

  const downloadCorporatePdf = async () => {
    try {
      const token = await getToken();
      const url = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/companies/${id}/report/pdf`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token ?? ''}` } });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      if (typeof window !== 'undefined' && (window as any).URL?.createObjectURL) {
        const blob = await res.blob();
        const dlUrl = (window as any).URL.createObjectURL(blob);
        const a = (window as any).document.createElement('a');
        a.href = dlUrl; a.download = `vitatracker-corporate-${company?.name}.pdf`; a.click();
        setTimeout(() => (window as any).URL.revokeObjectURL(dlUrl), 500);
      } else {
        const FileSystem = await import('expo-file-system');
        const Sharing = await import('expo-sharing');
        const b64 = arrayBufferToBase64(await res.arrayBuffer());
        const path = FileSystem.cacheDirectory + `vitatracker-corporate.pdf`;
        await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
      }
    } catch (e: any) { Alert.alert('Erro', e?.message || 'Falha ao gerar PDF'); }
  };

  if (!company) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.iconBtn} testID="co-detail-back">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title} numberOfLines={1}>{company.name}</Text>
          <Pressable onPress={company.owner_id === user?.user_id ? deleteCompany : leave} style={s.iconBtn}>
            <Ionicons name={company.owner_id === user?.user_id ? 'trash-outline' : 'exit-outline'} size={20} color={colors.error} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        {/* Company hero */}
        <View style={s.hero}>
          <View style={s.heroLogo}><Ionicons name="business" size={26} color={colors.brandDark} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroName}>{company.name}</Text>
            <Text style={s.heroMeta}>
              {company.industry ? `${company.industry} • ` : ''}Plano {PLAN_LABEL[company.plan] || company.plan}
            </Text>
            <View style={s.heroRow}>
              <Pressable style={s.codeBadge} onPress={copyCode} testID="co-copy-code">
                <Ionicons name="copy-outline" size={12} color={colors.brandDark} />
                <Text style={s.codeTxt}>{company.code}</Text>
              </Pressable>
              <Text style={s.memberInfo}>👥 {company.member_count}</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          {TABS.map(t => {
            // Hide "Membros" tab for non-admin members
            if (t === 'Membros' && !isAdmin) return null;
            return (
              <Pressable key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)} testID={`co-tab-${t}`}>
                <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'Painel' && (
          <>
            {isAdmin && dash ? (
              <>
                <View style={s.metricRow}>
                  <MetricBox colors={colors} tint={colors.tintMint} icon="people" label="Membros" value={String(dash.member_count)} />
                  <MetricBox colors={colors} tint={colors.tintButter} icon="flash" label="Ativos hoje" value={String(dash.active_today)} sub={`${dash.engagement_pct}% engajamento`} />
                </View>
                <View style={s.metricRow}>
                  <MetricBox colors={colors} tint={colors.tintSky} icon="water" label="Água (7d)" value={`${(dash.totals.water_ml / 1000).toFixed(1)}L`} sub={`${dash.averages.water_ml_per_user} ml/usuário`} />
                  <MetricBox colors={colors} tint={colors.tintLavender} icon="footsteps" label="Passos (7d)" value={String(dash.totals.steps)} sub={`${dash.averages.steps_per_user}/usuário`} />
                </View>
                <View style={s.metricRow}>
                  <MetricBox colors={colors} tint={colors.tintPeach} icon="flame" label="Exercício (7d)" value={`${dash.totals.exercise_min}min`} sub={`${dash.averages.exercise_min_per_user}min/usuário`} />
                  <MetricBox colors={colors} tint={colors.tintCoral} icon="moon" label="Sono médio" value={`${dash.averages.sleep_hours}h`} sub="por usuário/dia" />
                </View>
                <Pressable style={s.pdfBtn} onPress={downloadCorporatePdf} testID="co-pdf">
                  <Ionicons name="document-text" size={18} color={colors.brandDark} />
                  <Text style={s.pdfBtnTxt}>Baixar relatório PDF</Text>
                </Pressable>
              </>
            ) : (
              <View style={s.notAdminCard}>
                <Ionicons name="information-circle" size={22} color={colors.brandPrimary} />
                <Text style={s.notAdminTxt}>
                  Você é membro desta empresa. O painel completo é visível apenas para administradores. Veja campanhas e ranking nas outras abas!
                </Text>
              </View>
            )}
          </>
        )}

        {tab === 'Campanhas' && (
          <>
            {isAdmin && (
              <Pressable style={s.newCampBtn} onPress={() => setNewCampOpen(true)} testID="co-new-camp">
                <Ionicons name="add-circle" size={18} color={colors.brandDark} />
                <Text style={s.newCampTxt}>Nova campanha</Text>
              </Pressable>
            )}
            {campaigns.length === 0 && (
              <View style={s.empty}>
                <Ionicons name="trophy-outline" size={44} color={colors.muted} />
                <Text style={s.emptyTitle}>Nenhuma campanha ativa</Text>
                <Text style={s.emptySub}>{isAdmin ? 'Crie uma para engajar sua equipe!' : 'Aguarde o administrador criar uma.'}</Text>
              </View>
            )}
            {campaigns.map(c => {
              const meta = METRIC_META[c.metric];
              return (
                <Pressable key={c.id} style={s.campCard} onPress={() => router.push(`/campaign/${c.id}`)}>
                  <View style={s.campIcon}><Ionicons name={meta.icon} size={22} color={colors.brandDark} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.campTitle}>{c.title}</Text>
                    <Text style={s.campSub}>
                      Meta: {formatMetric(c.metric, c.target_value)} • {c.participant_count} {c.participant_count === 1 ? 'participante' : 'participantes'}
                    </Text>
                    <Text style={s.campDates}>{formatBR(c.start_date)} → {formatBR(c.end_date)}</Text>
                  </View>
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); toggleJoinCampaign(c); }}
                    style={[s.joinBtn, c.joined && s.joinBtnActive]}
                    testID={`co-join-camp-${c.id}`}
                  >
                    <Text style={[s.joinBtnTxt, c.joined && { color: colors.brandDark }]}>{c.joined ? '✓ Participando' : '+ Entrar'}</Text>
                  </Pressable>
                </Pressable>
              );
            })}
          </>
        )}

        {tab === 'Ranking' && (
          <>
            {lb?.my_rank && (
              <View style={s.myRankCard}>
                <Ionicons name="ribbon" size={18} color={colors.brandDark} />
                <Text style={s.myRankTxt}>Você está em <Text style={{ fontWeight: '800' }}>#{lb.my_rank}</Text> de {lb.total} membros</Text>
              </View>
            )}
            <View style={s.rankCard}>
              {(lb?.items ?? []).map((u, i) => (
                <View key={u.user_id} style={[s.lbRow, i < (lb?.items.length ?? 0) - 1 && s.rowDivider, u.is_me && s.lbMe]}>
                  <View style={[s.rankBadge, u.rank <= 3 && s.rankTop]}>
                    <Text style={s.rankTxt}>{u.rank === 1 ? '🥇' : u.rank === 2 ? '🥈' : u.rank === 3 ? '🥉' : `#${u.rank}`}</Text>
                  </View>
                  <View style={s.lbAvatar}><Text style={s.lbAvatarTxt}>{(u.name[0] ?? '?').toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.lbName, u.is_me && { fontWeight: '800' }]} numberOfLines={1}>{u.name}{u.is_me ? ' (você)' : ''}</Text>
                    <Text style={s.lbSub}>Nível {u.level} • 🔥 {u.streak}d</Text>
                  </View>
                  <Text style={s.lbXp}>{u.xp} XP</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {tab === 'Membros' && isAdmin && (
          <View style={s.rankCard}>
            {members.map((m, i) => (
              <View key={m.user_id} style={[s.memberRow, i < members.length - 1 && s.rowDivider]}>
                <View style={s.lbAvatar}><Text style={s.lbAvatarTxt}>{(m.name[0] ?? '?').toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.memberName}>{m.name}</Text>
                  <Text style={s.memberEmail}>{m.email}</Text>
                </View>
                {m.role === 'admin' ? (
                  <View style={s.adminBadge}><Text style={s.adminBadgeTxt}>Admin</Text></View>
                ) : (
                  <Pressable onPress={() => removeMember(m)} style={s.rmBtn}>
                    <Ionicons name="person-remove" size={16} color={colors.error} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* New Campaign Modal */}
      <Modal visible={newCampOpen} transparent animationType="slide" onRequestClose={() => setNewCampOpen(false)}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>Nova campanha</Text>
              <Pressable onPress={() => setNewCampOpen(false)}><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <Text style={s.lbl}>Título</Text>
            <TextInput style={s.input} value={cTitle} onChangeText={setCTitle} placeholder="Ex.: 30 dias de hidratação" placeholderTextColor={colors.muted} testID="camp-form-title" />
            <Text style={s.lbl}>Descrição (opcional)</Text>
            <TextInput style={[s.input, { minHeight: 70 }]} value={cDesc} onChangeText={setCDesc} placeholder="Explique o desafio…" placeholderTextColor={colors.muted} multiline />
            <Text style={s.lbl}>Métrica</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
              {(Object.keys(METRIC_META) as Metric[]).map(m => (
                <Pressable key={m} onPress={() => setCMetric(m)} style={[s.metricChip, cMetric === m && s.metricChipActive]} testID={`camp-form-metric-${m}`}>
                  <Ionicons name={METRIC_META[m].icon} size={14} color={cMetric === m ? colors.brandDark : colors.onSurface} />
                  <Text style={[s.metricChipTxt, cMetric === m && { color: colors.brandDark, fontWeight: '800' }]}>{METRIC_META[m].label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={s.lbl}>Meta ({METRIC_META[cMetric].unit})</Text>
            <TextInput style={s.input} value={cTarget} onChangeText={setCTarget} placeholder="Ex.: 60000" placeholderTextColor={colors.muted} keyboardType="numeric" testID="camp-form-target" />
            <Pressable style={[s.submit, creating && { opacity: 0.5 }]} onPress={createCampaign} disabled={creating} testID="camp-form-submit">
              {creating ? <ActivityIndicator color={colors.brandDark} /> : <><Ionicons name="checkmark" size={18} color={colors.brandDark} /><Text style={s.submitTxt}>Criar</Text></>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MetricBox({ colors, tint, icon, label, value, sub }: any) {
  return (
    <View style={{ flex: 1, backgroundColor: tint, borderRadius: radius.md, padding: spacing.md, gap: 4, minHeight: 100 }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={16} color={colors.brandDark} />
      </View>
      <Text style={{ ...typography.small, color: colors.onTint, opacity: 0.85, marginTop: 4 }}>{label}</Text>
      <Text style={{ ...typography.title, color: colors.onTint }}>{value}</Text>
      {sub && <Text style={{ ...typography.small, color: colors.onTint, opacity: 0.7 }}>{sub}</Text>}
    </View>
  );
}

function formatMetric(m: Metric, v: number): string {
  const meta = METRIC_META[m];
  if (m === 'water_ml') return `${(v / 1000).toFixed(1)}L`;
  return `${v} ${meta.unit}`;
}
function formatBR(iso: string): string {
  try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); } catch { return iso; }
}
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  if (typeof btoa !== 'undefined') return btoa(bin);
  return '';
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.title, color: colors.onSurface, flex: 1, textAlign: 'center', marginHorizontal: spacing.sm },
  content: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingTop: spacing.xs },

  hero: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.surfaceInverse, padding: spacing.lg, borderRadius: radius.lg },
  heroLogo: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  heroName: { ...typography.headline, color: colors.onSurfaceInverse },
  heroMeta: { ...typography.small, color: colors.onSurfaceInverse, opacity: 0.7, marginTop: 2 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  codeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  codeTxt: { ...typography.small, color: colors.brandDark, fontWeight: '800' },
  memberInfo: { ...typography.small, color: colors.onSurfaceInverse, opacity: 0.85 },

  tabs: { flexDirection: 'row', backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colors.border, gap: 2 },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.brandPrimary },
  tabTxt: { ...typography.small, color: colors.onSurface, fontWeight: '600' },
  tabTxtActive: { color: colors.brandDark, fontWeight: '800' },

  metricRow: { flexDirection: 'row', gap: spacing.sm },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.sm },
  pdfBtnTxt: { ...typography.bodyStrong, color: colors.brandDark },

  notAdminCard: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  notAdminTxt: { flex: 1, ...typography.small, color: colors.onSurfaceSecondary, lineHeight: 18 },

  newCampBtn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.md },
  newCampTxt: { ...typography.bodyStrong, color: colors.brandDark },
  campCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadow.card },
  campIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  campTitle: { ...typography.bodyStrong, color: colors.onSurface },
  campSub: { ...typography.small, color: colors.muted, marginTop: 2 },
  campDates: { ...typography.small, color: colors.brandDark, fontWeight: '600', marginTop: 2 },
  joinBtn: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceInverse },
  joinBtnActive: { backgroundColor: colors.brandPrimary },
  joinBtnTxt: { color: colors.onSurfaceInverse, fontWeight: '700', fontSize: 11 },

  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { ...typography.bodyStrong, color: colors.onSurface },
  emptySub: { ...typography.small, color: colors.muted, textAlign: 'center', paddingHorizontal: spacing.lg },

  myRankCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.md },
  myRankTxt: { ...typography.body, color: colors.brandDark, flex: 1 },
  rankCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  lbRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  lbMe: { backgroundColor: colors.brandTertiary },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rankBadge: { width: 40, height: 30, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  rankTop: { backgroundColor: colors.brandPrimary },
  rankTxt: { fontSize: 13, fontWeight: '800', color: colors.onSurface },
  lbAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  lbAvatarTxt: { color: colors.onBrandPrimary, fontWeight: '700' },
  lbName: { ...typography.bodyStrong, color: colors.onSurface },
  lbSub: { ...typography.small, color: colors.muted, marginTop: 1 },
  lbXp: { ...typography.bodyStrong, color: colors.brandDark, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, fontSize: 12 },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  memberName: { ...typography.bodyStrong, color: colors.onSurface },
  memberEmail: { ...typography.small, color: colors.muted, marginTop: 1 },
  adminBadge: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  adminBadgeTxt: { ...typography.small, color: colors.brandDark, fontWeight: '800', fontSize: 10 },
  rmBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { ...typography.title, color: colors.onSurface },
  lbl: { ...typography.caption, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.sm },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, color: colors.onSurface, ...typography.body },
  metricChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  metricChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  metricChipTxt: { ...typography.small, color: colors.onSurface },
  submit: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  submitTxt: { ...typography.bodyStrong, color: colors.brandDark },
});
