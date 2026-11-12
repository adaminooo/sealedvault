import Constants from 'expo-constants';
import { reloadAppAsync } from 'expo';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SUPPORT_EMAIL } from '@/config';
import { backupFilename, toJson } from '@/core/backup';
import { LANG, LOCALE, saveLang, t, type Lang } from '@/core/i18n';
import { ALL_ID, MAIN_ID, newPortfolioId, portfolioOf } from '@/core/portfolios';
import type { Currency } from '@/core/types';
import { usePortfolios } from '@/data/use-portfolio';
import { useStoredState } from '@/data/use-stored-state';
import { items as itemsStore, wishlist as wishStore } from '@/db/store';
import { signOut, syncNow, useCloud } from '@/sync/cloud';
import { AppText, Button, Card, Screen, color, font, radius, space } from '@/ui';
import { Chip, ChipRow } from '@/ui/chip';

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

  return (
    <Screen keyboardShouldPersistTaps="handled">
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
            <View style={styles.row2}>
              <Button style={{ flex: 1 }} label={t('Synchronizovat')} variant="secondary" onPress={() => void syncNow()} disabled={cloud.syncing} />
              <Button
                style={{ flex: 1 }}
                label={t('Odhlásit se')}
                variant="secondary"
                onPress={() => confirmAction(t('Odhlásit se'), t('Odhlásit se? Data zůstanou v tomto zařízení.'), t('Odhlásit se'), () => void signOut())}
              />
            </View>
          </>
        ) : (
          <>
            <AppText variant="heading">{t('Nepřihlášený')}</AppText>
            <AppText color={color.muted}>{t('Data jsou jen v tomto zařízení. S účtem je máš na počítači i telefonu.')}</AppText>
            <Button label={t('Přihlásit se')} onPress={() => router.push('/auth')} />
          </>
        )}
      </Card>

      <Section title={t('Nastavení')}>
        <Card style={{ gap: space.md }}>
          <Setting label={t('Měna')}>
            <Chip label={t('Kč')} active={currency === 'CZK'} onPress={() => setCurrency('CZK')} />
            <Chip label="€" active={currency === 'EUR'} onPress={() => setCurrency('EUR')} />
          </Setting>
          <Setting label={t('Jazyk')}>
            <Chip label="Čeština" active={LANG === 'cs'} onPress={() => changeLang('cs')} />
            <Chip label="English" active={LANG === 'en'} onPress={() => changeLang('en')} />
          </Setting>
          <AppText variant="caption" color={color.faint}>
            {t('Částky se ukládají v Kč; € se přepočítává kurzem ČNB.')}
          </AppText>
        </Card>
      </Section>

      <Section title={t('Portfolia')}>
        <Card style={{ gap: space.sm }}>
          {pf.list.map((p) => (
            <View key={p.id} style={styles.pfRow}>
              <TextInput
                defaultValue={t(p.name)}
                onEndEditing={(e) => rename(p.id, e.nativeEvent.text)}
                onBlur={(e) => Platform.OS === 'web' && rename(p.id, (e.target as unknown as { value: string }).value)}
                style={styles.pfInput}
                keyboardAppearance="dark"
                accessibilityLabel={t('Název portfolia')}
              />
              {p.id !== MAIN_ID && (
                <Pressable onPress={() => remove(p.id, p.name)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Smazat portfolio')}>
                  <AppText variant="label" color={color.neg}>
                    {t('Smazat')}
                  </AppText>
                </Pressable>
              )}
            </View>
          ))}
          <View style={styles.pfRow}>
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
            <Pressable onPress={addPortfolio} hitSlop={8} accessibilityRole="button" disabled={!newName.trim()}>
              <AppText variant="label" color={newName.trim() ? color.accent2 : color.faint}>
                {t('Přidat')}
              </AppText>
            </Pressable>
          </View>
          <AppText variant="caption" color={color.faint}>
            {t('Portfolia se synchronizují s účtem. Mezi portfolii přepínáš nahoře na hlavní obrazovce.')}
          </AppText>
        </Card>
      </Section>

      <Section title={t('Záloha')}>
        <Card>
          <AppText color={color.muted}>{t('Uloží všechna data do souboru JSON – stejný formát jako na webu, jde nahrát zpět.')}</AppText>
          <Button label={t('Exportovat zálohu')} variant="secondary" onPress={() => void exportBackup()} />
          {backupMsg && <AppText color={color.neg}>{backupMsg}</AppText>}
        </Card>
      </Section>

      <Section title={t('Podpora')}>
        <Card>
          <Pressable onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('SealedVault – mobilní appka')}`)} accessibilityRole="link">
            <AppText color={color.accent2}>{SUPPORT_EMAIL}</AppText>
          </Pressable>
          <AppText variant="caption" color={color.faint}>
            SealedVault {Constants.expoConfig?.version ?? ''}
          </AppText>
        </Card>
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="heading">{title}</AppText>
      {children}
    </View>
  );
}

function Setting({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="label" color={color.muted}>
        {label}
      </AppText>
      <ChipRow>{children}</ChipRow>
    </View>
  );
}

const styles = StyleSheet.create({
  row2: { flexDirection: 'row', gap: space.sm },
  pfRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pfInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    backgroundColor: color.surface2,
    paddingHorizontal: space.md,
    color: color.text,
    fontFamily: font.body,
    fontSize: 16,
  },
});
