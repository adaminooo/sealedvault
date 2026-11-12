import 'expo-sqlite/localStorage/install';

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { t } from '@/core/i18n';
import { queryClient } from '@/data/queries';
import { initCloud } from '@/sync/cloud';
import { color, font } from '@/ui';

SplashScreen.preventAutoHideAsync();
initCloud();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: color.bg, card: color.surface, primary: color.accent, text: color.text, border: color.border },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <QueryClientProvider client={queryClient}>
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: color.bg },
          headerTintColor: color.accent2,
          headerTitleStyle: { fontFamily: font.semibold, color: color.text },
          headerBackButtonDisplayMode: 'minimal',
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="product/[key]" options={{ title: '' }} />
        <Stack.Screen
          name="add"
          options={{
            title: t('Přidat'),
            presentation: 'formSheet',
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.6, 1],
            contentStyle: { backgroundColor: color.surface },
          }}
        />
        <Stack.Screen
          name="sell/[key]"
          options={{ title: t('Prodat'), presentation: 'formSheet', sheetGrabberVisible: true, sheetAllowedDetents: [0.6], contentStyle: { backgroundColor: color.surface } }}
        />
        <Stack.Screen name="auth" options={{ title: t('Účet'), presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
    </QueryClientProvider>
  );
}
