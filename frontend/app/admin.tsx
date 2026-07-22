import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { radius, shadow, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Dashboard = {
  generated_at: string;
  users: { total: number; active_7d: number; new_7d: number; new_30d: number; premium_now: number; deleted: number; scheduled_deletion: number; conversion_rate_pct: number };
  content: { posts: number; companies: number };
  revenue: Record<string, { total: number; count: number }>;
  recent_audits: any[];
};

type AdminUser = {
  user_id: string; email: string; name: string; role?: string; banned?: boolean;
  subscription_tier?: string; premium_expires_at?: string | null; created_at?: string;
};

type Transaction = {
  id: string; user_id: string; session_id: string; amount: number; currency: string;
  plan: string; status: string; created_at: string; paid_at?: string;
};

type AuditEntry = {
  id: string; event_type: string; user_id?: string; email?: string; ip?: string;
  timestamp: string; severity: string;
};

type DbStats = {
  database: string; collections: Record<string, { count: number; size_bytes: number; storage_bytes: number; n_indexes: number; indexes: string[] }>;
  count: number;
};

const TABS = ['Dashboard', 'Usuários', 'Transações', 'Auditoria', 'DB'] as const;

export default function AdminScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [tab, setTab] = useState<(typeof TABS)[number]>('Dashboard');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      if (tab === 'Dashboard') setDashboard(await api<Dashboard>('/admin/dashboard'));
      if (tab === 'Usuários') {
        const r = await api<{ items: AdminUser[]; total: number }>(`/admin/users?limit=100${search ? `&search=${encodeURIComponent(search)}` : ''}`);
        setUsers(r.items);
      }
      if (tab === 'Transações') {
        const r = await api<{ items: Transaction[] }>('/admin/transactions?limit=100');
        setTxs(r.items);
      }
      if (tab === 'Auditoria') {
        const r = await api<{ items: AuditEntry[] }>('/admin/audit?limit=100');
        setAudit(r.items);
      }
      if (tab === 'DB') setDbStats(await api<DbStats>('/admin/db-stats'));
    } catch (e: any) {
      setError(e?.message || 'Erro');
    }
  }, [tab, search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const toggleBan = async (u: AdminUser) => {
    Alert.alert(u.banned ? 'Reativar usuário?' : 'Banir usuário?', u.email, [
      { text: 'Cancelar', style: 'cancel' },
      { text: u.banned ? 'Reativar' : 'Banir', style: u.banned ? 'default' : 'destructive', onPress: async () => {
        try { await api(`/admin/users/${u.user_id}/ban`, { method: 'POST', body: { banned: !u.banned } }); await load(); }
        catch (e: any) { Alert.alert('Erro', e?.message || 'Falha'); }
      } },
    ]);
  };

  const grantPremium = async (u: AdminUser, days: number) => {
    try {
      await api(`/admin/users/${u.user_id}/grant-premium`, { method: 'POST', body: { days } });
      Alert.alert('Premium concedido', `+${days} dias para ${u.email}`);
      await load();
    } catch (e: any) { Alert.alert('Erro', e?.message || 'Falha'); }
  };

  if (user?.role !== 'super_admin') {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center', padding: spacing.xl }]}>
        <Ionicons name="lock-closed" size={48} color={colors.muted} />
        <Text style={{ ...typography.title, color: colors.onSurface, marginTop: spacing.md }}>Acesso restrito</Text>
        <Text style={{ ...typography.body, color: colors.muted, textAlign: 'center', marginTop: spacing.sm }}>
          Este painel é exclusivo para super administradores da plataforma.
        </Text>
        <Pressable style={s.btn} onPress={() => router.back()}>
          <Text style={s.btnTxt}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={s.iconBtn} testID="admin-back">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Ionicons name="shield-checkmark" size={18} color={colors.brandDark} />
            <Text style={s.title}>Super Admin</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
          {TABS.map(t => (
            <Pressable key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)} testID={`admin-tab-${t}`}>
              <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        {error && <View style={s.errCard}><Text style={s.errTxt}>{error}</Text></View>}

        {tab === 'Dashboard' && dashboard && (
          <>
            <Text style={s.sectionLbl}>Usuários</Text>
            <View style={s.metricGrid}>
              <MetricBox colors={colors} tint={colors.tintMint} icon="people" label="Total" value={String(dashboard.users.total)} />
              <MetricBox colors={colors} tint={colors.tintButter} icon="flash" label="Ativos 7d" value={String(dashboard.users.active_7d)} />
              <MetricBox colors={colors} tint={colors.tintPeach} icon="diamond" label="Premium" value={String(dashboard.users.premium_now)} sub={`${dashboard.users.conversion_rate_pct}% conversão`} />
              <MetricBox colors={colors} tint={colors.tintLavender} icon="person-add" label="Novos 30d" value={String(dashboard.users.new_30d)} />
            </View>

            <Text style={s.sectionLbl}>Conteúdo</Text>
            <View style={s.metricGrid}>
              <MetricBox colors={colors} tint={colors.tintSky} icon="chatbubbles" label="Posts" value={String(dashboard.content.posts)} />
              <MetricBox colors={colors} tint={colors.tintCoral} icon="business" label="Empresas" value={String(dashboard.content.companies)} />
            </View>

            <Text style={s.sectionLbl}>Receita</Text>
            <View style={s.card}>
              {Object.keys(dashboard.revenue).length === 0 && <Text style={s.emptyTxt}>Nenhuma transação paga ainda</Text>}
              {Object.entries(dashboard.revenue).map(([cur, v]) => (
                <View key={cur} style={s.revRow}>
                  <Text style={s.revCur}>{cur.toUpperCase()}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.revVal}>{v.total.toFixed(2)}</Text>
                    <Text style={s.revSub}>{v.count} transações</Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={s.sectionLbl}>Últimos eventos de auditoria</Text>
            <View style={s.card}>
              {dashboard.recent_audits.slice(0, 5).map((a, i) => (
                <View key={a.id ?? i} style={[s.miniRow, i < 4 && s.rowDivider]}>
                  <Ionicons name="ellipse" size={8} color={colors.brandDark} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniTitle}>{a.event_type}</Text>
                    <Text style={s.miniSub}>{a.email ?? '—'} • {new Date(a.timestamp).toLocaleString('pt-BR')}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {tab === 'Usuários' && (
          <>
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              onBlur={load}
              placeholder="Buscar por email ou nome…"
              placeholderTextColor={colors.muted}
              testID="admin-search"
            />
            <View style={s.card}>
              {users.map((u, i) => (
                <View key={u.user_id} style={[s.userRow, i < users.length - 1 && s.rowDivider]}>
                  <View style={s.avatar}><Text style={s.avatarTxt}>{(u.name?.[0] ?? '?').toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
                      <Text style={s.userName} numberOfLines={1}>{u.name}</Text>
                      {u.role === 'super_admin' && <View style={s.roleBadge}><Text style={s.roleTxt}>ADMIN</Text></View>}
                      {u.premium_expires_at && new Date(u.premium_expires_at) > new Date() && (
                        <View style={[s.roleBadge, { backgroundColor: colors.brandPrimary }]}><Text style={s.roleTxt}>💎</Text></View>
                      )}
                      {u.banned && <View style={[s.roleBadge, { backgroundColor: colors.error }]}><Text style={[s.roleTxt, { color: '#fff' }]}>BAN</Text></View>}
                    </View>
                    <Text style={s.userEmail}>{u.email}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <Pressable onPress={() => grantPremium(u, 30)} style={s.miniBtn}>
                      <Ionicons name="diamond" size={14} color={colors.brandDark} />
                    </Pressable>
                    <Pressable onPress={() => toggleBan(u)} style={s.miniBtn}>
                      <Ionicons name={u.banned ? 'checkmark-circle' : 'ban'} size={14} color={u.banned ? colors.brandDark : colors.error} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {tab === 'Transações' && (
          <View style={s.card}>
            {txs.length === 0 && <Text style={s.emptyTxt}>Nenhuma transação ainda</Text>}
            {txs.map((t, i) => (
              <View key={t.id} style={[s.txRow, i < txs.length - 1 && s.rowDivider]}>
                <View style={[s.txStatus, { backgroundColor: t.status === 'paid' ? colors.brandPrimary : t.status === 'expired' ? '#FFD5D5' : colors.surfaceTertiary }]}>
                  <Text style={[s.txStatusTxt, t.status === 'paid' && { color: colors.brandDark }]}>{t.status}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.txAmount}>{t.currency.toUpperCase()} {t.amount.toFixed(2)}</Text>
                  <Text style={s.txSub}>{t.plan} • {new Date(t.created_at).toLocaleDateString('pt-BR')}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {tab === 'Auditoria' && (
          <View style={s.card}>
            {audit.map((a, i) => (
              <View key={a.id} style={[s.miniRow, i < audit.length - 1 && s.rowDivider]}>
                <Ionicons name="ellipse" size={8} color={a.severity === 'warn' ? colors.error : colors.brandDark} />
                <View style={{ flex: 1 }}>
                  <Text style={s.miniTitle}>{a.event_type}</Text>
                  <Text style={s.miniSub}>{a.email ?? a.user_id ?? '—'} • {a.ip} • {new Date(a.timestamp).toLocaleString('pt-BR')}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {tab === 'DB' && dbStats && (
          <>
            <Text style={s.sectionLbl}>Banco: {dbStats.database}</Text>
            <Text style={s.sectionSub}>{dbStats.count} coleções</Text>
            <View style={s.card}>
              {Object.entries(dbStats.collections).sort((a, b) => (b[1].count ?? 0) - (a[1].count ?? 0)).map(([name, c], i, arr) => (
                <View key={name} style={[s.dbRow, i < arr.length - 1 && s.rowDivider]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.dbName}>{name}</Text>
                    <Text style={s.dbSub}>{c.n_indexes} índices • {(c.storage_bytes / 1024).toFixed(1)}KB</Text>
                  </View>
                  <View style={s.dbCountPill}><Text style={s.dbCountTxt}>{c.count ?? 0}</Text></View>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

function MetricBox({ colors, tint, icon, label, value, sub }: any) {
  return (
    <View style={{ width: '48%', backgroundColor: tint, borderRadius: radius.md, padding: spacing.md, gap: 4, minHeight: 90 }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={16} color={colors.brandDark} />
      </View>
      <Text style={{ ...typography.small, color: colors.onTint, opacity: 0.85, marginTop: 2 }}>{label}</Text>
      <Text style={{ ...typography.title, color: colors.onTint }}>{value}</Text>
      {sub && <Text style={{ ...typography.small, color: colors.onTint, opacity: 0.65 }}>{sub}</Text>}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.title, color: colors.onSurface, fontSize: 17 },
  content: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingTop: spacing.sm },
  tabs: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },
  tab: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  tabTxt: { ...typography.small, color: colors.onSurface, fontWeight: '600' },
  tabTxtActive: { color: colors.brandDark, fontWeight: '800' },

  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  sectionLbl: { ...typography.caption, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.sm },
  sectionSub: { ...typography.small, color: colors.muted, marginTop: -spacing.xs },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.card },

  emptyTxt: { textAlign: 'center', ...typography.body, color: colors.muted, padding: spacing.lg },
  errCard: { backgroundColor: '#FEF2F2', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.error },
  errTxt: { ...typography.body, color: colors.error },

  revRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', padding: spacing.md },
  revCur: { ...typography.bodyStrong, color: colors.brandDark, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, fontSize: 12 },
  revVal: { ...typography.title, color: colors.onSurface },
  revSub: { ...typography.small, color: colors.muted },

  miniRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', padding: spacing.md },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  miniTitle: { ...typography.bodyStrong, color: colors.onSurface, fontSize: 13 },
  miniSub: { ...typography.small, color: colors.muted, marginTop: 1 },

  searchInput: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, color: colors.onSurface, ...typography.body },

  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: colors.onBrandPrimary, fontWeight: '700' },
  userName: { ...typography.bodyStrong, color: colors.onSurface },
  userEmail: { ...typography.small, color: colors.muted, marginTop: 1 },
  roleBadge: { backgroundColor: colors.brandDark, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill },
  roleTxt: { color: colors.brandPrimary, fontWeight: '800', fontSize: 10 },
  miniBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },

  txRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  txStatus: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, minWidth: 55, alignItems: 'center' },
  txStatusTxt: { ...typography.small, fontWeight: '800', fontSize: 10, color: colors.muted, textTransform: 'uppercase' },
  txAmount: { ...typography.bodyStrong, color: colors.onSurface },
  txSub: { ...typography.small, color: colors.muted, marginTop: 1 },

  dbRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  dbName: { ...typography.bodyStrong, color: colors.onSurface, fontSize: 13 },
  dbSub: { ...typography.small, color: colors.muted, marginTop: 1 },
  dbCountPill: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, minWidth: 40, alignItems: 'center' },
  dbCountTxt: { ...typography.small, color: colors.brandDark, fontWeight: '800' },

  btn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, marginTop: spacing.md },
  btnTxt: { ...typography.bodyStrong, color: colors.brandDark },
});
