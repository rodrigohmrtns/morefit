import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { api } from '@/src/api/client';
import { BackButton } from '@/src/components/back-button';
import { useLocale } from '@/src/i18n';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';
import { haptic } from '@/src/utils/haptic';

export default function Widgets() {
  const { colors } = useTheme();
  const { t } = useLocale();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ token: string }>('/widgets/token', { method: 'POST' });
      setToken(r.token);
    } catch (e: any) {
      setError(e?.message || 'Falha ao gerar token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const rotate = async () => {
    haptic.tap();
    await load();
    setCopied(false);
    haptic.success();
  };

  const revoke = async () => {
    haptic.tap();
    setLoading(true);
    try {
      await api('/widgets/token', { method: 'DELETE' });
      setToken(null);
    } catch (e: any) {
      setError(e?.message || 'Falha');
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!token) return;
    haptic.tap();
    await Clipboard.setStringAsync(token);
    setCopied(true);
    haptic.success();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={s.root} testID="widgets-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <BackButton />
          <View style={{ flex: 1 }}>
            <Text style={s.title} accessibilityRole="header">{t('widgets.title')}</Text>
            <Text style={s.sub}>{t('widgets.subtitle')}</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.content}>
        <Animated.View entering={FadeInUp.springify().damping(14)} style={s.banner}>
          <View style={s.bannerIcon}><Ionicons name="apps" size={22} color={colors.brandDark} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.bannerTitle}>{t('widgets.availability')}</Text>
            <Text style={s.bannerBody}>{t('widgets.availabilityBody')}</Text>
          </View>
        </Animated.View>

        <Text style={s.section}>{t('widgets.tokenLabel')}</Text>
        {loading && <ActivityIndicator size="small" color={colors.brandPrimary} style={{ marginVertical: spacing.md }} />}
        {error && (
          <View style={s.errorBox}>
            <Ionicons name="warning" size={16} color={colors.error} />
            <Text style={s.errorTxt}>{error}</Text>
          </View>
        )}
        {token && (
          <View style={s.tokenBox}>
            <Text style={s.tokenTxt} numberOfLines={2} selectable testID="widgets-token">{token}</Text>
            <View style={s.tokenActions}>
              <Pressable
                onPress={copy}
                style={s.tokenBtn}
                testID="widgets-copy"
                accessibilityRole="button"
                accessibilityLabel={t('widgets.copy')}
              >
                <Ionicons name={copied ? 'checkmark' : 'copy'} size={14} color={colors.brandDark} />
                <Text style={s.tokenBtnTxt}>{copied ? t('widgets.copied') : t('widgets.copy')}</Text>
              </Pressable>
              <Pressable
                onPress={rotate}
                style={s.tokenBtn}
                accessibilityRole="button"
                accessibilityLabel={t('widgets.rotate')}
              >
                <Ionicons name="refresh" size={14} color={colors.brandDark} />
                <Text style={s.tokenBtnTxt}>{t('widgets.rotate')}</Text>
              </Pressable>
              <Pressable
                onPress={revoke}
                style={[s.tokenBtn, { backgroundColor: 'rgba(224,90,95,0.15)' }]}
                accessibilityRole="button"
                accessibilityLabel={t('widgets.revoke')}
              >
                <Ionicons name="trash" size={14} color={colors.error} />
                <Text style={[s.tokenBtnTxt, { color: colors.error }]}>{t('widgets.revoke')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Text style={s.section}>{t('widgets.previews')}</Text>

        {/* Small widget preview */}
        <View style={s.widgetPreview}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="flame" size={16} color={colors.brandPrimary} />
            <Text style={s.previewLabel}>{t('home.caloriesRemaining')}</Text>
          </View>
          <Text style={s.previewValue}>1247 <Text style={s.previewUnit}>kcal</Text></Text>
          <View style={s.previewBar}>
            <View style={[s.previewBarFill, { width: '63%' }]} />
          </View>
        </View>

        <View style={s.widgetPreview}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="water" size={16} color={colors.info} />
            <Text style={s.previewLabel}>{t('home.hydration')}</Text>
          </View>
          <Text style={s.previewValue}>1200 <Text style={s.previewUnit}>/ 2000 ml</Text></Text>
          <View style={s.previewBar}>
            <View style={[s.previewBarFill, { width: '60%', backgroundColor: colors.info }]} />
          </View>
        </View>

        <View style={s.widgetPreview}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="trophy" size={16} color="#D4A017" />
            <Text style={s.previewLabel}>{t('widgets.streak')}</Text>
          </View>
          <Text style={s.previewValue}>7 <Text style={s.previewUnit}>{t('widgets.streakDays')}</Text></Text>
        </View>

        <Text style={s.footNote}>{t('widgets.footNote')}</Text>
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

  banner: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', backgroundColor: colors.tintLavender, padding: spacing.md, borderRadius: radius.lg },
  bannerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { ...typography.bodyStrong, color: colors.onTint },
  bannerBody: { ...typography.small, color: colors.onTint, marginTop: 4, opacity: 0.85 },

  section: { ...typography.caption, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.xs },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(224,90,95,0.12)', padding: spacing.md, borderRadius: radius.md },
  errorTxt: { flex: 1, ...typography.caption, color: colors.error },

  tokenBox: { backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  tokenTxt: { ...typography.small, color: colors.onSurface, fontFamily: 'Menlo, Courier, monospace' as any, backgroundColor: colors.surfaceTertiary, padding: 8, borderRadius: radius.sm },
  tokenActions: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  tokenBtn: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  tokenBtnTxt: { ...typography.caption, color: colors.brandDark, fontWeight: '700' },

  widgetPreview: { backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, gap: 6 },
  previewLabel: { ...typography.small, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  previewValue: { ...typography.hero, color: colors.onSurface, fontSize: 26 },
  previewUnit: { ...typography.caption, color: colors.muted, fontWeight: '500' },
  previewBar: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary, overflow: 'hidden', marginTop: 6 },
  previewBarFill: { height: 6, backgroundColor: colors.brandPrimary },

  footNote: { ...typography.small, color: colors.muted, textAlign: 'center', marginTop: spacing.md, lineHeight: 18 },
});
