import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { radius, shadow, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Plan = { id: 'monthly' | 'annual'; amount: number; days: number; label: string };

const FEATURES: { icon: any; title: string; sub: string }[] = [
  { icon: 'sparkles', title: 'Coach IA ilimitado', sub: 'Conversas em português com nutri+personal virtual' },
  { icon: 'camera', title: 'Scanner de refeições por foto', sub: 'Foto → macros e calorias em segundos' },
  { icon: 'images', title: 'Comparador de fotos com IA', sub: 'Análise inteligente de progresso' },
  { icon: 'document-text', title: 'Relatórios PDF profissionais', sub: 'Para nutricionista, personal e médico' },
  { icon: 'people', title: 'Compartilhamento com profissionais', sub: 'Links exclusivos por 30 dias' },
  { icon: 'analytics', title: 'Análises avançadas', sub: 'Tendências, previsões e recomendações' },
  { icon: 'restaurant', title: 'Receitas IA personalizadas', sub: 'Cardápios sob medida para sua meta' },
  { icon: 'cloud-upload', title: 'Backup na nuvem', sub: 'Dados seguros em todos os dispositivos' },
];

export default function PaywallScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [selected, setSelected] = useState<'monthly' | 'annual'>('annual');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ plans: Plan[] }>('/billing/plans').then(r => setPlans(r.plans)).catch(() => {});
  }, []);

  const startCheckout = async () => {
    setLoading(true);
    try {
      const origin = Platform.OS === 'web'
        ? window.location.origin
        : (process.env.EXPO_PUBLIC_BACKEND_URL || '');
      const res = await api<{ checkout_url: string; session_id: string }>('/billing/checkout', {
        method: 'POST',
        body: { plan: selected, origin_url: origin },
      });
      if (Platform.OS === 'web') {
        (window as any).location.href = res.checkout_url;
      } else {
        const result = await WebBrowser.openBrowserAsync(res.checkout_url);
        if (result.type === 'cancel' || result.type === 'dismiss') {
          // Poll status after user returns
          router.push(`/billing-return?session_id=${res.session_id}`);
        }
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível iniciar o checkout');
    } finally { setLoading(false); }
  };

  useEffect(() => { void refresh; }, [refresh]);

  const monthly = plans.find(p => p.id === 'monthly');
  const annual = plans.find(p => p.id === 'annual');
  const monthlyEquiv = annual ? (annual.amount / 12).toFixed(2).replace('.', ',') : '—';
  const savingsPct = monthly && annual ? Math.round((1 - (annual.amount / (monthly.amount * 12))) * 100) : 0;

  if (user?.is_premium) {
    // User already premium — show status card
    return <PremiumStatusView colors={colors} onBack={() => router.back()} />;
  }

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.iconBtn} testID="paywall-back">
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.crownWrap}>
            <Ionicons name="diamond" size={30} color={colors.brandDark} />
          </View>
          <Text style={s.heroTitle}>MoreFit Premium</Text>
          <Text style={s.heroSub}>Desbloqueie IA avançada, análises profundas e ferramentas exclusivas para atingir seus objetivos.</Text>
        </View>

        {/* Plans */}
        <View style={s.planRow}>
          <Pressable
            style={[s.plan, selected === 'monthly' && s.planActive]}
            onPress={() => setSelected('monthly')}
            testID="paywall-plan-monthly"
          >
            <Text style={s.planLabel}>Mensal</Text>
            <Text style={s.planPrice}>R$ {monthly ? monthly.amount.toFixed(2).replace('.', ',') : '—'}</Text>
            <Text style={s.planUnit}>/mês</Text>
          </Pressable>
          <Pressable
            style={[s.plan, selected === 'annual' && s.planActive]}
            onPress={() => setSelected('annual')}
            testID="paywall-plan-annual"
          >
            <View style={s.saveBadge}><Text style={s.saveBadgeTxt}>Economize {savingsPct}%</Text></View>
            <Text style={s.planLabel}>Anual</Text>
            <Text style={s.planPrice}>R$ {monthlyEquiv}</Text>
            <Text style={s.planUnit}>/mês • R$ {annual ? annual.amount.toFixed(2).replace('.', ',') : '—'}/ano</Text>
          </Pressable>
        </View>

        {/* CTA */}
        <Pressable style={[s.cta, loading && { opacity: 0.6 }]} onPress={startCheckout} disabled={loading} testID="paywall-cta">
          {loading ? <ActivityIndicator color={colors.brandDark} /> : (
            <>
              <Ionicons name="flash" size={20} color={colors.brandDark} />
              <Text style={s.ctaTxt}>Assinar Premium</Text>
            </>
          )}
        </Pressable>
        <Text style={s.disclaimer}>Cancele quando quiser • Pagamento seguro via Stripe • Ambiente de teste (use cartão 4242 4242 4242 4242)</Text>

        {/* Features */}
        <Text style={s.sectionLbl}>Recursos Premium</Text>
        <View style={s.featureList}>
          {FEATURES.map((f, i) => (
            <View key={i} style={s.featureRow}>
              <View style={s.featureIcon}>
                <Ionicons name={f.icon} size={18} color={colors.brandDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureSub}>{f.sub}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={colors.brandPrimary} />
            </View>
          ))}
        </View>

        <View style={s.freeCard}>
          <Text style={s.freeTitle}>Plano Gratuito inclui:</Text>
          <View style={{ gap: 4, marginTop: spacing.xs }}>
            {['Cadastro de peso', 'Gráficos básicos', 'Diário de água', 'IMC & Metas', 'Passos', 'Fotos manuais', 'Backup local'].map((f, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
                <Ionicons name="checkmark" size={13} color={colors.muted} />
                <Text style={s.freeTxt}>{f}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

function PremiumStatusView({ colors, onBack }: { colors: ThemeColors; onBack: () => void }) {
  const s = makeStyles(colors);
  const { user } = useAuth();
  const router = useRouter();
  const exp = user?.premium_expires_at ? new Date(user.premium_expires_at) : null;
  const daysLeft = exp ? Math.max(0, Math.ceil((exp.getTime() - Date.now()) / 86400000)) : 0;
  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable onPress={onBack} style={s.iconBtn}><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
          <Text style={{ ...typography.title, color: colors.onSurface }}>Premium</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.hero}>
          <View style={s.crownWrap}><Ionicons name="diamond" size={30} color={colors.brandDark} /></View>
          <Text style={s.heroTitle}>Você é Premium 🎉</Text>
          <Text style={s.heroSub}>Aproveite todos os recursos exclusivos por mais {daysLeft} dias.</Text>
        </View>
        <View style={s.statusCard}>
          <Text style={s.sectionLbl}>Sua assinatura</Text>
          <View style={s.statusRow}>
            <Text style={s.statusLbl}>Status</Text>
            <View style={s.activeBadge}><Text style={s.activeBadgeTxt}>Ativa</Text></View>
          </View>
          <View style={s.statusRow}>
            <Text style={s.statusLbl}>Expira em</Text>
            <Text style={s.statusVal}>{exp ? exp.toLocaleDateString('pt-BR') : '—'}</Text>
          </View>
          <View style={s.statusRow}>
            <Text style={s.statusLbl}>Dias restantes</Text>
            <Text style={s.statusVal}>{daysLeft} dias</Text>
          </View>
        </View>
        <Pressable style={s.cta} onPress={() => router.push('/paywall?renew=1')}>
          <Ionicons name="add-circle" size={20} color={colors.brandDark} />
          <Text style={s.ctaTxt}>Renovar ou estender</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingTop: spacing.xs },

  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  crownWrap: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  heroTitle: { fontSize: 26, fontWeight: '800', color: colors.onSurface, textAlign: 'center', letterSpacing: -0.5 },
  heroSub: { ...typography.body, color: colors.muted, textAlign: 'center', paddingHorizontal: spacing.md, lineHeight: 20 },

  planRow: { flexDirection: 'row', gap: spacing.sm },
  plan: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 2, borderColor: colors.border, gap: 2, minHeight: 105 },
  planActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  planLabel: { ...typography.caption, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
  planPrice: { fontSize: 24, fontWeight: '800', color: colors.onSurface, letterSpacing: -1 },
  planUnit: { ...typography.small, color: colors.muted },
  saveBadge: { position: 'absolute', top: -10, right: 8, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  saveBadgeTxt: { ...typography.small, color: colors.brandDark, fontWeight: '800', fontSize: 10 },

  cta: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.sm },
  ctaTxt: { ...typography.bodyStrong, color: colors.brandDark, fontSize: 16 },
  disclaimer: { ...typography.small, color: colors.muted, textAlign: 'center', paddingHorizontal: spacing.md, lineHeight: 16 },

  sectionLbl: { ...typography.caption, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.md },
  featureList: { gap: spacing.xs, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  featureRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', paddingVertical: spacing.xs },
  featureIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { ...typography.bodyStrong, color: colors.onSurface },
  featureSub: { ...typography.small, color: colors.muted, marginTop: 1 },

  freeCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  freeTitle: { ...typography.caption, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
  freeTxt: { ...typography.small, color: colors.muted },

  statusCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLbl: { ...typography.body, color: colors.muted },
  statusVal: { ...typography.bodyStrong, color: colors.onSurface },
  activeBadge: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  activeBadgeTxt: { ...typography.small, color: colors.brandDark, fontWeight: '800' },
});
