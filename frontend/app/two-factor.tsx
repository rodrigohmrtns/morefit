import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Status = { enabled: boolean; mandatory: boolean; pending: boolean; backup_codes_remaining: number };

type SetupData = { qr_data_url: string; manual_secret: string; backup_codes: string[]; issuer: string };

/**
 * Two-factor management screen.
 * - If 2FA is off: renders "Ativar 2FA" flow (QR + backup codes + verify code).
 * - If 2FA is on : renders status card + regenerate backup + disable buttons.
 */
export default function TwoFactorManage() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [status, setStatus] = useState<Status | null>(null);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCodes, setSavedCodes] = useState(false);

  const loadStatus = async () => {
    try {
      const st = await api<Status>('/auth/2fa/status');
      setStatus(st);
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const startSetup = async () => {
    setBusy(true); setError(null);
    try {
      const data = await api<SetupData>('/auth/2fa/setup', { method: 'POST' });
      setSetupData(data);
    } catch (e: any) {
      setError(e?.message || 'Erro ao iniciar configuração');
    } finally {
      setBusy(false);
    }
  };

  const finishSetup = async () => {
    if (code.length !== 6) { setError('Digite os 6 dígitos'); return; }
    setBusy(true); setError(null);
    try {
      await api('/auth/2fa/enable', { method: 'POST', body: { code } });
      setSetupData(null);
      setCode('');
      setSavedCodes(false);
      Alert.alert('2FA ativado ✅', 'Sua conta agora está protegida com verificação em 2 etapas.');
      await loadStatus();
    } catch (e: any) {
      setError(e?.message || 'Código inválido');
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    Alert.alert('Gerar novos códigos?', 'Os códigos antigos deixarão de funcionar imediatamente.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Gerar', style: 'destructive',
        onPress: async () => {
          setBusy(true); setError(null);
          try {
            const r = await api<{ backup_codes: string[] }>('/auth/2fa/backup-codes/regenerate', { method: 'POST' });
            // Show the codes in a temporary "setupData-like" view for copy
            setSetupData({ qr_data_url: '', manual_secret: '', backup_codes: r.backup_codes, issuer: 'MoreFit' });
            setSavedCodes(false);
          } catch (e: any) { setError(e?.message); }
          finally { setBusy(false); }
        },
      },
    ]);
  };

  const disable = () => {
    if (status?.mandatory) {
      Alert.alert('2FA obrigatório', 'Esta função (profissional/admin) exige 2FA e não pode ser desativada.');
      return;
    }
    Alert.alert(
      'Desativar 2FA?',
      'Sua conta ficará menos protegida. Você precisará da senha atual e de um código válido.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar', style: 'destructive',
          onPress: () => router.push('/two-factor-disable'),
        },
      ],
    );
  };

  const copyCodes = async () => {
    if (!setupData?.backup_codes.length) return;
    await Clipboard.setStringAsync(setupData.backup_codes.join('\n'));
    setSavedCodes(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <View style={s.centered}><ActivityIndicator color={colors.brandPrimary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={s.back} testID="2fa-manage-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>

          <Text style={s.title}>Verificação em 2 etapas</Text>
          <Text style={s.sub}>Proteja sua conta com um app autenticador (Google Authenticator, Authy, 1Password…).</Text>

          {/* Setup mode --------------------------------------------------- */}
          {setupData ? (
            <View style={{ gap: spacing.lg }}>
              {setupData.qr_data_url ? (
                <>
                  <Text style={s.h3}>1. Escaneie o QR Code</Text>
                  <View style={s.qrBox}>
                    <Image source={{ uri: setupData.qr_data_url }} style={s.qr} resizeMode="contain" />
                  </View>
                  <Text style={s.mono}>Ou digite o segredo:{'\n'}{setupData.manual_secret}</Text>
                </>
              ) : null}

              <Text style={s.h3}>{setupData.qr_data_url ? '2. ' : ''}Códigos de recuperação</Text>
              <Text style={s.sub}>
                Guarde estes códigos em local seguro (senha, cofre físico). Cada um funciona uma única vez se você
                perder o app autenticador.
              </Text>
              <View style={s.backupBox}>
                {setupData.backup_codes.map((c) => (
                  <Text key={c} style={s.backupCode}>{c}</Text>
                ))}
              </View>
              <Pressable onPress={copyCodes} style={[s.ghostBtn, savedCodes && { borderColor: colors.brandPrimary }]}>
                <Ionicons name={savedCodes ? 'checkmark-circle' : 'copy-outline'} size={18}
                  color={savedCodes ? colors.brandPrimary : colors.onSurface} />
                <Text style={[s.ghostTxt, savedCodes && { color: colors.brandPrimary }]}>
                  {savedCodes ? 'Copiado — guarde bem!' : 'Copiar todos os códigos'}
                </Text>
              </Pressable>

              {setupData.qr_data_url ? (
                <>
                  <Text style={s.h3}>3. Digite o código do app</Text>
                  <TextInput
                    style={[s.field, s.codeInput]}
                    value={code}
                    onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    maxLength={6}
                    testID="2fa-manage-code-input"
                  />
                  {error && <Text style={s.error}>{error}</Text>}
                  <Pressable style={[s.primaryBtn, (busy || !savedCodes) && { opacity: 0.5 }]}
                    onPress={finishSetup} disabled={busy || !savedCodes}
                    testID="2fa-manage-enable-btn">
                    {busy ? <ActivityIndicator color={colors.onBrandPrimary} />
                      : <Text style={s.primaryTxt}>{savedCodes ? 'Ativar 2FA' : 'Copie os códigos primeiro'}</Text>}
                  </Pressable>
                </>
              ) : (
                <Pressable style={s.primaryBtn} onPress={() => setSetupData(null)}>
                  <Text style={s.primaryTxt}>Concluído</Text>
                </Pressable>
              )}
            </View>
          ) : status?.enabled ? (
            /* Enabled ---------------------------------------------------- */
            <View style={{ gap: spacing.lg }}>
              <View style={s.statusCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons name="shield-checkmark" size={24} color={colors.brandPrimary} />
                  <Text style={s.h3}>2FA ativo</Text>
                </View>
                <Text style={s.sub}>
                  {status.backup_codes_remaining} códigos de recuperação restantes.
                  {status.mandatory ? '\n\n⚠️ Sua função exige 2FA — não pode ser desativado.' : ''}
                </Text>
              </View>

              <Pressable style={s.ghostBtn} onPress={regenerate} disabled={busy}
                testID="2fa-manage-regen-btn">
                <Ionicons name="refresh" size={18} color={colors.onSurface} />
                <Text style={s.ghostTxt}>Gerar novos códigos de recuperação</Text>
              </Pressable>

              {!status.mandatory && (
                <Pressable style={[s.ghostBtn, { borderColor: colors.error }]} onPress={disable}
                  testID="2fa-manage-disable-btn">
                  <Ionicons name="shield-outline" size={18} color={colors.error} />
                  <Text style={[s.ghostTxt, { color: colors.error }]}>Desativar 2FA</Text>
                </Pressable>
              )}
            </View>
          ) : (
            /* Disabled --------------------------------------------------- */
            <View style={{ gap: spacing.lg }}>
              <View style={s.statusCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons name="shield-outline" size={24} color={colors.onSurfaceSecondary} />
                  <Text style={s.h3}>2FA desativado</Text>
                </View>
                <Text style={s.sub}>
                  Adicione uma camada extra de segurança à sua conta. Recomendamos fortemente ativar 2FA — leva 2
                  minutos.
                </Text>
              </View>
              {error && <Text style={s.error}>{error}</Text>}
              <Pressable style={s.primaryBtn} onPress={startSetup} disabled={busy}
                testID="2fa-manage-start-btn">
                {busy ? <ActivityIndicator color={colors.onBrandPrimary} />
                  : <Text style={s.primaryTxt}>Ativar 2FA</Text>}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  title: { ...typography.displayLarge, color: colors.onSurface, marginTop: spacing.sm },
  sub: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: spacing.sm },
  h3: { ...typography.title, color: colors.onSurface },
  statusCard: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border,
    marginTop: spacing.lg,
  },
  qrBox: {
    alignItems: 'center', padding: spacing.lg,
    backgroundColor: '#FFFFFF', borderRadius: radius.lg,
  },
  qr: { width: 220, height: 220 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: colors.onSurfaceSecondary, textAlign: 'center' },
  backupBox: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    padding: spacing.lg, gap: 4, borderWidth: 1, borderColor: colors.border,
  },
  backupCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.onSurface, fontSize: 15,
    letterSpacing: 2, textAlign: 'center',
  },
  field: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, height: 56, borderWidth: 1, borderColor: colors.border,
    color: colors.onSurface,
  },
  codeInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: '600' },
  primaryBtn: {
    backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryTxt: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: '700' },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: spacing.lg,
  },
  ghostTxt: { color: colors.onSurface, fontSize: 15, fontWeight: '600' },
  error: { color: colors.error, ...typography.caption },
});
