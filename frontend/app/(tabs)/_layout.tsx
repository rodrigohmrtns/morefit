import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          height: 84,
          paddingTop: 8,
          paddingBottom: 24,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Início', tabBarIcon: ({ color }) => <Ionicons name="home" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="food"
        options={{ title: 'Diário', tabBarIcon: ({ color }) => <Ionicons name="restaurant" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progresso', tabBarIcon: ({ color }) => <Ionicons name="stats-chart" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Perfil', tabBarIcon: ({ color }) => <Ionicons name="person" size={22} color={color} /> }}
      />
    </Tabs>
  );
}
