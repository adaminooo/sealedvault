import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';

import { numStr, parseNum, todayIso } from '@/core/form';
import { fromDisplay, money, signedMoney, toDisplay, tone } from '@/core/format';
import { t } from '@/core/i18n';
import { allocateSale, groupPositions, type SaleInput } from '@/core/portfolio';
import type { Currency } from '@/core/types';
import { useStoredState } from '@/data/use-stored-state';
import { items as itemsStore, useCollection } from '@/db/store';
import { AppText, Button, Card, color, space, toneColor } from '@/ui';
import { DateField } from '@/ui/date-field';
import { Field } from '@/ui/field';
import { Stepper } from '@/ui/stepper';

/** Prodej kusů z pozice – odečte se od nejstarších nákupů (FIFO), s náhledem zisku */
export default function SellScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const all = useCollection(itemsStore);
  const p = useMemo(() => groupPositions(all).find((x) => x.key === key), [all, key]);
  const [currency] = useStoredState<Currency>('currency', 'CZK');
  const held = p?.stats.held ?? 0;

  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(() => (p ? numStr(toDisplay(p.head.currentPrice, currency)) : ''));
  const [fees, setFees] = useState('');
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!p || held < 1) {
    return (
      <View style={styles.content}>
        <AppText color={color.muted}>{all.length ? t('Z této položky už nic nedržíš.') : ''}</AppText>
      </View>
    );
  }

  const cur = currency === 'CZK' ? t('Kč') : '€';
  const pr = price.trim() ? parseNum(price) : toDisplay(p.head.currentPrice, currency);
  const f = fees.trim() ? parseNum(fees) : 0;
  const valid = qty >= 1 && qty <= held && Number.isFinite(pr) && pr >= 0 && Number.isFinite(f) && f >= 0;
  const input: SaleInput | null = valid ? { date, quantity: qty, price: fromDisplay(pr, currency), fees: fromDisplay(f, currency), note: note.trim() || undefined } : null;
  const preview = input ? allocateSale(p.lots, input) : null;
  const revenue = input ? input.quantity * input.price - input.fees : 0;

  const submit = async () => {
    if (!preview) return setError(t('Zadej počet 1–{0} a platnou cenu.', held));
    setSaving(true);
    try {
      for (const lot of preview.updated) await itemsStore.put(lot);
      if (process.env.EXPO_OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <AppText color={color.muted}>{t('Prodáváš z {0} – držíš {1} ks. Kusy se odečtou od nejstarších nákupů.', p.name, held)}</AppText>

        <Card style={{ gap: space.lg }}>
          <Stepper label={t('Počet kusů')} value={qty} onChange={setQty} max={held} />
          <Field label={t('Prodejní cena za kus ({0})', cur)} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder={numStr(toDisplay(p.head.currentPrice, currency))} />
          <Field label={t('Poplatky a poštovné celkem ({0})', cur)} value={fees} onChangeText={setFees} keyboardType="decimal-pad" placeholder="0" />
          <DateField label={t('Datum prodeje')} value={date} onChange={setDate} />
          <Field label={t('Poznámka')} value={note} onChangeText={setNote} placeholder={t('např. Vinted, kupec…')} />
        </Card>

        {preview && (
          <Card>
            <Row label={t('Tržba po poplatcích')} value={money(revenue, currency)} />
            <Row label={t('Zisk z prodeje')} value={signedMoney(preview.realized, currency)} tint={toneColor[tone(preview.realized)]} />
          </Card>
        )}

        {error && <AppText color={color.neg}>{error}</AppText>}
        {saving ? <ActivityIndicator color={color.accent2} style={{ minHeight: 50 }} /> : <Button label={t('Prodat {0} ks', qty)} onPress={() => void submit()} disabled={!preview} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Row({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.row}>
      <AppText color={color.muted}>{label}</AppText>
      <AppText variant="bodyStrong" tabular color={tint}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
});
