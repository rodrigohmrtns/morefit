import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/src/contexts/AuthContext';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

/**
 * Two-factor verification screen.
 * Receives `challengeId` and `email` via router params (from /login).
 * Accepts either a 6-digit TOTP code or a backup recovery code.
 */
export default function TwoFactor() {
  const router = useRouter();
  const { challengeId, email } = useLocalSearchParams<{ challengeId: string; email?: string }>();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { verify2FA } = useAuth();
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(300);

  useEffect(() => {
    // Countdown for challenge expiry
    const t = setInterval(() => setSecondsLeft((v) => Math.max(0, v - 1)), 1000);
    // Auto-focus input on mount
    const f = setTimeout(() => inputRef.current?.focus(), 200);
    return () => { clearInterval(t); clearTimeout(f); };
  }, []);

  const submit = async (raw: string) => {
    setError(null);
    const trimmed = raw.replace(/\s+/g, '');
    if (!challengeId) { setError('Sessão de verificação inválida'); return; }
    if (!trimmed) { setError('Digite o código'); return; }
    setLoading(true);
    try {
      await verify2FA(String(challengeId), trimmed);
      router.replace('/');
    } catch (e: any) {
      setError(e?.message || 'Código inválido');
      setCode('');
      setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  const onChange = (v: string) => {
    if (useBackup) {
      setCode(v.toUpperCase().slice(0, 24));
      return;
    }
    const digits = v.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) submit(digits);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={s.back} testID="2fa-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>

          <View style={s.icon}>
            <Ionicons name="shield-checkmark" size={36} color={colors.brandPrimary} />
          </View>

          <Text style={s.title}>Verificação em 2 etapas</Text>
          <Text style={s.sub}>
            {useBackup
              ? 'Digite um dos códigos de recuperação que você guardou.'
              : `Abra o Google Authenticator${email ? ` para ${email}` : ''} e digite o código de 6 dígitos.`}
          </Text>

          <View style={s.form}>
            <View style={s.field}>
              <Ionicons name={useBackup ? 'key-outline' : 'time-outline'} size={20} color={colors.muted} />
              <TextInput
                ref={inputRef}
                testID="2fa-code-input"
                style={s.input}
                value={code}
                onChangeText={onChange}
                placeholder={useBackup ? 'XXXX-XXXX-XXXX' : '123456'}
                placeholderTextColor={colors.muted}
                keyboardType={useBackup ? 'default' : 'number-pad'}
                autoCapitalize={useBackup ? 'characters' : 'none'}
                autoCorrect={false}
                maxLength={useBackup ? 24 : 6}
              />
            </View>
            {error && <Text style={s.error} testID="2fa-error">{error}</Text>}
            <Text style={s.timer}>
              Código expira em <Text style={{ fontWeight: '700' }}>{mm}:{ss}</Text>
            </Text>

            <Pressable
              testID="2fa-submit"
              style={({ pressed }) => [s.primaryBtn, (pressed || loading) && { opacity: 0.9 }]}
              onPress={() => submit(code)}
              disabled={loading || !code}
            >
              {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.primaryTxt}>Verificar</Text>}
            </Pressable>

            <Pressable onPress={() => { setCode(''); setUseBackup((v) => !v); setError(null); }}
              style={{ alignItems: 'center', marginTop: spacing.lg }}>
              <Text style={s.link}>
                {useBackup ? 'Voltar para código do app' : 'Perdi o acesso — usar código de recuperação'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  icon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.md, marginBottom: spacing.md,
  },
  title: { ...typography.displayLarge, color: colors.onSurface, marginTop: spacing.sm },
  sub: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: spacing.sm, marginBottom: spacing.xl },
  form: { gap: spacing.md },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, height: 56, borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, ...typography.body, color: colors.onSurface, letterSpacing: 4, fontSize: 20, fontWeight: '600' },
  timer: { ...typography.caption, color: colors.onSurfaceSecondary, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm,
  },
  primaryTxt: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: '700' },
  link: { ...typography.body, color: colors.brandPrimary, fontWeight: '600' },
  error: { color: colors.error, ...typography.caption, marginTop: -spacing.xs },
});
