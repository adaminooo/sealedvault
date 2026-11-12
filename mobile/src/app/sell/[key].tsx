import { Stack, useLocalSearchParams } from 'expo-router';

import { AppText, Card, Screen, color } from '@/ui';
import { t } from '@/core/i18n';

export default function SellPage() {
  const { key } = useLocalSearchParams<{ key: string }>();
  return (
    <Screen>
      <Stack.Screen options={{ title: t('Prodat') }} />
      <Card>
        <AppText variant="heading">{t('Prodat')}</AppText>
        <AppText color={color.muted}>{key}</AppText>
      </Card>
    </Screen>
  );
}
