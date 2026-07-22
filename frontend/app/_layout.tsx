import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { LogBox, StatusBar, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import Toast from 'react-native-toast-message';

import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { CommandPaletteFab, CommandPaletteProvider } from '@/src/command-palette';
import { LocaleProvider } from '@/src/i18n';
import { QueryProvider } from '@/src/query';
import { ThemeProvider, useTheme } from '@/src/theme';
import { useIconFonts } from '@/src/hooks/use-icon-fonts';
import { toastConfig } from '@/src/components/toast';

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

function ThemedStack() {
  const { colors } = useTheme();
  const { user } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar
        barStyle={colors.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.surface}
      />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />
      {user ? <CommandPaletteFab /> : null}
      <Toast config={toastConfig} topOffset={60} />
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LocaleProvider>
            <QueryProvider>
              <AuthProvider>
                <BottomSheetModalProvider>
                  <CommandPaletteProvider>
                    <ThemedStack />
                  </CommandPaletteProvider>
                </BottomSheetModalProvider>
              </AuthProvider>
            </QueryProvider>
          </LocaleProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
