import { AppText, Card, Screen, color } from '@/ui';
import { t } from '@/core/i18n';

export default function Page() {
  return (
    <Screen>
      <Card>
        <AppText variant="heading">{t('Wishlist')}</AppText>
        <AppText color={color.muted}>{t('Sledované produkty a cílové ceny budou tady.')}</AppText>
      </Card>
    </Screen>
  );
}
