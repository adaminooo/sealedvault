import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { heldQty, unitCost } from '@/core/calc';
import { date, money, pct, signedMoney, tone } from '@/core/format';
import { HISTORY_START } from '@/core/history';
import { t } from '@/core/i18n';
import { productUrl, SOURCE_LABEL } from '@/core/market';
import { groupPositions } from '@/core/portfolio';
import { isoDaysAgo, seriesInCzk } from '@/core/trend';
import type { Currency } from '@/core/types';
import { useHistory, useMarket } from '@/data/queries';
import { useStoredState } from '@/data/use-stored-state';
import { items as itemsStore, useCollection } from '@/db/store';
import { AppText, Button, Card, Screen, color, space, toneColor } from '@/ui';
import { Chip, ChipRow } from '@/ui/chip';
import { LineChart } from '@/ui/line-chart';
import { PhotoStrip } from '@/ui/photo-strip';
import { ProductThumb } from '@/ui/product-thumb';
import { AlertsCard } from '@/screens/product/alerts-card';

const RANGES = { '1M': 30, '3M': 90, '1R': 365, [`ALL`]: 0 } as const;
type Range = keyof typeof RANGES;

/** Detail produktu: graf ceny s kurzorem, souhrn pozice, trh a nákupní dávky */
export default function ProductScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const all = useCollection(itemsStore);
  const [currency] = useStoredState<Currency>('currency', 'CZK');
  const p = useMemo(() => groupPositions(all).find((x) => x.key === key), [all, key]);
  const { data: market } = useMarket();
  const id = p?.head.cmProductId;
  const hist = useHistory(id ? [id] : [], HISTORY_START);
  const [range, setRange] = useState<Range>('3M');
  const [scrub, setScrub] = useState<number | null>(null);

  const points = useMemo(() => {
    if (!p) return [];
    const from = RANGES[range] ? isoDaysAgo(RANGES[range]) : '';
    const s = seriesInCzk(hist.data ?? null, id).filter(([d]) => d >= from);
    const today = new Date().toISOString().slice(0, 10);
    // dnešek = aktuální cena položky (stejná jako v seznamu)
    if (s.length && s[s.length - 1][0] < today) s.push([today, p.head.currentPrice]);
    return s;
  }, [hist.data, id, range, p]);

  if (!p) {
    // data se ještě načítají
    if (!all.length) return <Screen>{null}</Screen>;
    return (
      <Screen>
        <Stack.Screen options={{ title: '' }} />
        <AppText color={color.muted}>{t('Položka už v portfoliu není.')}</AppText>
      </Screen>
    );
  }

  const product = id ? market?.byId.get(id) : undefined;
  const shown = scrub != null ? points[scrub] : points[points.length - 1];
  const first = points[0]?.[1];
  const rangeChange = first && shown ? ((shown[1] - first) / first) * 100 : null;
  const chartColor = rangeChange == null || rangeChange >= 0 ? color.pos : color.neg;
  const s = p.stats;

  return (
    <Screen>
      <Stack.Screen options={{ title: t('Detail') }} />

      <View style={styles.head}>
        <ProductThumb item={p.head} size={72} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading" numberOfLines={3}>
            {p.name}
          </AppText>
          <AppText variant="caption" color={color.muted}>
            {[p.game, p.head.set, t(p.head.type)].filter(Boolean).join(' · ')}
          </AppText>
        </View>
      </View>

      <Card>
        <AppText variant="overline" color={color.muted}>
          {scrub != null && shown ? date(shown[0]) : t('Cena za kus')}
        </AppText>
        <AppText variant="title" tabular>
          {money(shown?.[1] ?? p.head.currentPrice, currency)}
        </AppText>
        {rangeChange != null && (
          <AppText variant="label" tabular color={toneColor[tone(rangeChange)]}>
            {pct(rangeChange)} {scrub == null ? t('za období') : t('od začátku období')}
          </AppText>
        )}
        {points.length >= 2 ? (
          <LineChart points={points} color={chartColor} height={190} onScrub={setScrub} />
        ) : (
          <AppText variant="caption" color={color.faint} style={{ paddingVertical: space.xl, textAlign: 'center' }}>
            {id ? (hist.isLoading ? t('Načítám historii…') : t('Pro tento produkt zatím není historie cen.')) : t('Produkt není spárovaný s trhem – historie cen není k dispozici.')}
          </AppText>
        )}
        <ChipRow>
          {(Object.keys(RANGES) as Range[]).map((r) => (
            <Chip key={r} label={r === 'ALL' ? t('Vše') : t(r)} active={range === r} onPress={() => setRange(r)} />
          ))}
        </ChipRow>
      </Card>

      <Card>
        <Stat label={t('Držíš')} value={`${s.held} ${t('ks')}`} />
        <Stat label={t('Hodnota')} value={money(s.value, currency)} />
        <Stat label={t('Průměrná nákupní cena')} value={money(p.avgCost, currency)} />
        <Stat label={t('Investováno')} value={money(s.cost, currency)} />
        <Stat label={t('Profit')} value={`${signedMoney(s.profit, currency)} · ${pct(s.profitPct)}`} tint={toneColor[tone(s.profit)]} />
        {s.sold > 0 && <Stat label={t('Realizovaný zisk')} value={signedMoney(s.realized, currency)} tint={toneColor[tone(s.realized)]} />}
      </Card>

      {s.held > 0 && <AlertsCard key={p.key} position={p} currency={currency} />}

      {p.lots.some((l) => l.photos?.length) && <PhotoStrip photos={p.lots.flatMap((l) => l.photos ?? [])} />}

      {product && (
        <Pressable onPress={() => void WebBrowser.openBrowserAsync(productUrl(product))} accessibilityRole="link">
          <Card style={styles.linkCard}>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{SOURCE_LABEL[product.source]}</AppText>
              <AppText variant="caption" color={color.muted} numberOfLines={1}>
                {product.name}
              </AppText>
            </View>
            <AppText variant="label" color={color.accent2}>
              {t('Otevřít')} ↗
            </AppText>
          </Card>
        </Pressable>
      )}

      <AppText variant="overline" color={color.muted}>
        {t('Nákupy')}
      </AppText>
      <Card style={{ gap: 0, paddingVertical: space.xs }}>
        {p.lots.map((l, i) => (
          <Pressable key={l.id} onPress={() => router.push({ pathname: '/add', params: { id: l.id } })} accessibilityRole="button" style={({ pressed }) => [styles.lot, i > 0 && styles.divider, pressed && { opacity: 0.6 }]}>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">
                {l.quantity}× {money(unitCost(l), currency)}
              </AppText>
              <AppText variant="caption" color={color.muted}>
                {date(l.buyDate)}
                {l.sales?.length ? ` · ${t('prodáno {0} ks', l.quantity - heldQty(l))}` : ''}
                {l.note ? ` · ${l.note}` : ''}
              </AppText>
            </View>
            <AppText variant="label" tabular color={toneColor[tone(l.currentPrice - unitCost(l))]}>
              {pct(unitCost(l) > 0 ? ((l.currentPrice - unitCost(l)) / unitCost(l)) * 100 : null)}
            </AppText>
          </Pressable>
        ))}
      </Card>

      <View style={{ gap: space.sm }}>
        {s.held > 0 && <Button label={t('Prodat')} onPress={() => router.push({ pathname: '/sell/[key]', params: { key: p.key } })} />}
        <Button variant="secondary" label={t('Přidat další nákup')} onPress={() => router.push({ pathname: '/add', params: { from: p.key } })} />
      </View>
    </Screen>
  );
}

function Stat({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.stat}>
      <AppText color={color.muted}>{label}</AppText>
      <AppText variant="bodyStrong" tabular color={tint}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
  stat: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: 2 },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  lot: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
});
