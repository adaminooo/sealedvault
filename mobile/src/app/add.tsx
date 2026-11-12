import { AppText, Card, Screen, color } from '@/ui';
import { t } from '@/core/i18n';

export default function Page() {
  return (
    <Screen>
      <Card>
        <AppText variant="heading">{t('Přidat')}</AppText>
        <AppText color={color.muted}>{t('Formulář pro přidání produktu bude tady.')}</AppText>
      </Card>
    </Screen>
  );
}
