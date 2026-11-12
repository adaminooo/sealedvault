import { Stack } from 'expo-router';

import { t } from '@/core/i18n';
import { color, font } from '@/ui';

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: process.env.EXPO_OS === 'ios',
        headerBlurEffect: 'systemChromeMaterialDark',
        headerLargeTitleStyle: { fontFamily: font.displayBold, color: color.text },
        headerTitleStyle: { fontFamily: font.semibold, color: color.text },
        headerStyle: { backgroundColor: process.env.EXPO_OS === 'ios' ? undefined : color.bg },
        contentStyle: { backgroundColor: color.bg },
      }}>
      <Stack.Screen name="analysis" options={{ title: t('Analýza') }} />
    </Stack>
  );
}
