import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '@/src/contexts/AuthContext';
import { colors } from '@/src/theme';

export default function Index() {
  const { loading, user } = useAuth();
  if (loading) {
    return (
      <View style={styles.center} testID="splash-loading">
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/(auth)/onboarding" />;
  if (!user.onboarded) return <Redirect href="/(auth)/setup" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
});
