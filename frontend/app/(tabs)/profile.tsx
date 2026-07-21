import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/src/contexts/AuthContext';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

const GOAL_LABEL: Record<string, string> = {
  lose: 'Perder peso', maintain: 'Manter peso', gain: 'Ganhar massa', improve_health: 'Melhorar saúde',
};

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { colors, mode, setMode } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const rows: { icon: any; label: string; value?: string }[] = [
    { icon: 'flame', label: 'Meta de calorias', value: `${user?.daily_calorie_goal ?? 2000} kcal` },
    { icon: 'water', label: 'Meta de água', value: `${user?.daily_water_ml_goal ?? 2000} ml` },
    { icon: 'footsteps', label: 'Meta de passos', value: `${user?.daily_steps_goal ?? 8000}` },
    { icon: 'scale', label: 'Peso meta', value: user?.goal_weight_kg ? `${user.goal_weight_kg} kg` : '—' },
    { icon: 'resize', label: 'Altura', value: user?.height_cm ? `${user.height_cm} cm` : '—' },
    { icon: 'fitness', label: 'Objetivo', value: user?.goal ? GOAL_LABEL[user.goal] : '—' },
  ];

  return (
    <View style={s.root} testID="profile-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Text style={s.title}>Perfil</Text>
          <Pressable style={s.editIcon} onPress={() => router.push('/profile-edit')} testID="profile-edit-header">
            <Ionicons name="create-outline" size={22} color={colors.onSurface} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.identity}>
          <Pressable style={s.avatarBig} onPress={() => router.push('/profile-edit')} testID="profile-avatar-edit">
            {user?.photo_base64 ? (
              <Image source={{ uri: `data:image/jpeg;base64,${user.photo_base64}` }} style={s.avatarImg} contentFit="cover" />
            ) : (
              <Text style={s.avatarTxt}>{(user?.name?.[0] ?? 'V').toUpperCase()}</Text>
            )}
            <View style={s.avatarBadge}>
              <Ionicons name="camera" size={12} color={colors.onBrandPrimary} />
            </View>
          </Pressable>
          <Text style={s.name}>{user?.name}</Text>
          <Text style={s.email}>{user?.email}</Text>
          <View style={s.providerBadge}>
            <Ionicons name={user?.auth_provider === 'google' ? 'logo-google' : 'mail'} size={12} color={colors.brandDark} />
            <Text style={s.providerTxt}>{user?.auth_provider === 'google' ? 'Google' : 'E-mail'}</Text>
          </View>
        </View>

        <Text style={s.sectionLabel}>Aparência</Text>
        <View style={s.card}>
          <View style={s.themeRow}>
            {(['light', 'dark', 'system'] as const).map(m => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[s.themeChip, mode === m && s.themeChipActive]}
                testID={`profile-theme-${m}`}
              >
                <Ionicons
                  name={m === 'light' ? 'sunny' : m === 'dark' ? 'moon' : 'phone-portrait'}
                  size={16}
                  color={mode === m ? colors.onBrandPrimary : colors.onSurface}
                />
                <Text style={[s.themeChipTxt, mode === m && { color: colors.onBrandPrimary, fontWeight: '700' }]}>
                  {m === 'light' ? 'Claro' : m === 'dark' ? 'Escuro' : 'Sistema'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={s.sectionLabel}>Metas & Medidas</Text>
        <View style={s.card}>
          {rows.map((r, i) => (
            <View key={r.label} style={[s.row, i < rows.length - 1 && s.rowBorder]}>
              <View style={s.rowIcon}><Ionicons name={r.icon} size={18} color={colors.brandDark} /></View>
              <Text style={s.rowLabel}>{r.label}</Text>
              <Text style={s.rowValue}>{r.value}</Text>
            </View>
          ))}
        </View>

        <Pressable style={s.linkRow} onPress={() => router.push('/profile-edit')} testID="profile-edit-goals">
          <Ionicons name="create-outline" size={20} color={colors.brandDark} />
          <Text style={s.linkTxt}>Editar perfil e metas</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} style={{ marginLeft: 'auto' }} />
        </Pressable>

        <Pressable
          style={[s.premiumCta, user?.is_premium && s.premiumCtaActive]}
          onPress={() => router.push('/paywall')}
          testID="profile-premium-cta"
        >
          <View style={s.premiumIcon}>
            <Ionicons name="diamond" size={22} color={colors.brandDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.premiumTitle}>{user?.is_premium ? 'Você é Premium ✨' : 'Desbloqueie o Premium'}</Text>
            <Text style={s.premiumSub}>
              {user?.is_premium
                ? `Ativo até ${user.premium_expires_at ? new Date(user.premium_expires_at).toLocaleDateString('pt-BR') : '—'}`
                : 'IA Coach, Scanner por foto e relatórios PDF'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.brandDark} />
        </Pressable>

        <Text style={s.sectionLabel}>Segurança</Text>
        <View style={s.card}>
          <Pressable onPress={() => router.push('/privacy')} testID="profile-privacy-cta">
            <View style={[s.row, s.rowBorder]}>
              <View style={s.rowIcon}><Ionicons name="shield-checkmark" size={18} color={colors.brandDark} /></View>
              <Text style={s.rowLabel}>Privacidade & LGPD</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </View>
          </Pressable>
          <Pressable onPress={() => router.push('/notifications-settings')} testID="profile-notifications-cta">
            <View style={[s.row, s.rowBorder]}>
              <View style={s.rowIcon}><Ionicons name="notifications" size={18} color={colors.brandDark} /></View>
              <Text style={s.rowLabel}>Lembretes & Notificações</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </View>
          </Pressable>
          {user?.role === 'super_admin' && (
            <Pressable onPress={() => router.push('/admin')} testID="profile-admin-cta">
              <View style={[s.row, s.rowBorder]}>
                <View style={[s.rowIcon, { backgroundColor: colors.brandDark }]}><Ionicons name="ribbon" size={18} color={colors.brandPrimary} /></View>
                <Text style={s.rowLabel}>Painel Super Admin</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </View>
            </Pressable>
          )}
          <SecurityRow colors={colors} icon="finger-print" label="Biometria" value="Em breve" />
          <SecurityRow colors={colors} icon="shield-checkmark" label="Autenticação 2FA" value="Em breve" border={false} />
        </View>

        <Pressable style={s.logoutBtn} onPress={logout} testID="profile-logout-button">
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={s.logoutTxt}>Sair da conta</Text>
        </Pressable>

        <Text style={s.footer}>VitaTracker v1.1 • Feito com 💚 no Brasil</Text>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

function SecurityRow({ colors, icon, label, value, border = true }: any) {
  const s = makeStyles(colors);
  return (
    <View style={[s.row, border && s.rowBorder]}>
      <View style={s.rowIcon}><Ionicons name={icon} size={18} color={colors.brandDark} /></View>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.displayMedium, color: colors.onSurface },
  editIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  content: { paddingHorizontal: spacing.xl, gap: spacing.md },
  identity: { alignItems: 'center', paddingVertical: spacing.lg, gap: 4 },
  avatarBig: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, overflow: 'visible' },
  avatarImg: { width: '100%', height: '100%', borderRadius: 48 },
  avatarTxt: { color: colors.onBrandPrimary, fontSize: 38, fontWeight: '700' },
  avatarBadge: { position: 'absolute', right: 0, bottom: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandDark, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  name: { ...typography.title, color: colors.onSurface },
  email: { ...typography.caption, color: colors.muted },
  providerBadge: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, marginTop: spacing.xs },
  providerTxt: { ...typography.small, color: colors.brandDark, fontWeight: '700' },
  sectionLabel: { ...typography.caption, color: colors.muted, marginLeft: spacing.md, marginTop: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, ...typography.body, color: colors.onSurface },
  rowValue: { ...typography.bodyStrong, color: colors.onSurfaceSecondary },
  themeRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  themeChip: { flex: 1, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm + 2, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  themeChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  themeChipTxt: { ...typography.caption, color: colors.onSurface },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.brandPrimary, borderRadius: radius.md },
  linkTxt: { ...typography.body, color: colors.brandDark, fontWeight: '700' },
  premiumCta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.tintButter, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  premiumCtaActive: { backgroundColor: colors.brandTertiary },
  premiumIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  premiumTitle: { ...typography.bodyStrong, color: colors.onTint, fontSize: 14 },
  premiumSub: { ...typography.small, color: colors.onTint, opacity: 0.75, marginTop: 2 },
  logoutBtn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginTop: spacing.md },
  logoutTxt: { color: colors.error, fontWeight: '700', ...typography.body },
  footer: { textAlign: 'center', ...typography.small, color: colors.muted, marginTop: spacing.lg },
});
