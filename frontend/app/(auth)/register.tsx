import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/src/contexts/AuthContext';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

export default function Register() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name || !email || !password) { setError('Preencha todos os campos'); return; }
    if (password.length < 6) { setError('Senha precisa ter pelo menos 6 caracteres'); return; }
    setLoading(true);
    try { await register(name.trim(), email.trim(), password); router.replace('/(auth)/setup'); }
    catch (e: any) { setError(e?.message || 'Falha ao cadastrar'); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={s.back} testID="register-back-button">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>

          <Text style={s.title}>Criar conta</Text>
          <Text style={s.sub}>Leva menos de 1 minuto.</Text>

          <View style={s.form}>
            <Field colors={colors} icon="person-outline" placeholder="Seu nome" value={name} onChangeText={setName} testID="register-name-input" />
            <Field colors={colors} icon="mail-outline" placeholder="E-mail" value={email} onChangeText={setEmail}
              autoCapitalize="none" keyboardType="email-address" testID="register-email-input" />
            <Field colors={colors} icon="lock-closed-outline" placeholder="Senha (mín. 6 caracteres)" value={password}
              onChangeText={setPassword} secureTextEntry={!showPw} testID="register-password-input"
              right={<Pressable onPress={() => setShowPw(v => !v)} hitSlop={12}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
              </Pressable>} />
            {error && <Text style={s.error} testID="register-error">{error}</Text>}

            <Pressable
              testID="register-submit-button"
              style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.9 }]}
              onPress={submit}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.primaryTxt}>Criar conta</Text>}
            </Pressable>

            <Text style={s.terms}>Ao continuar, você concorda com nossos Termos e Política de Privacidade.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ colors, icon, placeholder, value, onChangeText, secureTextEntry, autoCapitalize, keyboardType, right, testID }: any) {
  const s = makeStyles(colors);
  return (
    <View style={s.field}>
      <Ionicons name={icon} size={20} color={colors.muted} />
      <TextInput
        testID={testID}
        style={s.input}
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

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
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
  terms: { ...typography.small, color: colors.muted, textAlign: 'center', marginTop: spacing.md, lineHeight: 18 },
  error: { color: colors.error, ...typography.caption, marginTop: -spacing.xs },
});
