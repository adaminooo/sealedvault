import { Stack, useLocalSearchParams } from 'expo-router';

import { AppText, Card, Screen, color } from '@/ui';
import { t } from '@/core/i18n';

export default function ProductPage() {
  const { key } = useLocalSearchParams<{ key: string }>();
  return (
    <Screen>
      <Stack.Screen options={{ title: t('Detail') }} />
      <Card>
        <AppText variant="heading">{t('Detail')}</AppText>
        <AppText color={color.muted}>{key}</AppText>
      </Card>
    </Screen>
  );
}
