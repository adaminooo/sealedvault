import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';

import { LOCALE, t } from '@/core/i18n';
import { signOut, syncNow, useCloud } from '@/sync/cloud';
import { AppText, Button, Card, Screen, color } from '@/ui';

export default function AccountScreen() {
  const cloud = useCloud();

  const confirmSignOut = () => {
    const msg = t('Odhlásit se? Data zůstanou v tomto zařízení.');
    if (Platform.OS === 'web') {
      if (confirm(msg)) void signOut();
      return;
    }
    Alert.alert(t('Odhlásit se'), msg, [
      { text: t('Zrušit'), style: 'cancel' },
      { text: t('Odhlásit se'), style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const status = cloud.syncing
    ? t('Synchronizuji…')
    : cloud.error
      ? t('Synchronizace selhala: {0}', cloud.error)
      : cloud.lastSync
        ? t('Synchronizováno v {0} – stejná data na všech zařízeních.', new Date(cloud.lastSync).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }))
        : t('Čeká na synchronizaci…');

  return (
    <Screen>
      <Card>
        <AppText variant="overline" color={color.muted}>
          {t('Účet')}
        </AppText>
        {!cloud.ready ? null : cloud.user ? (
          <>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {cloud.user.email}
            </AppText>
            <AppText variant="caption" color={cloud.error ? color.neg : color.muted}>
              {status}
            </AppText>
            <Button label={t('Synchronizovat')} variant="secondary" onPress={() => void syncNow()} disabled={cloud.syncing} />
            <Button label={t('Odhlásit se')} variant="secondary" onPress={confirmSignOut} />
          </>
        ) : (
          <>
            <AppText variant="heading">{t('Nepřihlášený')}</AppText>
            <AppText color={color.muted}>{t('Data jsou jen v tomto zařízení. S účtem je máš na počítači i telefonu.')}</AppText>
            <Button label={t('Přihlásit se')} onPress={() => router.push('/auth')} />
          </>
        )}
      </Card>
    </Screen>
  );
}
