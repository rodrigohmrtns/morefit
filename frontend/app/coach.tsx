import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Message = { role: 'user' | 'assistant'; content: string; created_at?: string };
type Analysis = {
  summary?: string; strengths?: string[]; opportunities?: string[];
  stagnation_alert?: boolean; next_actions?: string[];
};

const SUGGESTIONS = [
  'Como está minha evolução?',
  'O que posso melhorar na alimentação?',
  'Estou dormindo o suficiente?',
  'Me dê 3 metas para esta semana',
  'Como quebrar minha estagnação?',
];

export default function Coach() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadHistory = useCallback(async () => {
    try {
      const r = await api<{ items: Message[] }>('/coach/messages?limit=50');
      setMessages(r.items || []);
    } catch {}
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput('');
    setSending(true);
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    try {
      const r = await api<{ session_id: string; reply: string }>('/coach/chat', {
        method: 'POST', body: { message: msg, session_id: sessionId },
      });
      setSessionId(r.session_id);
      setMessages(prev => [...prev, { role: 'assistant', content: r.reply }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ ' + (e?.message || 'Erro') }]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const analyze = async () => {
    setAnalyzing(true); setAnalysis(null);
    try { const r = await api<{ analysis: Analysis }>('/coach/analyze', { method: 'POST' }); setAnalysis(r.analysis); }
    catch (e: any) { console.log(e); }
    finally { setAnalyzing(false); }
  };

  return (
    <View style={s.root} testID="coach-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.back} testID="coach-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Coach IA</Text>
            <View style={s.headerSub}>
              <View style={s.dot} />
              <Text style={s.headerSubTxt}>Online • Gemini 2.5 Flash</Text>
            </View>
          </View>
          <Pressable onPress={analyze} style={s.analyzeBtn} disabled={analyzing} testID="coach-analyze-btn">
            {analyzing ? <ActivityIndicator size="small" color={colors.brandDark} /> : (
              <>
                <Ionicons name="analytics" size={14} color={colors.brandDark} />
                <Text style={s.analyzeTxt}>Analisar</Text>
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {/* Analysis */}
          {analysis && (
            <View style={s.analysisCard} testID="coach-analysis-card">
              <View style={s.analysisHead}>
                <Ionicons name="sparkles" size={18} color={colors.brandDark} />
                <Text style={s.analysisTitle}>Sua análise</Text>
              </View>
              {analysis.summary && <Text style={s.analysisSummary}>{analysis.summary}</Text>}
              {analysis.stagnation_alert && (
                <View style={s.stagBox}>
                  <Ionicons name="warning" size={14} color="#F4A261" />
                  <Text style={s.stagTxt}>Detectamos estagnação — hora de ajustar</Text>
                </View>
              )}
              {!!analysis.strengths?.length && (
                <View style={{ gap: 4 }}>
                  <Text style={s.aLabel}>Pontos fortes</Text>
                  {analysis.strengths.map((x, i) => (
                    <View key={i} style={s.aRow}><Ionicons name="checkmark" size={14} color={colors.success} /><Text style={s.aRowTxt}>{x}</Text></View>
                  ))}
                </View>
              )}
              {!!analysis.opportunities?.length && (
                <View style={{ gap: 4 }}>
                  <Text style={s.aLabel}>Oportunidades</Text>
                  {analysis.opportunities.map((x, i) => (
                    <View key={i} style={s.aRow}><Ionicons name="arrow-up" size={14} color={colors.warning} /><Text style={s.aRowTxt}>{x}</Text></View>
                  ))}
                </View>
              )}
              {!!analysis.next_actions?.length && (
                <View style={{ gap: 4 }}>
                  <Text style={s.aLabel}>Próximas ações</Text>
                  {analysis.next_actions.map((x, i) => (
                    <View key={i} style={s.aRow}><Ionicons name="flash" size={14} color={colors.brandDark} /><Text style={s.aRowTxt}>{x}</Text></View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Welcome */}
          {messages.length === 0 && !analysis && (
            <View style={s.welcome}>
              <View style={s.welcomeIcon}><Ionicons name="chatbubbles" size={28} color={colors.brandDark} /></View>
              <Text style={s.welcomeTitle}>Olá! Sou seu Coach IA</Text>
              <Text style={s.welcomeSub}>
                Posso analisar sua evolução, sono, alimentação e sugerir metas. Como posso ajudar hoje?
              </Text>
            </View>
          )}

          {/* Messages */}
          {messages.map((m, i) => (
            <View key={i} style={[s.msgRow, m.role === 'user' ? s.msgRowRight : s.msgRowLeft]}>
              {m.role === 'assistant' && (
                <View style={s.avatarAI}><Ionicons name="sparkles" size={14} color={colors.brandDark} /></View>
              )}
              <View style={[s.bubble, m.role === 'user' ? s.bubbleUser : s.bubbleAI]}>
                <Text style={m.role === 'user' ? s.bubbleUserTxt : s.bubbleAITxt}>{m.content}</Text>
              </View>
            </View>
          ))}

          {sending && (
            <View style={[s.msgRow, s.msgRowLeft]}>
              <View style={s.avatarAI}><Ionicons name="sparkles" size={14} color={colors.brandDark} /></View>
              <View style={[s.bubble, s.bubbleAI]}>
                <ActivityIndicator size="small" color={colors.brandPrimary} />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Suggestions */}
        {messages.length === 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.suggRow}>
            {SUGGESTIONS.map((sg, i) => (
              <Pressable key={i} onPress={() => send(sg)} style={s.sugg} testID={`coach-suggest-${i}`}>
                <Text style={s.suggTxt}>{sg}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Input */}
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.surface }}>
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder="Pergunte ao seu coach…"
              placeholderTextColor={colors.muted}
              multiline
              testID="coach-input"
            />
            <Pressable style={[s.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]}
              onPress={() => send()} disabled={!input.trim() || sending} testID="coach-send">
              <Ionicons name="send" size={18} color={colors.brandDark} />
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.headline, color: colors.onSurface },
  headerSub: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  headerSubTxt: { ...typography.small, color: colors.muted },
  analyzeBtn: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  analyzeTxt: { ...typography.small, color: colors.brandDark, fontWeight: '700' },

  content: { padding: spacing.xl, gap: spacing.md },
  welcome: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxxl },
  welcomeIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  welcomeTitle: { ...typography.title, color: colors.onSurface },
  welcomeSub: { ...typography.body, color: colors.onSurfaceSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 300 },

  analysisCard: { backgroundColor: colors.surfaceInverse, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  analysisHead: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  analysisTitle: { ...typography.bodyStrong, color: colors.brandPrimary },
  analysisSummary: { ...typography.body, color: colors.onSurfaceInverse, opacity: 0.9, lineHeight: 22 },
  stagBox: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: 'rgba(244,162,97,0.15)', paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill, alignSelf: 'flex-start' },
  stagTxt: { ...typography.small, color: '#F4A261', fontWeight: '700' },
  aLabel: { ...typography.small, color: colors.brandPrimary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  aRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  aRowTxt: { flex: 1, ...typography.caption, color: colors.onSurfaceInverse, opacity: 0.85, lineHeight: 18 },

  msgRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start' },
  msgRowRight: { justifyContent: 'flex-end' },
  avatarAI: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '80%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: radius.md },
  bubbleUser: { backgroundColor: colors.brandPrimary, borderBottomRightRadius: 4 },
  bubbleUserTxt: { ...typography.body, color: colors.brandDark, lineHeight: 22 },
  bubbleAI: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleAITxt: { ...typography.body, color: colors.onSurface, lineHeight: 22 },

  suggRow: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, gap: spacing.sm },
  sugg: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, flexShrink: 0 },
  suggTxt: { ...typography.caption, color: colors.onSurface },

  inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end', paddingHorizontal: spacing.xl, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  input: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderWidth: 1, borderColor: colors.border, color: colors.onSurface, ...typography.body, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
});
