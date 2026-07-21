import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { storage } from '@/src/utils/storage';
import { radius, shadow, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type Reminder = {
  key: 'water' | 'meals' | 'weight' | 'sleep';
  title: string;
  body: string;
  icon: any;
  hour: number;
  minute: number;
  repeats: boolean;
  weekly?: number; // 1..7 (weekday for weight)
};

const DEFAULTS: Reminder[] = [
  { key: 'water', title: '💧 Hora da água!', body: 'Beba um copo de água agora para bater sua meta diária.', icon: 'water', hour: 10, minute: 0, repeats: true },
  { key: 'meals', title: '🍽️ Que tal registrar sua refeição?', body: 'Não esqueça de anotar o que você comeu.', icon: 'restaurant', hour: 13, minute: 0, repeats: true },
  { key: 'weight', title: '⚖️ Pesagem semanal', body: 'Registre seu peso e acompanhe seu progresso.', icon: 'scale', hour: 8, minute: 0, repeats: true, weekly: 1 },
  { key: 'sleep', title: '😴 Registre seu sono', body: 'Como foi seu descanso hoje?', icon: 'moon', hour: 22, minute: 0, repeats: true },
];

const STORAGE_KEY = 'vt:notifications';

type Config = Record<Reminder['key'], { enabled: boolean; hour: number; minute: number; ids: string[] }>;

const DEFAULT_CONFIG: Config = {
  water: { enabled: false, hour: 10, minute: 0, ids: [] },
  meals: { enabled: false, hour: 13, minute: 0, ids: [] },
  weight: { enabled: false, hour: 8, minute: 0, ids: [] },
  sleep: { enabled: false, hour: 22, minute: 0, ids: [] },
};

export default function NotificationsSettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [permStatus, setPermStatus] = useState<Notifications.PermissionStatus | 'unknown'>('unknown');
  const [busy, setBusy] = useState(false);

  const loadConfig = useCallback(async () => {
    const raw = await storage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setConfig({ ...DEFAULT_CONFIG, ...parsed });
      } catch { /* ignore */ }
    }
    if (Platform.OS !== 'web') {
      const p = await Notifications.getPermissionsAsync();
      setPermStatus(p.status);
    } else {
      setPermStatus('granted' as any); // web preview: pretend granted
    }
  }, []);

  useFocusEffect(useCallback(() => { loadConfig(); }, [loadConfig]));

  const save = async (cfg: Config) => {
    setConfig(cfg);
    await storage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  };

  const ensurePermission = async (): Promise<boolean> => {
    if (Platform.OS === 'web') return true;
    let p = await Notifications.getPermissionsAsync();
    if (p.status === 'undetermined' || p.canAskAgain) {
      p = await Notifications.requestPermissionsAsync();
    }
    setPermStatus(p.status);
    if (p.status !== 'granted') {
      Alert.alert(
        'Permissão necessária',
        'Habilite notificações nas configurações do dispositivo para receber lembretes.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir configurações', onPress: () => Linking.openSettings() },
        ],
      );
      return false;
    }
    return true;
  };

  const scheduleReminder = async (r: Reminder, cfg: Config): Promise<string[]> => {
    if (Platform.OS === 'web') return []; // web preview limitations
    const c = cfg[r.key];
    // Cancel previous scheduled notifications for this reminder
    for (const id of c.ids) {
      try { await Notifications.cancelScheduledNotificationAsync(id); } catch { /* ignore */ }
    }
    const trigger: any = r.weekly
      ? { hour: c.hour, minute: c.minute, weekday: r.weekly, repeats: true, type: Notifications.SchedulableTriggerInputTypes.WEEKLY }
      : { hour: c.hour, minute: c.minute, repeats: true, type: Notifications.SchedulableTriggerInputTypes.DAILY };
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body, sound: true, data: { reminder: r.key } },
      trigger,
    });
    return [id];
  };

  const toggle = async (r: Reminder, val: boolean) => {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (val) {
      const ok = await ensurePermission();
      if (!ok) return;
    }
    setBusy(true);
    try {
      const next: Config = { ...config, [r.key]: { ...config[r.key], enabled: val } };
      if (val) {
        const ids = await scheduleReminder(r, next);
        next[r.key].ids = ids;
      } else {
        for (const id of config[r.key].ids) {
          try { await Notifications.cancelScheduledNotificationAsync(id); } catch { /* ignore */ }
        }
        next[r.key].ids = [];
      }
      await save(next);
    } finally { setBusy(false); }
  };

  const testNow = async () => {
    if (Platform.OS === 'web') { Alert.alert('Web preview', 'Teste de notificação disponível apenas no dispositivo real.'); return; }
    if (!(await ensurePermission())) return;
    await Notifications.scheduleNotificationAsync({
      content: { title: '🎉 Teste do VitaTracker', body: 'Seus lembretes estão funcionando!', sound: true },
      trigger: null,
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const cancelAll = async () => {
    if (Platform.OS !== 'web') await Notifications.cancelAllScheduledNotificationsAsync();
    await save(DEFAULT_CONFIG);
    Alert.alert('Lembretes cancelados', 'Todos os lembretes foram desativados.');
  };

  useEffect(() => {
    // Cleanup on unmount is not needed since we persist state
  }, []);

  const enabledCount = Object.values(config).filter(c => c.enabled).length;

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.iconBtn} testID="notif-back">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title}>Lembretes</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.hero}>
          <Ionicons name="notifications" size={22} color={colors.brandPrimary} />
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle}>Lembretes inteligentes</Text>
            <Text style={s.heroSub}>Receba notificações locais para nunca esquecer de registrar seus hábitos.</Text>
          </View>
        </View>

        {Platform.OS === 'web' && (
          <View style={s.warnCard}>
            <Ionicons name="information-circle" size={18} color={colors.brandDark} />
            <Text style={s.warnTxt}>
              Notificações locais só funcionam no app instalado (iOS/Android). No preview web, os toggles ficam salvos mas as notificações reais aparecerão em builds nativos.
            </Text>
          </View>
        )}

        {permStatus === 'denied' && Platform.OS !== 'web' && (
          <Pressable style={s.warnCard} onPress={() => Linking.openSettings()}>
            <Ionicons name="warning" size={18} color={colors.error} />
            <Text style={[s.warnTxt, { color: colors.error }]}>
              Permissão de notificações negada. Toque para abrir as configurações.
            </Text>
          </Pressable>
        )}

        <Text style={s.sectionLbl}>Meus lembretes ({enabledCount}/{DEFAULTS.length})</Text>
        <View style={s.card}>
          {DEFAULTS.map((r, i) => {
            const c = config[r.key];
            return (
              <View key={r.key} style={[s.row, i < DEFAULTS.length - 1 && s.rowDivider]}>
                <View style={[s.icon, c.enabled ? { backgroundColor: colors.brandPrimary } : { backgroundColor: colors.surfaceTertiary }]}>
                  <Ionicons name={r.icon} size={20} color={c.enabled ? colors.brandDark : colors.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.reminderTitle}>{r.title}</Text>
                  <Text style={s.reminderTime}>
                    {String(c.hour).padStart(2, '0')}:{String(c.minute).padStart(2, '0')}
                    {r.weekly ? ' • Semanal' : ' • Diário'}
                  </Text>
                </View>
                <Switch
                  value={c.enabled}
                  onValueChange={val => toggle(r, val)}
                  disabled={busy}
                  trackColor={{ false: colors.surfaceTertiary, true: colors.brandPrimary }}
                  thumbColor={c.enabled ? colors.brandDark : '#fff'}
                  testID={`notif-toggle-${r.key}`}
                />
              </View>
            );
          })}
        </View>

        <Pressable style={s.testBtn} onPress={testNow} testID="notif-test">
          <Ionicons name="paper-plane" size={16} color={colors.brandDark} />
          <Text style={s.testBtnTxt}>Enviar notificação de teste</Text>
        </Pressable>

        {enabledCount > 0 && (
          <Pressable style={s.dangerBtn} onPress={cancelAll}>
            <Ionicons name="notifications-off" size={16} color={colors.error} />
            <Text style={s.dangerBtnTxt}>Cancelar todos os lembretes</Text>
          </Pressable>
        )}

        <View style={s.legal}>
          <Text style={s.legalTitle}>Sobre os lembretes</Text>
          <Text style={s.legalTxt}>
            • Todos os lembretes são gerados localmente no seu dispositivo (não passam por servidores).{'\n'}
            • Push notifications remotas ficam disponíveis apenas em builds publicados via Emergent Deploy.{'\n'}
            • Você pode ajustar horários e desativar a qualquer momento.
          </Text>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.title, color: colors.onSurface },
  content: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingTop: spacing.xs },

  hero: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.surfaceInverse, padding: spacing.lg, borderRadius: radius.lg },
  heroTitle: { ...typography.headline, color: colors.onSurfaceInverse },
  heroSub: { ...typography.small, color: colors.onSurfaceInverse, opacity: 0.75, marginTop: 2, lineHeight: 17 },

  warnCard: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', backgroundColor: colors.tintButter, padding: spacing.md, borderRadius: radius.md },
  warnTxt: { flex: 1, ...typography.small, color: colors.onTint, lineHeight: 17 },

  sectionLbl: { ...typography.caption, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.sm },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  reminderTitle: { ...typography.bodyStrong, color: colors.onSurface, fontSize: 14 },
  reminderTime: { ...typography.small, color: colors.muted, marginTop: 2 },

  testBtn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.sm },
  testBtnTxt: { ...typography.bodyStrong, color: colors.brandDark },
  dangerBtn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.error },
  dangerBtnTxt: { ...typography.bodyStrong, color: colors.error },

  legal: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  legalTitle: { ...typography.caption, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700', marginBottom: spacing.xs },
  legalTxt: { ...typography.small, color: colors.muted, lineHeight: 18 },
});
