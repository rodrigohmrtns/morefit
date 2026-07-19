import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

import { useAuth } from '@/src/contexts/AuthContext';
import { colors, radius, spacing, typography } from '@/src/theme';

const HERO = 'https://images.pexels.com/photos/7130464/pexels-photo-7130464.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1200&w=900';

export default function Onboarding() {
  const router = useRouter();
  const { loginWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  const onGoogle = async () => {
    try { setGoogleLoading(true); await loginWithGoogle(); }
    catch (e: any) { console.log('google err', e?.message); }
    finally { setGoogleLoading(false); }
  };

  return (
    <View style={styles.root} testID="onboarding-screen">
      <Image source={HERO} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={400} />
      <LinearGradient
        colors={['rgba(35,38,35,0.05)', 'rgba(35,38,35,0.55)', 'rgba(35,38,35,0.92)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBrand}>
          <View style={styles.logoBadge}>
            <Ionicons name="leaf" size={22} color={colors.brandPrimary} />
          </View>
          <Text style={styles.brand}>VitaTracker</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Sua jornada de{'\n'}saúde começa aqui.</Text>
          <Text style={styles.heroSub}>
            Peso, nutrição, exercícios e bem-estar em um só lugar — com uma IA que entende sua rotina.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            testID="onboarding-google-button"
            style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.85 }]}
            onPress={onGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color={colors.onSurface} />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color={colors.onSurface} />
                <Text style={styles.googleTxt}>Continuar com Google</Text>
              </>
            )}
          </Pressable>

          <Pressable
            testID="onboarding-email-signup-button"
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
            onPress={() => router.push('/(auth)/register')}
          >
            <Ionicons name="mail" size={20} color={colors.onBrandPrimary} />
            <Text style={styles.primaryTxt}>Criar conta com E-mail</Text>
          </Pressable>

          <Pressable
            testID="onboarding-login-link"
            onPress={() => router.push('/(auth)/login')}
            style={styles.loginLink}
          >
            <Text style={styles.loginTxt}>Já tenho conta • <Text style={{ fontWeight: '700', color: '#fff' }}>Entrar</Text></Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceInverse },
  safe: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'space-between' },
  topBrand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  logoBadge: {
    width: 34, height: 34, borderRadius: radius.md, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  brand: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },
  hero: { marginBottom: spacing.xxl },
  heroTitle: { color: '#fff', fontSize: 36, fontWeight: '700', letterSpacing: -0.8, lineHeight: 42 },
  heroSub: { color: 'rgba(255,255,255,0.85)', ...typography.body, marginTop: spacing.md, lineHeight: 22 },
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
  googleTxt: { color: colors.onSurface, fontSize: 16, fontWeight: '700' },
  loginLink: { alignItems: 'center', marginTop: spacing.sm, paddingVertical: spacing.sm },
  loginTxt: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
});
