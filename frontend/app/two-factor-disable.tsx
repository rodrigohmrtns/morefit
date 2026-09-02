import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

/**
 * Confirmation flow for disabling 2FA.
 * Requires the current password AND a valid TOTP (or backup) code.
 */
export default function TwoFactorDisable() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!password || !code) { setError('Preencha senha e código'); return; }
    setBusy(true);
    try {
      await api('/auth/2fa/disable', { method: 'POST', body: { password, code } });
      Alert.alert('2FA desativado', 'Sua conta não usa mais verificação em 2 etapas.', [
        { text: 'OK', onPress: () => router.replace('/two-factor') },
      ]);
    } catch (e: any) {
      setError(e?.message || 'Falha ao desativar 2FA');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={s.back}>
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title}>Desativar 2FA</Text>
          <Text style={s.sub}>
            Confirme sua identidade antes de remover a verificação em 2 etapas.
          </Text>

          <View style={s.form}>
            <View style={s.field}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.muted} />
              <TextInput style={s.input} value={password} onChangeText={setPassword}
                placeholder="Senha atual" placeholderTextColor={colors.muted}
                secureTextEntry testID="2fa-disable-password" />
            </View>
            <View style={s.field}>
              <Ionicons name="key-outline" size={20} color={colors.muted} />
              <TextInput style={s.input} value={code} onChangeText={setCode}
                placeholder="Código do app ou de recuperação" placeholderTextColor={colors.muted}
                autoCapitalize="characters" testID="2fa-disable-code" />
            </View>
            {error && <Text style={s.error}>{error}</Text>}
            <Pressable style={[s.dangerBtn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}
              testID="2fa-disable-submit">
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.dangerTxt}>Desativar 2FA</Text>}
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
  title: { ...typography.displayLarge, color: colors.onSurface, marginTop: spacing.sm },
  sub: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: spacing.sm, marginBottom: spacing.xl },
  form: { gap: spacing.md },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, height: 56, borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, ...typography.body, color: colors.onSurface },
  dangerBtn: {
    backgroundColor: colors.error, borderRadius: radius.pill, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm,
  },
  dangerTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { color: colors.error, ...typography.caption },
});
