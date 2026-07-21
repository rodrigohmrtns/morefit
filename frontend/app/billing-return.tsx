import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { radius, shadow, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Status = 'checking' | 'paid' | 'canceled' | 'expired' | 'timeout' | 'error';

export default function BillingReturnScreen() {
  const { session_id, status: initialStatus } = useLocalSearchParams<{ session_id?: string; status?: string }>();
  const router = useRouter();
  const { refresh } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [status, setStatus] = useState<Status>(initialStatus === 'cancel' ? 'canceled' : 'checking');
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const attemptsRef = useRef(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!session_id || initialStatus === 'cancel') return;

    const poll = async () => {
      attemptsRef.current += 1;
      if (attemptsRef.current > 15) { // ~30s of polling (interval below)
        setStatus('timeout');
        return;
      }
      try {
        const r = await api<{ status: string; payment_status: string; premium_expires_at?: string | null }>(
          `/billing/status/${session_id}`
        );
        if (r.status === 'paid') {
          setStatus('paid');
          setPremiumUntil(r.premium_expires_at || null);
          await refresh();
          return;
        }
        if (r.status === 'expired') { setStatus('expired'); return; }
        // otherwise keep polling
        timerRef.current = setTimeout(poll, 2000);
      } catch (e) {
        console.log('poll error', e);
        setStatus('error');
      }
    };

    poll();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [session_id, initialStatus, refresh]);

  const content = (() => {
    switch (status) {
      case 'checking':
        return (
          <>
            <ActivityIndicator size="large" color={colors.brandPrimary} />
            <Text style={s.title}>Confirmando pagamento…</Text>
            <Text style={s.sub}>Aguarde um instante enquanto verificamos sua transação.</Text>
          </>
        );
      case 'paid':
        return (
          <>
            <View style={[s.iconWrap, { backgroundColor: colors.brandPrimary }]}>
              <Ionicons name="checkmark" size={40} color={colors.brandDark} />
            </View>
            <Text style={s.title}>Bem-vindo ao Premium! 🎉</Text>
            <Text style={s.sub}>
              Sua assinatura foi ativada com sucesso. Todos os recursos exclusivos estão desbloqueados.
              {premiumUntil ? `\n\nVálida até ${new Date(premiumUntil).toLocaleDateString('pt-BR')}.` : ''}
            </Text>
            <Pressable style={s.cta} onPress={() => router.replace('/(tabs)')}>
              <Text style={s.ctaTxt}>Ir para o app</Text>
            </Pressable>
          </>
        );
      case 'canceled':
        return (
          <>
            <View style={[s.iconWrap, { backgroundColor: colors.surfaceTertiary }]}>
              <Ionicons name="close" size={38} color={colors.muted} />
            </View>
            <Text style={s.title}>Pagamento cancelado</Text>
            <Text style={s.sub}>Você pode tentar novamente a qualquer momento.</Text>
            <Pressable style={s.cta} onPress={() => router.replace('/paywall')}>
              <Text style={s.ctaTxt}>Voltar ao paywall</Text>
            </Pressable>
            <Pressable onPress={() => router.replace('/(tabs)')}>
              <Text style={s.ghostBtn}>Continuar no plano grátis</Text>
            </Pressable>
          </>
        );
      case 'expired':
        return (
          <>
            <View style={[s.iconWrap, { backgroundColor: colors.surfaceTertiary }]}>
              <Ionicons name="time-outline" size={38} color={colors.muted} />
            </View>
            <Text style={s.title}>Sessão expirada</Text>
            <Text style={s.sub}>A sessão de pagamento expirou. Tente novamente.</Text>
            <Pressable style={s.cta} onPress={() => router.replace('/paywall')}>
              <Text style={s.ctaTxt}>Voltar ao paywall</Text>
            </Pressable>
          </>
        );
      case 'timeout':
        return (
          <>
            <View style={[s.iconWrap, { backgroundColor: colors.tintButter }]}>
              <Ionicons name="information-circle" size={38} color={colors.brandDark} />
            </View>
            <Text style={s.title}>Ainda processando…</Text>
            <Text style={s.sub}>Seu pagamento pode levar alguns minutos. Se já pagou, ele será liberado em breve.</Text>
            <Pressable style={s.cta} onPress={() => router.replace('/(tabs)')}>
              <Text style={s.ctaTxt}>Continuar no app</Text>
            </Pressable>
          </>
        );
      case 'error':
      default:
        return (
          <>
            <View style={[s.iconWrap, { backgroundColor: colors.surfaceTertiary }]}>
              <Ionicons name="alert-circle" size={38} color={colors.error} />
            </View>
            <Text style={s.title}>Erro ao verificar pagamento</Text>
            <Text style={s.sub}>Tente novamente ou entre em contato conosco.</Text>
            <Pressable style={s.cta} onPress={() => router.replace('/paywall')}>
              <Text style={s.ctaTxt}>Voltar</Text>
            </Pressable>
          </>
        );
    }
  })();

  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.center}>
          {content}
        </View>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  iconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, ...shadow.card },
  title: { ...typography.title, color: colors.onSurface, textAlign: 'center', fontSize: 22 },
  sub: { ...typography.body, color: colors.muted, textAlign: 'center', paddingHorizontal: spacing.md, lineHeight: 22 },
  cta: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  ctaTxt: { ...typography.bodyStrong, color: colors.brandDark, fontSize: 16 },
  ghostBtn: { ...typography.body, color: colors.muted, textDecorationLine: 'underline', marginTop: spacing.sm },
});
