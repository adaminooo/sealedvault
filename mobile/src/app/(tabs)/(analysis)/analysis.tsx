import { AppText, Card, Screen, color } from '@/ui';
import { t } from '@/core/i18n';

export default function Page() {
  return (
    <Screen>
      <Card>
        <AppText variant="heading">{t('Analýza')}</AppText>
        <AppText color={color.muted}>{t('Grafy výkonu a rozložení portfolia budou tady.')}</AppText>
      </Card>
    </Screen>
  );
}
