/**
 * Command Palette — global fuzzy search overlay.
 *
 * Registered actions live in `COMMAND_REGISTRY`. The palette is triggered by
 * a floating "sparkles" FAB rendered by `<CommandPaletteFab />` — mount that
 * once in `_layout.tsx` (already handled).
 *
 * Keyboard shortcut: nothing on native (no hardware kbd); on web `Ctrl/Cmd+K`.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { useLocale } from '@/src/i18n';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';
import { haptic } from '@/src/utils/haptic';

export type Command = {
  id: string;
  labelKey: string;    // i18n key or raw label
  descKey?: string;
  icon: keyof typeof Ionicons.glyphMap;
  group: 'nav' | 'add' | 'ai' | 'settings' | 'account';
  route?: string;
  action?: () => void | Promise<void>;
  keywords?: string[];
};

// -----------------------------------------------------------------------------
// Context to open/close from anywhere
// -----------------------------------------------------------------------------
type Ctx = { open: () => void; close: () => void; isOpen: boolean };
const CmdCtx = createContext<Ctx>({ open: () => {}, close: () => {}, isOpen: false });

export function useCommandPalette() { return useContext(CmdCtx); }

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => { haptic.tap(); setOpen(true); }, []);
  const close = useCallback(() => setOpen(false), []);

  // Web-only ⌘/Ctrl+K shortcut
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <CmdCtx.Provider value={{ open, close, isOpen }}>
      {children}
      <CommandPaletteModal visible={isOpen} onClose={close} />
    </CmdCtx.Provider>
  );
}

// -----------------------------------------------------------------------------
// Registry — the set of actions searchable in the palette
// -----------------------------------------------------------------------------
const REGISTRY: Command[] = [
  // Navigation
  { id: 'nav.home', labelKey: 'tabs.home', icon: 'home', group: 'nav', route: '/(tabs)' },
  { id: 'nav.food', labelKey: 'tabs.food', icon: 'restaurant', group: 'nav', route: '/(tabs)/food' },
  { id: 'nav.progress', labelKey: 'tabs.progress', icon: 'stats-chart', group: 'nav', route: '/(tabs)/progress' },
  { id: 'nav.profile', labelKey: 'tabs.profile', icon: 'person', group: 'nav', route: '/(tabs)/profile' },
  { id: 'nav.recipes', labelKey: 'home.recipesTitle', icon: 'sparkles', group: 'ai', route: '/recipes' },
  { id: 'nav.coach', labelKey: 'home.coachAI', icon: 'chatbubbles', group: 'ai', route: '/coach' },
  { id: 'nav.scan', labelKey: 'home.scanAI', icon: 'scan', group: 'ai', route: '/scan' },
  { id: 'nav.gamification', labelKey: 'home.achievements', icon: 'trophy', group: 'nav', route: '/gamification' },
  { id: 'nav.community', labelKey: 'home.community', icon: 'people', group: 'nav', route: '/community' },
  { id: 'nav.companies', labelKey: 'home.companies', icon: 'business', group: 'nav', route: '/companies' },
  { id: 'nav.share', labelKey: 'home.shareWithPros', icon: 'document-text', group: 'nav', route: '/professional-share' },
  { id: 'nav.privacy', labelKey: 'privacy.title', icon: 'lock-closed', group: 'settings', route: '/privacy' },
  { id: 'nav.wearables', labelKey: 'wearables.title', icon: 'watch', group: 'settings', route: '/wearables',
    keywords: ['watch', 'relogio', 'healthkit', 'google fit', 'health connect'] },
  { id: 'nav.widgets', labelKey: 'widgets.title', icon: 'apps', group: 'settings', route: '/widgets',
    keywords: ['widget', 'home screen', 'tela inicial'] },
  { id: 'nav.paywall', labelKey: 'paywall.subscribeCta', icon: 'diamond', group: 'account', route: '/paywall' },

  // Quick actions (add stuff)
  { id: 'add.weight', labelKey: 'palette.addWeight', icon: 'scale', group: 'add', route: '/weight-log',
    keywords: ['peso', 'kg', 'weight', 'balança'] },
  { id: 'add.water', labelKey: 'palette.addWater', icon: 'water', group: 'add', route: '/water',
    keywords: ['água', 'water', 'hidratação'] },
  { id: 'add.meal', labelKey: 'palette.addMeal', icon: 'nutrition', group: 'add', route: '/food-add',
    keywords: ['refeição', 'meal', 'comida', 'food'] },
  { id: 'add.exercise', labelKey: 'palette.addExercise', icon: 'barbell', group: 'add', route: '/exercise-log',
    keywords: ['exercício', 'workout', 'treino'] },
  { id: 'add.sleep', labelKey: 'palette.addSleep', icon: 'moon', group: 'add', route: '/sleep-log',
    keywords: ['sono', 'sleep', 'noite'] },
  { id: 'add.photo', labelKey: 'palette.addPhoto', icon: 'camera', group: 'add', route: '/photos',
    keywords: ['foto', 'photo', 'progresso'] },
  { id: 'add.body', labelKey: 'palette.addBody', icon: 'body', group: 'add', route: '/body-composition',
    keywords: ['medidas', 'composição', 'body'] },
  { id: 'add.fasting', labelKey: 'palette.addFasting', icon: 'timer-outline', group: 'add', route: '/fasting',
    keywords: ['jejum', 'fasting'] },
];

const GROUP_LABEL: Record<Command['group'], string> = {
  nav: 'palette.groupNav',
  add: 'palette.groupAdd',
  ai: 'palette.groupAI',
  settings: 'palette.groupSettings',
  account: 'palette.groupAccount',
};

// -----------------------------------------------------------------------------
// Modal UI
// -----------------------------------------------------------------------------
function CommandPaletteModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLocale();
  const [q, setQ] = useState('');
  const s = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => { if (!visible) setQ(''); }, [visible]);

  // Translate labels at the moment we build the searchable index — this makes
  // the fuzzy match work in the user's chosen language.
  const indexed = useMemo(() => REGISTRY.map(c => ({
    ...c,
    label: t(c.labelKey),
    desc: c.descKey ? t(c.descKey) : '',
  })), [t]);

  const fuse = useMemo(() => new Fuse(indexed, {
    keys: [
      { name: 'label', weight: 3 },
      { name: 'desc', weight: 1 },
      { name: 'keywords', weight: 2 },
      { name: 'id', weight: 0.5 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
    includeScore: true,
  }), [indexed]);

  const results = useMemo(() => {
    const trimmed = q.trim();
    if (!trimmed) return indexed;
    return fuse.search(trimmed).map(r => r.item);
  }, [q, fuse, indexed]);

  // Group results
  const grouped = useMemo(() => {
    const g: Record<string, typeof results> = {};
    for (const r of results) {
      const key = r.group;
      (g[key] ||= []).push(r);
    }
    return g;
  }, [results]);

  const execute = useCallback((cmd: (typeof indexed)[number]) => {
    haptic.select();
    onClose();
    // Small delay so modal close animation finishes before navigation
    setTimeout(() => {
      if (cmd.route) router.push(cmd.route as any);
      if (cmd.action) void cmd.action();
    }, 60);
  }, [router, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <Animated.View entering={FadeInDown.springify().damping(18)} style={s.sheet}>
          <View style={s.searchRow}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              autoFocus
              value={q}
              onChangeText={setQ}
              placeholder={t('palette.searchPlaceholder')}
              placeholderTextColor={colors.muted}
              style={s.input}
              testID="palette-input"
              returnKeyType="go"
              onSubmitEditing={() => { if (results[0]) execute(results[0]); }}
            />
            <Pressable onPress={onClose} hitSlop={12} testID="palette-close">
              <Ionicons name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.list}>
            {results.length === 0 && (
              <View style={s.empty}>
                <Ionicons name="search-outline" size={36} color={colors.muted} />
                <Text style={s.emptyTxt}>{t('palette.empty')}</Text>
              </View>
            )}
            {(['ai', 'add', 'nav', 'settings', 'account'] as const).map(group => {
              const items = grouped[group];
              if (!items || items.length === 0) return null;
              return (
                <View key={group} style={{ marginBottom: spacing.md }}>
                  <Text style={s.groupLabel}>{t(GROUP_LABEL[group])}</Text>
                  {items.map((c, i) => (
                    <Animated.View key={c.id} entering={FadeIn.delay(i * 30)}>
                      <Pressable
                        onPress={() => execute(c)}
                        style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.surfaceTertiary }]}
                        testID={`palette-item-${c.id}`}
                      >
                        <View style={s.rowIcon}>
                          <Ionicons name={c.icon} size={16} color={colors.brandDark} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.rowLabel}>{c.label}</Text>
                          {c.desc ? <Text style={s.rowDesc}>{c.desc}</Text> : null}
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={colors.muted} />
                      </Pressable>
                    </Animated.View>
                  ))}
                </View>
              );
            })}
            <View style={{ height: spacing.lg }} />
          </ScrollView>

          <View style={s.footer}>
            <View style={s.kbdRow}>
              {Platform.OS === 'web' && (
                <>
                  <View style={s.kbd}><Text style={s.kbdTxt}>⌘</Text></View>
                  <View style={s.kbd}><Text style={s.kbdTxt}>K</Text></View>
                  <Text style={s.kbdHint}>{t('palette.hint')}</Text>
                </>
              )}
              {Platform.OS !== 'web' && (
                <Text style={s.kbdHint}>{t('palette.hintMobile')}</Text>
              )}
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Floating action button — visible globally
// -----------------------------------------------------------------------------
export function CommandPaletteFab() {
  const { colors } = useTheme();
  const { open } = useCommandPalette();
  const { t } = useLocale();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={open}
      style={s.fab}
      testID="palette-fab"
      accessibilityLabel={t('palette.searchPlaceholder')}
      accessibilityRole="button"
      accessibilityHint={Platform.OS === 'web' ? t('palette.hint') : t('palette.hintMobile')}
    >
      <Ionicons name="sparkles" size={20} color={colors.brandDark} />
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------
const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 100 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    width: '92%', maxWidth: 560, maxHeight: '75%',
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 12,
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  input: { flex: 1, ...typography.body, color: colors.onSurface, paddingVertical: 6 },
  list: { padding: spacing.md },
  groupLabel: {
    ...typography.small, color: colors.muted, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 4, fontWeight: '700',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  rowIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: colors.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { ...typography.bodyStrong, color: colors.onSurface },
  rowDesc: { ...typography.small, color: colors.muted, marginTop: 1 },
  empty: { alignItems: 'center', padding: spacing.xxl, gap: spacing.sm },
  emptyTxt: { ...typography.body, color: colors.muted },
  footer: { borderTopWidth: 1, borderTopColor: colors.divider, padding: spacing.sm },
  kbdRow: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' },
  kbd: {
    minWidth: 22, height: 22, paddingHorizontal: 4, borderRadius: 4,
    backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  kbdTxt: { ...typography.small, color: colors.onSurface, fontWeight: '700' },
  kbdHint: { ...typography.small, color: colors.muted, marginLeft: 6 },
  fab: {
    position: 'absolute', bottom: 100, right: 16,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.brandPrimary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    zIndex: 999,
  },
});
