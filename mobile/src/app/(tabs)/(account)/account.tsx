import Constants from 'expo-constants';
import { reloadAppAsync } from 'expo';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { SUPPORT_EMAIL } from '@/config';
import { backupFilename, toJson } from '@/core/backup';
import { LANG, LOCALE, saveLang, t, type Lang } from '@/core/i18n';
import { ALL_ID, MAIN_ID, newPortfolioId, portfolioOf } from '@/core/portfolios';
import type { Currency } from '@/core/types';
import { usePortfolios } from '@/data/use-portfolio';
import { useStoredState } from '@/data/use-stored-state';
import { items as itemsStore, wishlist as wishStore } from '@/db/store';
import { authMessage, deleteAccount, signOut, syncNow, useCloud } from '@/sync/cloud';
import { disablePush, enablePush, forgetPush, usePushEnabled } from '@/sync/push';
import { AppText, Button, Card, Screen, color, font, space } from '@/ui';
import { Icon } from '@/ui/icon';
import { Group, Row } from '@/ui/list';
import { Chip } from '@/ui/chip';

function confirmAction(title: string, msg: string, ok: string, run: () => void) {
  if (Platform.OS === 'web') {
    if (confirm(msg)) run();
    return;
  }
  Alert.alert(title, msg, [
    { text: t('Zrušit'), style: 'cancel' },
    { text: ok, style: 'destructive', onPress: run },
  ]);
}

export default function AccountScreen() {
  const cloud = useCloud();
  const [currency, setCurrency] = useStoredState<Currency>('currency', 'CZK');
  const pf = usePortfolios();
  const [newName, setNewName] = useState('');
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const pushOn = usePushEnabled();
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const togglePush = async (on: boolean) => {
    setPushMsg(null);
    setPushBusy(true);
    try {
      if (on) await enablePush();
      else await disablePush();
    } catch (e) {
      setPushMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setPushBusy(false);
    }
  };

  const logout = async () => {
    await disablePush().catch(() => forgetPush());
    await signOut();
  };

  const removeAccount = () =>
    confirmAction(
      t('Smazat účet'),
      t('Trvale smazat účet {0} a všechna jeho data na serveru? Data v tomto telefonu zůstanou. Tuto akci nejde vrátit.', cloud.user?.email ?? ''),
      t('Smazat účet'),
      async () => {
        setDeleting(true);
        try {
          await disablePush().catch(() => forgetPush());
          await deleteAccount();
        } catch (e) {
          setPushMsg(authMessage(e));
        } finally {
          setDeleting(false);
        }
      },
    );

  const status = cloud.syncing
    ? t('Synchronizuji…')
    : cloud.error
      ? t('Synchronizace selhala: {0}', cloud.error)
      : cloud.lastSync
        ? t('Synchronizováno v {0} – stejná data na všech zařízeních.', new Date(cloud.lastSync).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }))
        : t('Čeká na synchronizaci…');

  const changeLang = (l: Lang) => {
    if (l === LANG) return;
    saveLang(l);
    if (Platform.OS === 'web') location.reload();
    else void reloadAppAsync();
  };

  const addPortfolio = () => {
    const name = newName.trim();
    if (!name) return;
    pf.setList([...pf.list, { id: newPortfolioId(), name }]);
    setNewName('');
  };
  const rename = (id: string, name: string) => {
    if (name.trim()) pf.setList(pf.list.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)));
  };
  const remove = (id: string, name: string) =>
    confirmAction(t('Smazat portfolio'), t('Smazat portfolio „{0}“? Jeho položky se přesunou do Hlavního.', name), t('Smazat'), async () => {
      const all = await itemsStore.getAll();
      const now = new Date().toISOString();
      for (const it of all) if (portfolioOf(it) === id) await itemsStore.put({ ...it, portfolioId: undefined, updatedAt: now });
      pf.setList(pf.list.filter((p) => p.id !== id));
      if (pf.active === id) pf.setActive(ALL_ID);
    });

  const exportBackup = async () => {
    setBackupMsg(null);
    try {
      const json = toJson(await itemsStore.getAll(), await wishStore.getAll());
      const name = backupFilename('json');
      if (Platform.OS === 'web') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        a.download = name;
        a.click();
        return;
      }
      const file = new File(Paths.cache, name);
      if (file.exists) file.delete();
      file.create();
      file.write(json);
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: t('Uložit zálohu'), UTI: 'public.json' });
    } catch (e) {
      setBackupMsg(t('Zálohu se nepodařilo vytvořit: {0}', String(e)));
    }
  };

  const initial = (cloud.user?.email ?? '?').slice(0, 1).toUpperCase();

  return (
    <Screen keyboardShouldPersistTaps="handled">
      {/* Profil */}
      {!cloud.ready ? null : cloud.user ? (
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <AppText variant="title" color="#fff">
              {initial}
            </AppText>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong" numberOfLines={1} selectable>
              {cloud.user.email}
            </AppText>
            <View style={styles.syncLine}>
              <View style={[styles.dot, { backgroundColor: cloud.error ? color.neg : cloud.syncing ? color.gold : color.pos }]} />
              <AppText variant="caption" color={cloud.error ? color.neg : color.muted} numberOfLines={2} style={{ flex: 1 }}>
                {status}
              </AppText>
            </View>
          </View>
        </View>
      ) : (
        <Card style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xl }}>
          <View style={[styles.avatar, { backgroundColor: color.surface3 }]}>
            <Icon sf="person.fill" md="person" size={26} color={color.muted} />
          </View>
          <AppText variant="heading">{t('Nepřihlášený')}</AppText>
          <AppText color={color.muted} style={{ textAlign: 'center' }}>
            {t('Data jsou jen v tomto zařízení. S účtem je máš na počítači i telefonu.')}
          </AppText>
          <Button label={t('Přihlásit se')} onPress={() => router.push('/auth')} style={{ alignSelf: 'stretch', marginTop: space.xs }} />
        </Card>
      )}

      {cloud.user && (
        <Group footer={pushMsg ?? undefined}>
          <Row
            sf="arrow.triangle.2.circlepath"
            md="sync"
            tint="#2b9fd6"
            title={t('Synchronizovat teď')}
            onPress={() => void syncNow()}
            right={cloud.syncing ? <ActivityIndicator color={color.accent2} /> : null}
          />
          <Row
            sf="bell.badge.fill"
            md="notifications-active"
            tint="#ff4d6a"
            title={t('Upozornění na ceny')}
            subtitle={t('Jednou denně, když cena překročí tvůj alert nebo klesne na cíl z wishlistu.')}
            right={pushBusy ? <ActivityIndicator color={color.accent2} /> : <Switch value={pushOn} onValueChange={(v) => void togglePush(v)} trackColor={{ true: color.accent }} />}
          />
        </Group>
      )}

      <Group title={t('Nastavení')} footer={t('Částky se ukládají v Kč; € se přepočítává kurzem ČNB.')}>
        <Row
          sf="dollarsign.circle.fill"
          md="currency-exchange"
          tint="#3ddc84"
          title={t('Měna')}
          right={
            <View style={styles.seg}>
              <Chip label={t('Kč')} active={currency === 'CZK'} onPress={() => setCurrency('CZK')} />
              <Chip label="€" active={currency === 'EUR'} onPress={() => setCurrency('EUR')} />
            </View>
          }
        />
        <Row
          sf="globe"
          md="language"
          tint="#8f6bff"
          title={t('Jazyk')}
          right={
            <View style={styles.seg}>
              <Chip label="CZ" active={LANG === 'cs'} onPress={() => changeLang('cs')} />
              <Chip label="EN" active={LANG === 'en'} onPress={() => changeLang('en')} />
            </View>
          }
        />
      </Group>

      <Group title={t('Portfolia')} footer={t('Portfolia se synchronizují s účtem. Mezi portfolii přepínáš nahoře na hlavní obrazovce.')}>
        {pf.list.map((p) => (
          <View key={p.id} style={styles.pfRow}>
            <View style={[styles.tile, { backgroundColor: '#b08a0c' }]}>
              <Icon sf="folder.fill" md="folder" size={15} color="#fff" />
            </View>
            <TextInput
              defaultValue={t(p.name)}
              onEndEditing={(e) => rename(p.id, e.nativeEvent.text)}
              onBlur={(e) => Platform.OS === 'web' && rename(p.id, (e.target as unknown as { value: string }).value)}
              style={styles.pfInput}
              keyboardAppearance="dark"
              accessibilityLabel={t('Název portfolia')}
            />
            {p.id !== MAIN_ID && (
              <Pressable onPress={() => remove(p.id, p.name)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Smazat portfolio')}>
                <Icon sf="minus.circle.fill" md="remove-circle" size={20} color={color.neg} />
              </Pressable>
            )}
          </View>
        ))}
        <View style={styles.pfRow}>
          <View style={[styles.tile, { backgroundColor: color.surface3 }]}>
            <Icon sf="plus" md="add" size={15} color={color.accent2} />
          </View>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            onSubmitEditing={addPortfolio}
            placeholder={t('Nové portfolio, např. Investice')}
            placeholderTextColor={color.faint}
            style={styles.pfInput}
            keyboardAppearance="dark"
            returnKeyType="done"
          />
          {newName.trim() ? (
            <Pressable onPress={addPortfolio} hitSlop={10} accessibilityRole="button">
              <AppText variant="label" color={color.accent2}>
                {t('Přidat')}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </Group>

      <Group title={t('Data')} footer={backupMsg ?? t('Záloha je soubor JSON ve stejném formátu jako na webu – jde nahrát zpět.')}>
        <Row sf="square.and.arrow.up.fill" md="ios-share" tint="#6d5cff" title={t('Exportovat zálohu')} onPress={() => void exportBackup()} chevron />
      </Group>

      <Group title={t('Podpora')} footer={`SealedVault ${Constants.expoConfig?.version ?? ''}`}>
        <Row
          sf="envelope.fill"
          md="mail"
          tint="#4f7dff"
          title={t('Napsat podpoře')}
          subtitle={SUPPORT_EMAIL}
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('SealedVault – mobilní appka')}`)}
          chevron
        />
      </Group>

      {cloud.user && (
        <Group footer={t('Smazání účtu odstraní všechna data na serveru. Data v tomto telefonu zůstanou.')}>
          <Row
            sf="rectangle.portrait.and.arrow.right"
            md="logout"
            tint="#60606f"
            title={t('Odhlásit se')}
            onPress={() => confirmAction(t('Odhlásit se'), t('Odhlásit se? Data zůstanou v tomto zařízení.'), t('Odhlásit se'), () => void logout())}
          />
          <Row sf="trash.fill" md="delete" tint="#ff4d6a" title={t('Smazat účet')} destructive onPress={removeAccount} right={deleting ? <ActivityIndicator color={color.neg} /> : null} />
        </Group>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingVertical: space.sm },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: color.accent },
  syncLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  seg: { flexDirection: 'row', gap: 6 },
  tile: { width: 28, height: 28, borderRadius: 8, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  pfRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 52 },
  pfInput: { flex: 1, minHeight: 44, color: color.text, fontFamily: font.body, fontSize: 16 },
});
