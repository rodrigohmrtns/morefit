import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/src/contexts/AuthContext';
import { colors, radius, spacing, typography } from '@/src/theme';

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const rows: { icon: any; label: string; value?: string }[] = [
    { icon: 'flame', label: 'Meta de calorias', value: `${user?.daily_calorie_goal ?? 2000} kcal` },
    { icon: 'water', label: 'Meta de água', value: `${user?.daily_water_ml_goal ?? 2000} ml` },
    { icon: 'footsteps', label: 'Meta de passos', value: `${user?.daily_steps_goal ?? 8000}` },
    { icon: 'scale', label: 'Peso meta', value: user?.goal_weight_kg ? `${user.goal_weight_kg} kg` : '—' },
    { icon: 'resize', label: 'Altura', value: user?.height_cm ? `${user.height_cm} cm` : '—' },
    { icon: 'fitness', label: 'Objetivo', value: user?.goal === 'lose' ? 'Perder peso' : user?.goal === 'gain' ? 'Ganhar massa' : 'Manter peso' },
  ];

  return (
    <View style={styles.root} testID="profile-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={styles.header}>
          <Text style={styles.title}>Perfil</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Identity */}
        <View style={styles.identity}>
          <View style={styles.avatarBig}>
            <Text style={styles.avatarTxt}>{(user?.name?.[0] ?? 'V').toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.providerBadge}>
            <Ionicons name={user?.auth_provider === 'google' ? 'logo-google' : 'mail'} size={12} color={colors.brandDark} />
            <Text style={styles.providerTxt}>
              {user?.auth_provider === 'google' ? 'Google' : 'E-mail'}
            </Text>
          </View>
        </View>

        {/* Goals section */}
        <Text style={styles.sectionLabel}>Metas & Medidas</Text>
        <View style={styles.card}>
          {rows.map((r, i) => (
            <View key={r.label} style={[styles.row, i < rows.length - 1 && styles.rowBorder]}>
              <View style={styles.rowIcon}><Ionicons name={r.icon} size={18} color={colors.brandPrimary} /></View>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={styles.rowValue}>{r.value}</Text>
            </View>
          ))}
        </View>

        {/* Update setup */}
        <Pressable style={styles.linkRow} onPress={() => router.push('/(auth)/setup')} testID="profile-edit-goals">
          <Ionicons name="create-outline" size={20} color={colors.brandPrimary} />
          <Text style={styles.linkTxt}>Editar metas</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} style={{ marginLeft: 'auto' }} />
        </Pressable>

        {/* Sessions & Security section */}
        <Text style={styles.sectionLabel}>Segurança</Text>
        <View style={styles.card}>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowIcon}><Ionicons name="finger-print" size={18} color={colors.brandPrimary} /></View>
            <Text style={styles.rowLabel}>Biometria</Text>
            <Text style={styles.rowValue}>Em breve</Text>
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowIcon}><Ionicons name="shield-checkmark" size={18} color={colors.brandPrimary} /></View>
            <Text style={styles.rowLabel}>Autenticação 2FA</Text>
            <Text style={styles.rowValue}>Em breve</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.rowIcon}><Ionicons name="phone-portrait" size={18} color={colors.brandPrimary} /></View>
            <Text style={styles.rowLabel}>Dispositivos conectados</Text>
            <Text style={styles.rowValue}>1</Text>
          </View>
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutBtn} onPress={logout} testID="profile-logout-button">
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutTxt}>Sair da conta</Text>
        </Pressable>

        <Text style={styles.footer}>VitaTracker v1.0 • Feito com 💚 no Brasil</Text>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  title: { ...typography.displayMedium, color: colors.onSurface },
  content: { paddingHorizontal: spacing.xl, gap: spacing.md },
  identity: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.xs },
  avatarBig: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  avatarTxt: { color: '#fff', fontSize: 32, fontWeight: '700' },
  name: { ...typography.title, color: colors.onSurface },
  email: { ...typography.caption, color: colors.muted },
  providerBadge: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, marginTop: spacing.xs },
  providerTxt: { ...typography.small, color: colors.brandDark, fontWeight: '700' },
  sectionLabel: { ...typography.caption, color: colors.muted, marginLeft: spacing.md, marginTop: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, ...typography.body, color: colors.onSurface },
  rowValue: { ...typography.bodyStrong, color: colors.onSurfaceSecondary },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  linkTxt: { ...typography.body, color: colors.onSurface, fontWeight: '600' },
  logoutBtn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: '#FEECEC', borderRadius: radius.md, marginTop: spacing.md },
  logoutTxt: { color: colors.error, fontWeight: '700', ...typography.body },
  footer: { textAlign: 'center', ...typography.small, color: colors.muted, marginTop: spacing.lg },
});
