import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

export default function Coach() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={s.root} testID="coach-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.back} testID="coach-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title}>Coach IA</Text>
          <View style={{ width: 34 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.heroCard}>
          <View style={s.heroIcon}><Ionicons name="chatbubbles" size={28} color={colors.brandPrimary} /></View>
          <Text style={s.heroTitle}>Seu nutricionista virtual</Text>
          <Text style={s.heroSub}>
            Em breve você vai conversar com uma IA especializada em nutrição e bem-estar, com base no seu histórico.
          </Text>
        </View>

        <Text style={s.sectionLabel}>Enquanto isso, dicas para hoje</Text>
        <View style={s.tips}>
          {[
            { icon: 'water', title: 'Hidrate-se', txt: 'Um copo de água ao acordar acelera o metabolismo.' },
            { icon: 'nutrition', title: 'Coma proteína no café', txt: 'Ajuda no controle de fome e preserva massa magra.' },
            { icon: 'walk', title: 'Movimente-se', txt: '10 minutos de caminhada leve após refeições reduz picos de glicose.' },
            { icon: 'moon', title: 'Sono é remédio', txt: '7–8h de sono estabilizam hormônios da fome.' },
          ].map((t, i) => (
            <View key={i} style={s.tip}>
              <View style={s.tipIcon}><Ionicons name={t.icon as any} size={18} color={colors.brandDark} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.tipTitle}>{t.title}</Text>
                <Text style={s.tipTxt}>{t.txt}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.headline, color: colors.onSurface },
  content: { padding: spacing.xl, gap: spacing.lg },
  heroCard: { backgroundColor: colors.surfaceInverse, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  heroIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(198,241,75,0.15)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { ...typography.title, color: colors.onSurfaceInverse, marginTop: spacing.sm },
  heroSub: { ...typography.body, color: colors.onSurfaceInverse, opacity: 0.75, textAlign: 'center', lineHeight: 22 },
  sectionLabel: { ...typography.caption, color: colors.muted, marginLeft: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  tips: { gap: spacing.sm },
  tip: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  tipIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  tipTitle: { ...typography.bodyStrong, color: colors.onSurface },
  tipTxt: { ...typography.caption, color: colors.onSurfaceSecondary, marginTop: 2, lineHeight: 18 },
});
