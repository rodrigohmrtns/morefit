import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { api } from '@/src/api/client';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Fast = {
  id: string; protocol: string; target_hours: number;
  started_at: string; ended_at: string | null; elapsed_hours?: number;
  note?: string; cancelled?: boolean;
};

const PROTOCOLS: { key: string; label: string; hours: number; desc: string }[] = [
  { key: '16:8', label: '16:8', hours: 16, desc: 'Iniciante — 16h jejum, 8h alimentação' },
  { key: '18:6', label: '18:6', hours: 18, desc: 'Intermediário — 18h jejum, 6h alimentação' },
  { key: '20:4', label: '20:4', hours: 20, desc: 'Avançado — 20h jejum, 4h alimentação' },
  { key: 'OMAD', label: 'OMAD', hours: 23, desc: 'One Meal a Day — uma refeição por dia' },
];

function fmtDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const s = Math.floor(((hours - h) * 60 - m) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Fasting() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [active, setActive] = useState<Fast | null>(null);
  const [history, setHistory] = useState<Fast[]>([]);
  const [protocol, setProtocol] = useState<string>('16:8');
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const cur = await api<{ active: Fast | null }>('/fasting/current');
      setActive(cur.active);
      const h = await api<{ items: Fast[] }>('/fasting');
      setHistory(h.items || []);
    } catch (e) { console.log(e); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Timer tick every second when active
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [active]);

  const startFast = async () => {
    try { await api('/fasting/start', { method: 'POST', body: { protocol } }); await load(); } catch {}
  };
  const stopFast = async () => {
    try { await api('/fasting/stop', { method: 'POST' }); await load(); } catch {}
  };
  const deleteFast = async (id: string) => {
    try { await api(`/fasting/${id}`, { method: 'DELETE' }); await load(); } catch {}
  };

  // Compute elapsed for active session
  const elapsedH = useMemo(() => {
    if (!active) return 0;
    const start = new Date(active.started_at).getTime();
    return (Date.now() - start) / 3600000;
  }, [active, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const progressPct = active ? Math.min(100, (elapsedH / active.target_hours) * 100) : 0;

  return (
    <View style={s.root} testID="fasting-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={s.back} testID="fasting-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title}>Jejum Intermitente</Text>
          <View style={{ width: 34 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.content}>
        {/* Cronômetro */}
        <View style={s.timerCard}>
          <RingProgress colors={colors} pct={progressPct} />
          <View style={s.ringOverlay}>
            {active ? (
              <>
                <Text style={s.timerLabel}>{active.protocol}</Text>
                <Text style={s.timerVal} testID="fasting-timer">{fmtDuration(elapsedH)}</Text>
                <Text style={s.timerGoal}>Meta: {active.target_hours}h</Text>
              </>
            ) : (
              <>
                <Text style={s.timerLabel}>Pronto para começar?</Text>
                <Ionicons name="timer-outline" size={38} color={colors.brandPrimary} style={{ marginVertical: 4 }} />
                <Text style={s.timerGoalIdle}>Escolha um protocolo</Text>
              </>
            )}
          </View>
        </View>

        {/* Action */}
        {active ? (
          <Pressable style={s.stopBtn} onPress={stopFast} testID="fasting-stop">
            <Ionicons name="stop-circle" size={20} color={colors.onSurfaceInverse} />
            <Text style={s.stopTxt}>Encerrar jejum</Text>
          </Pressable>
        ) : (
          <Pressable style={s.startBtn} onPress={startFast} testID="fasting-start">
            <Ionicons name="play-circle" size={20} color={colors.brandDark} />
            <Text style={s.startTxt}>Iniciar {protocol}</Text>
          </Pressable>
        )}

        {/* Protocolos */}
        {!active && (
          <>
            <Text style={s.sectionLabel}>Protocolos</Text>
            <View style={{ gap: spacing.sm }}>
              {PROTOCOLS.map(p => (
                <Pressable key={p.key} onPress={() => setProtocol(p.key)}
                  style={[s.proto, protocol === p.key && s.protoActive]} testID={`fasting-proto-${p.key}`}>
                  <View style={[s.protoBadge, protocol === p.key && { backgroundColor: colors.brandDark }]}>
                    <Text style={[s.protoBadgeTxt, protocol === p.key && { color: colors.brandPrimary }]}>{p.label}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.protoTitle, protocol === p.key && { color: colors.brandDark, fontWeight: '700' }]}>{p.label}</Text>
                    <Text style={[s.protoDesc, protocol === p.key && { color: colors.brandDark }]}>{p.desc}</Text>
                  </View>
                  {protocol === p.key && <Ionicons name="checkmark-circle" size={20} color={colors.brandDark} />}
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Histórico */}
        {!!history.length && (
          <>
            <Text style={s.sectionLabel}>Histórico</Text>
            <View style={s.histList}>
              {history.slice(0, 20).map(f => {
                const h = f.elapsed_hours ?? 0;
                const target = f.target_hours || 16;
                const pct = Math.min(100, (h / target) * 100);
                const success = h >= target * 0.9 && !f.cancelled;
                return (
                  <View key={f.id} style={s.histRow}>
                    <View style={s.histIcon}>
                      <Ionicons
                        name={f.cancelled ? 'close-circle' : success ? 'checkmark-circle' : 'time'}
                        size={20}
                        color={f.cancelled ? colors.error : success ? colors.success : colors.warning}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.histTitle}>{f.protocol} • {h.toFixed(1)}h de {target}h</Text>
                      <Text style={s.histSub}>{new Date(f.started_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                      <View style={s.histBar}>
                        <View style={[s.histFill, { width: `${pct}%`, backgroundColor: success ? colors.brandPrimary : colors.muted }]} />
                      </View>
                    </View>
                    <Pressable onPress={() => deleteFast(f.id)} hitSlop={10} testID={`fasting-del-${f.id}`}>
                      <Ionicons name="trash-outline" size={16} color={colors.muted} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </>
        )}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

function RingProgress({ colors, pct }: { colors: ThemeColors; pct: number }) {
  const size = 220;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceTertiary} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={colors.brandPrimary} strokeWidth={stroke} fill="none"
        strokeDasharray={c} strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.headline, color: colors.onSurface },
  content: { padding: spacing.xl, gap: spacing.md },

  timerCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, position: 'relative' },
  ringOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  timerLabel: { ...typography.caption, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  timerVal: { fontSize: 40, fontWeight: '700', color: colors.onSurface, letterSpacing: -1, marginTop: spacing.xs },
  timerGoal: { ...typography.caption, color: colors.muted, marginTop: 4 },
  timerGoalIdle: { ...typography.caption, color: colors.muted, marginTop: 4 },

  startBtn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingVertical: 16 },
  startTxt: { color: colors.brandDark, fontWeight: '700', fontSize: 16 },
  stopBtn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceInverse, borderRadius: radius.pill, paddingVertical: 16 },
  stopTxt: { color: colors.onSurfaceInverse, fontWeight: '700', fontSize: 16 },

  sectionLabel: { ...typography.caption, color: colors.muted, marginLeft: spacing.md, marginTop: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },

  proto: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  protoActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  protoBadge: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  protoBadgeTxt: { color: colors.brandDark, fontWeight: '700', ...typography.caption },
  protoTitle: { ...typography.bodyStrong, color: colors.onSurface },
  protoDesc: { ...typography.small, color: colors.onSurfaceSecondary, marginTop: 2 },

  histList: { gap: spacing.sm },
  histRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  histIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  histTitle: { ...typography.bodyStrong, color: colors.onSurface },
  histSub: { ...typography.small, color: colors.muted, marginTop: 2 },
  histBar: { height: 4, backgroundColor: colors.divider, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  histFill: { height: '100%', borderRadius: 2 },
});
