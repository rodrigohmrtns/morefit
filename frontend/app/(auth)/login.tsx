import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/src/contexts/AuthContext';
import { colors, radius, spacing, typography } from '@/src/theme';

export default function Login() {
  const router = useRouter();
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email || !password) { setError('Preencha e-mail e senha'); return; }
    setLoading(true);
    try { await login(email.trim(), password); router.replace('/'); }
    catch (e: any) { setError(e?.message || 'Falha ao entrar'); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.back} testID="login-back-button">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>

          <Text style={styles.title}>Bem-vindo{'\n'}de volta</Text>
          <Text style={styles.sub}>Entre para acompanhar sua jornada.</Text>

          <View style={styles.form}>
            <Field
              testID="login-email-input"
              icon="mail-outline" placeholder="E-mail" value={email}
              onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
            />
            <Field
              testID="login-password-input"
              icon="lock-closed-outline" placeholder="Senha" value={password}
              onChangeText={setPassword} secureTextEntry={!showPw}
              right={
                <Pressable onPress={() => setShowPw(v => !v)} hitSlop={12}>
                  <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
                </Pressable>
              }
            />
            {error && <Text style={styles.error} testID="login-error">{error}</Text>}

            <Pressable
              testID="login-submit-button"
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
              onPress={submit}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>Entrar</Text>}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} /><Text style={styles.dividerTxt}>ou</Text><View style={styles.divider} />
            </View>

            <Pressable
              testID="login-google-button"
              style={styles.googleBtn}
              onPress={async () => { try { await loginWithGoogle(); } catch (e: any) { setError(e?.message); } }}
            >
              <Ionicons name="logo-google" size={20} color={colors.onSurface} />
              <Text style={styles.googleTxt}>Entrar com Google</Text>
            </Pressable>

            <Pressable onPress={() => router.push('/(auth)/register')} style={{ alignItems: 'center', marginTop: spacing.lg }} testID="login-goto-register">
              <Text style={styles.link}>Não tem conta? <Text style={{ color: colors.brandPrimary, fontWeight: '700' }}>Cadastre-se</Text></Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  icon, placeholder, value, onChangeText, secureTextEntry, autoCapitalize, keyboardType, right, testID,
}: any) {
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={20} color={colors.muted} />
      <TextInput
        testID={testID}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
      />
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  title: { ...typography.displayLarge, color: colors.onSurface, marginTop: spacing.md },
  sub: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: spacing.sm, marginBottom: spacing.xl },
  form: { gap: spacing.md },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, height: 56, borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, ...typography.body, color: colors.onSurface },
  primaryBtn: {
    backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm,
  },
  primaryTxt: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.md },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerTxt: { color: colors.muted, ...typography.caption },
  googleBtn: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.pill, paddingVertical: 16,
  },
  googleTxt: { color: colors.onSurface, fontSize: 16, fontWeight: '700' },
  link: { ...typography.body, color: colors.onSurfaceSecondary },
  error: { color: colors.error, ...typography.caption, marginTop: -spacing.xs },
});
