import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { BackButton } from '@/src/components/back-button';
import { useLocale } from '@/src/i18n';
import { useWearables } from '@/src/hooks/use-wearables';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';
import { haptic } from '@/src/utils/haptic';

const METRICS = [
  { id: 'steps', icon: 'footsteps', labelKey: 'home.steps' },
  { id: 'heart_rate', icon: 'heart', labelKey: 'wearables.heartRate' },
  { id: 'sleep', icon: 'moon', labelKey: 'home.sleep' },
  { id: 'weight', icon: 'scale', labelKey: 'progress.metrics.weight' },
  { id: 'active_energy', icon: 'flame', labelKey: 'wearables.activeEnergy' },
] as const;

export default function Wearables() {
  const { colors } = useTheme();
  const { t } = useLocale();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { caps, status, loading, error, syncNow } = useWearables();

  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    steps: true, heart_rate: true, sleep: true, weight: true, active_energy: true,
  });
  const [syncing, setSyncing] = useState(false);

  const toggle = (m: string) => { haptic.select(); setEnabled(v => ({ ...v, [m]: !v[m] })); };

  const doSync = async () => {
    haptic.tap();
    setSyncing(true);
    const ok = await syncNow();
    if (ok) haptic.success(); else haptic.error();
    setSyncing(false);
  };

  const sourceStatus = status?.sources && Object.entries(status.sources)[0];
  const platformName = Platform.OS === 'ios' ? 'Apple Health' : Platform.OS === 'android' ? 'Health Connect / Google Fit' : 'Web';

  return (
    <View style={s.root} testID="wearables-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <BackButton />
          <View style={{ flex: 1 }}>
            <Text style={s.title} accessibilityRole="header">{t('wearables.title')}</Text>
            <Text style={s.sub}>{t('wearables.subtitle')}</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.content}>
        {/* Capability banner */}
        {!caps.available && (
          <Animated.View entering={FadeInUp.springify().damping(14)} style={s.banner}>
            <View style={s.bannerIcon}><Ionicons name="information-circle" size={22} color={colors.brandDark} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.bannerTitle}>{t('wearables.notAvailable')}</Text>
              <Text style={s.bannerBody}>
                {caps.reason === 'web-preview' && t('wearables.reasonWeb')}
                {caps.reason === 'expo-go' && t('wearables.reasonExpoGo')}
                {caps.reason === 'missing-native-module' && t('wearables.reasonMissing')}
              </Text>
              <Text style={s.bannerHint}>{t('wearables.publishHint')}</Text>
            </View>
          </Animated.View>
        )}

        {caps.available && (
          <Animated.View entering={FadeInUp.springify().damping(14)} style={s.availBanner}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={s.availTitle}>{platformName} {t('wearables.connected')}</Text>
              <Text style={s.availBody}>{t('wearables.connectedBody')}</Text>
            </View>
          </Animated.View>
        )}

        {/* Sync status */}
        {sourceStatus && (
          <View style={s.card}>
            <Text style={s.cardLabel}>{t('wearables.lastSync')}</Text>
            <Text style={s.cardValue}>{new Date(sourceStatus[1].last_sync_at).toLocaleString()}</Text>
            <Text style={s.cardMeta}>{sourceStatus[1].total_syncs} {t('wearables.syncsTotal')}</Text>
          </View>
        )}
        {loading && <ActivityIndicator size="small" color={colors.brandPrimary} style={{ marginVertical: spacing.md }} />}
        {error && (
          <View style={s.errorBox}>
            <Ionicons name="warning" size={16} color={colors.error} />
            <Text style={s.errorTxt}>{error}</Text>
          </View>
        )}

        {/* Metric toggles */}
        <Text style={s.section}>{t('wearables.syncMetrics')}</Text>
        <View style={s.list}>
          {METRICS.map(m => (
            <View key={m.id} style={s.rowItem}>
              <View style={s.rowIcon}><Ionicons name={m.icon as any} size={18} color={colors.brandDark} /></View>
              <Text style={s.rowLabel}>{t(m.labelKey)}</Text>
              <Switch
                value={enabled[m.id]}
                onValueChange={() => toggle(m.id)}
                trackColor={{ true: colors.brandPrimary, false: colors.border }}
                thumbColor={enabled[m.id] ? colors.brandDark : colors.muted}
                accessibilityLabel={t(m.labelKey)}
                accessibilityRole="switch"
              />
            </View>
          ))}
        </View>

        {/* Sync CTA */}
        <Pressable
          style={[s.cta, (!caps.available || syncing) && { opacity: 0.5 }]}
          onPress={doSync}
          disabled={!caps.available || syncing}
          testID="wearables-sync-btn"
          accessibilityRole="button"
          accessibilityLabel={t('wearables.syncNow')}
        >
          {syncing ? (
            <ActivityIndicator size="small" color={colors.brandDark} />
          ) : (
            <Ionicons name="sync" size={18} color={colors.brandDark} />
          )}
          <Text style={s.ctaTxt}>{t('wearables.syncNow')}</Text>
        </Pressable>

        <Text style={s.footNote}>{t('wearables.footNote')}</Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  title: { ...typography.title, color: colors.onSurface },
  sub: { ...typography.small, color: colors.muted, marginTop: 2 },
  content: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxl * 2 },

  banner: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', backgroundColor: colors.tintPeach, padding: spacing.md, borderRadius: radius.lg },
  bannerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { ...typography.bodyStrong, color: colors.onTint },
  bannerBody: { ...typography.small, color: colors.onTint, marginTop: 4, opacity: 0.85 },
  bannerHint: { ...typography.small, color: colors.onTint, marginTop: 6, fontWeight: '700' },

  availBanner: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.tintMint, padding: spacing.md, borderRadius: radius.lg },
  availTitle: { ...typography.bodyStrong, color: colors.onTint },
  availBody: { ...typography.small, color: colors.onTint, opacity: 0.85, marginTop: 2 },

  card: { backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  cardLabel: { ...typography.small, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardValue: { ...typography.bodyStrong, color: colors.onSurface, marginTop: 4 },
  cardMeta: { ...typography.small, color: colors.muted, marginTop: 2 },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(224,90,95,0.12)', padding: spacing.md, borderRadius: radius.md },
  errorTxt: { flex: 1, ...typography.caption, color: colors.error },

  section: { ...typography.caption, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.xs },

  list: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  rowItem: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, ...typography.body, color: colors.onSurface },

  cta: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md + 2, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, marginTop: spacing.md },
  ctaTxt: { ...typography.bodyStrong, color: colors.brandDark },

  footNote: { ...typography.small, color: colors.muted, textAlign: 'center', marginTop: spacing.md, lineHeight: 18 },
});
