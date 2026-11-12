import { AppText, Card, Screen, color } from '@/ui';
import { t } from '@/core/i18n';

export default function Page() {
  return (
    <Screen>
      <Card>
        <AppText variant="heading">{t('Účet')}</AppText>
        <AppText color={color.muted}>{t('Přihlášení, synchronizace a nastavení budou tady.')}</AppText>
      </Card>
    </Screen>
  );
}
