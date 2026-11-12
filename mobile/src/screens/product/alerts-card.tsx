import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { numStr, parseNum } from '@/core/form';
import { fromDisplay, toDisplay } from '@/core/format';
import { t } from '@/core/i18n';
import type { Position } from '@/core/portfolio';
import type { Currency } from '@/core/types';
import { items as itemsStore } from '@/db/store';
import { usePushEnabled } from '@/sync/push';
import { AppText, Button, Card, color, space } from '@/ui';
import { Field } from '@/ui/field';

/**
 * Cenový alert pozice: upozorní, když cena stoupne nad / klesne pod hranici.
 * Ukládá se do všech nákupů produktu (alertAbove / alertBelow) – stejně jako na webu, takže platí všude.
 */
export function AlertsCard({ position: p, currency }: { position: Position; currency: Currency }) {
  const curAbove = p.lots.find((l) => l.alertAbove)?.alertAbove;
  const curBelow = p.lots.find((l) => l.alertBelow)?.alertBelow;
  const [above, setAbove] = useState(numStr(curAbove ? toDisplay(curAbove, currency) : undefined));
  const [below, setBelow] = useState(numStr(curBelow ? toDisplay(curBelow, currency) : undefined));
  const [msg, setMsg] = useState<string | null>(null);
  const pushOn = usePushEnabled();
  const cur = currency === 'CZK' ? t('Kč') : '€';

  const save = async () => {
    const a = above.trim() ? parseNum(above) : undefined;
    const b = below.trim() ? parseNum(below) : undefined;
    if ((a !== undefined && !(a > 0)) || (b !== undefined && !(b > 0))) return setMsg(t('Zadej kladnou cenu, nebo pole nech prázdné.'));
    const aCzk = a !== undefined ? fromDisplay(a, currency) : undefined;
    const bCzk = b !== undefined ? fromDisplay(b, currency) : undefined;
    const now = new Date().toISOString();
    for (const l of p.lots) await itemsStore.put({ ...l, alertAbove: aCzk, alertBelow: bCzk, updatedAt: now });
    if (process.env.EXPO_OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMsg(aCzk || bCzk ? t('Cenový alert uložen') : t('Cenový alert vypnut'));
  };

  return (
    <Card style={{ gap: space.md }}>
      <AppText variant="bodyStrong">{t('Cenový alert')}</AppText>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label={t('Nad ({0})', cur)} value={above} onChangeText={setAbove} keyboardType="decimal-pad" placeholder="—" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('Pod ({0})', cur)} value={below} onChangeText={setBelow} keyboardType="decimal-pad" placeholder="—" />
        </View>
      </View>
      <Button variant="secondary" label={t('Uložit alert')} onPress={() => void save()} />
      {msg && (
        <AppText variant="caption" color={color.muted}>
          {msg}
        </AppText>
      )}
      {!pushOn && (
        <AppText variant="caption" color={color.faint}>
          {t('Aby alert přišel do telefonu, zapni Upozornění na ceny v záložce Účet.')}
        </AppText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: space.md } });
