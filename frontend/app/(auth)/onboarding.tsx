import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/src/contexts/AuthContext';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

const HERO = 'https://images.pexels.com/photos/4498604/pexels-photo-4498604.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1200&w=900';

export default function Onboarding() {
  const router = useRouter();
  const { colors } = useTheme();
  const { loginWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const s = useMemo(() => makeStyles(colors), [colors]);

  const onGoogle = async () => {
    try { setGoogleLoading(true); await loginWithGoogle(); }
    catch (e: any) { console.log('google err', e?.message); }
    finally { setGoogleLoading(false); }
  };

  return (
    <View style={s.root} testID="onboarding-screen">
      <Image source={HERO} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={400} />
      <LinearGradient
        colors={['rgba(14,16,15,0.05)', 'rgba(14,16,15,0.55)', 'rgba(14,16,15,0.95)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.topBrand}>
          <View style={s.logoBadge}>
            <Ionicons name="leaf" size={20} color={colors.brandDark} />
          </View>
          <Text style={s.brand}>VitaTracker</Text>
        </View>

        <View style={s.hero}>
          <Text style={s.badge}>Saúde inteligente</Text>
          <Text style={s.heroTitle}>Sua jornada de{'\n'}saúde começa aqui.</Text>
          <Text style={s.heroSub}>
            Peso, nutrição, exercícios e bem-estar em um só lugar — com IA que entende sua rotina.
          </Text>
        </View>

        <View style={s.actions}>
          <Pressable
            testID="onboarding-google-button"
            style={({ pressed }) => [s.googleBtn, pressed && { opacity: 0.85 }]}
            onPress={onGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color="#0F1110" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#0F1110" />
                <Text style={s.googleTxt}>Continuar com Google</Text>
              </>
            )}
          </Pressable>

          <Pressable
            testID="onboarding-email-signup-button"
            style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.9 }]}
            onPress={() => router.push('/(auth)/register')}
          >
            <Ionicons name="mail" size={20} color={colors.onBrandPrimary} />
            <Text style={s.primaryTxt}>Criar conta com E-mail</Text>
          </Pressable>

          <Pressable
            testID="onboarding-login-link"
            onPress={() => router.push('/(auth)/login')}
            style={s.loginLink}
          >
            <Text style={s.loginTxt}>Já tenho conta • <Text style={{ fontWeight: '700', color: '#fff' }}>Entrar</Text></Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E100F' },
  safe: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'space-between' },
  topBrand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  logoBadge: {
    width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  brand: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },
  hero: { marginBottom: spacing.xxl, gap: spacing.md },
  badge: {
    alignSelf: 'flex-start', backgroundColor: colors.brandPrimary, color: colors.brandDark,
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill,
    ...typography.caption, fontWeight: '700', overflow: 'hidden',
  },
  heroTitle: { color: '#fff', fontSize: 40, fontWeight: '700', letterSpacing: -0.8, lineHeight: 46 },
  heroSub: { color: 'rgba(255,255,255,0.85)', ...typography.body, lineHeight: 22 },
  actions: { gap: spacing.md, marginBottom: spacing.md },
  primaryBtn: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.brandPrimary, paddingVertical: 16, borderRadius: radius.pill,
  },
  primaryTxt: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: '700' },
  googleBtn: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', paddingVertical: 16, borderRadius: radius.pill,
  },
  googleTxt: { color: '#0F1110', fontSize: 16, fontWeight: '700' },
  loginLink: { alignItems: 'center', marginTop: spacing.sm, paddingVertical: spacing.sm },
  loginTxt: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
});
