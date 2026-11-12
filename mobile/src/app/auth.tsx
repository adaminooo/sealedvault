import { AppText, Card, Screen, color } from '@/ui';
import { t } from '@/core/i18n';

export default function Page() {
  return (
    <Screen>
      <Card>
        <AppText variant="heading">{t('Účet')}</AppText>
        <AppText color={color.muted}>{t('Přihlášení e-mailem a heslem bude tady.')}</AppText>
      </Card>
    </Screen>
  );
}
