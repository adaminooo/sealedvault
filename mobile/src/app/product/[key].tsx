import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { heldQty, unitCost } from '@/core/calc';
import { date, displayMoney, money, pct, signedMoney, toDisplay, tone } from '@/core/format';
import { HISTORY_START } from '@/core/history';
import { t } from '@/core/i18n';
import { productUrl, SOURCE_LABEL } from '@/core/market';
import { groupPositions } from '@/core/portfolio';
import { isoDaysAgo, seriesInCzk } from '@/core/trend';
import type { Currency } from '@/core/types';
import { useHistory, useMarket } from '@/data/queries';
import { useStoredState } from '@/data/use-stored-state';
import { items as itemsStore, useCollection } from '@/db/store';
import { confirmDelete } from '@/screens/portfolio/position-item';
import { AlertsCard } from '@/screens/product/alerts-card';
import { AppText, Button, Card, Screen, color, space, toneColor } from '@/ui';
import { Segmented } from '@/ui/segmented';
import { Icon } from '@/ui/icon';
import { LineChart } from '@/ui/line-chart';
import { PhotoStrip } from '@/ui/photo-strip';
import { TrendPill } from '@/ui/pill';
import { ProductThumb } from '@/ui/product-thumb';

const RANGES = { '1M': 30, '3M': 90, '1R': 365, [`ALL`]: 0 } as const;
type Range = keyof typeof RANGES;
type IconProps = ComponentProps<typeof Icon>;

/** Detail produktu: velký obrázek, cena s grafem a kurzorem, souhrn pozice, alert, trh a nákupy */
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
    else if (s.length) s[s.length - 1] = [today, p.head.currentPrice];
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
  const sell = () => router.push({ pathname: '/sell/[key]', params: { key: p.key } });
  const addLot = () => router.push({ pathname: '/add', params: { from: p.key } });
  const remove = () => confirmDelete(p, () => (router.canGoBack() ? router.back() : router.replace('/')));

  return (
    <Screen>
      <Stack.Screen options={{ title: '' }} />
      {process.env.EXPO_OS === 'ios' && (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel={t('Další akce')}>
            {s.held > 0 ? (
              <Stack.Toolbar.MenuAction icon="banknote" onPress={sell}>
                {t('Prodat')}
              </Stack.Toolbar.MenuAction>
            ) : null}
            <Stack.Toolbar.MenuAction icon="plus.circle" onPress={addLot}>
              {t('Přidat další nákup')}
            </Stack.Toolbar.MenuAction>
            {product ? (
              <Stack.Toolbar.MenuAction icon="safari" onPress={() => void WebBrowser.openBrowserAsync(productUrl(product))}>
                {t('Otevřít na trhu')}
              </Stack.Toolbar.MenuAction>
            ) : null}
            <Stack.Toolbar.MenuAction icon="trash" destructive onPress={remove}>
              {t('Smazat produkt')}
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      )}

      <View style={styles.hero}>
        <LinearGradient colors={['rgba(143,107,255,0.22)', 'transparent']} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
        <ProductThumb item={p.head} size={148} />
        <AppText variant="title" style={{ textAlign: 'center' }} numberOfLines={3} selectable>
          {p.name}
        </AppText>
        <AppText variant="caption" color={color.muted} style={{ textAlign: 'center' }}>
          {[p.game, p.head.set, t(p.head.type)].filter(Boolean).join(' · ')}
        </AppText>
      </View>

      <Card>
        <AppText variant="overline" color={color.muted}>
          {scrub != null && shown ? date(shown[0]) : t('Cena za kus')}
        </AppText>
        <AppText variant="hero" tabular selectable>
          {money(shown?.[1] ?? p.head.currentPrice, currency)}
        </AppText>
        {rangeChange != null && <TrendPill tone={tone(rangeChange)} label={`${pct(rangeChange)} ${scrub == null ? t('za období') : t('od začátku období')}`} />}
        {points.length >= 2 ? (
          <LineChart points={points} color={chartColor} height={210} formatY={(v) => displayMoney(toDisplay(v, currency), currency, true)} onScrub={setScrub} />
        ) : (
          <AppText variant="caption" color={color.faint} style={{ paddingVertical: space.xl, textAlign: 'center' }}>
            {id ? (hist.isLoading ? t('Načítám historii…') : t('Pro tento produkt zatím není historie cen.')) : t('Produkt není spárovaný s trhem – historie cen není k dispozici.')}
          </AppText>
        )}
        <Segmented<Range> stretch options={(Object.keys(RANGES) as Range[]).map((r) => ({ value: r, label: r === 'ALL' ? t('Vše') : t(r) }))} value={range} onChange={setRange} />
      </Card>

      <Card>
        <View style={styles.tiles}>
          <Tile sf="shippingbox" md="inventory-2" label={t('Držíš')} value={`${s.held} ${t('ks')}`} />
          <Tile sf="banknote" md="payments" label={t('Hodnota')} value={money(s.value, currency)} />
          <Tile sf="cart" md="shopping-cart" label={t('Ø nákup / ks')} value={money(p.avgCost, currency)} />
          <Tile sf="chart.line.uptrend.xyaxis" md="trending-up" label={t('Profit')} value={signedMoney(s.profit, currency)} sub={pct(s.profitPct)} tint={toneColor[tone(s.profit)]} />
          <Tile sf="creditcard" md="credit-card" label={t('Investováno')} value={money(s.cost, currency)} />
          {s.sold > 0 && <Tile sf="checkmark.seal" md="verified" label={t('Realizovaný zisk')} value={signedMoney(s.realized, currency)} tint={toneColor[tone(s.realized)]} />}
        </View>
      </Card>

      {s.held > 0 && <AlertsCard key={p.key} position={p} currency={currency} />}

      {p.lots.some((l) => l.photos?.length) && <PhotoStrip photos={p.lots.flatMap((l) => l.photos ?? [])} />}

      {product && (
        <Pressable onPress={() => void WebBrowser.openBrowserAsync(productUrl(product))} accessibilityRole="link">
          {({ pressed }) => (
            <Card style={[styles.linkCard, pressed && { opacity: 0.7 }]}>
              <Icon sf="storefront" md="storefront" size={20} color={color.accent2} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{SOURCE_LABEL[product.source]}</AppText>
                <AppText variant="caption" color={color.muted} numberOfLines={1}>
                  {product.name}
                </AppText>
              </View>
              <Icon sf="arrow.up.right" md="open-in-new" size={16} color={color.accent2} />
            </Card>
          )}
        </Pressable>
      )}

      <AppText variant="overline" color={color.muted}>
        {t('Nákupy')}
      </AppText>
      <Card style={{ gap: 0, paddingVertical: space.xs }}>
        {p.lots.map((l, i) => (
          <Pressable
            key={l.id}
            onPress={() => router.push({ pathname: '/add', params: { id: l.id } })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.lot, i > 0 && styles.divider, pressed && { opacity: 0.6 }]}>
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
            <TrendPill small tone={tone(l.currentPrice - unitCost(l))} label={pct(unitCost(l) > 0 ? ((l.currentPrice - unitCost(l)) / unitCost(l)) * 100 : null)} />
            <Icon sf="chevron.right" md="chevron-right" size={13} color={color.faint} />
          </Pressable>
        ))}
      </Card>

      <View style={styles.actions}>
        {s.held > 0 && <Button style={{ flex: 1 }} label={t('Prodat')} onPress={sell} />}
        <Button style={{ flex: 1 }} variant="secondary" label={t('Další nákup')} onPress={addLot} />
      </View>
      <Pressable onPress={remove} style={styles.delete} accessibilityRole="button">
        <AppText variant="bodyStrong" color={color.neg}>
          {t('Smazat produkt')}
        </AppText>
      </Pressable>
    </Screen>
  );
}

/** Dlaždice s jedním číslem (dvě vedle sebe) */
function Tile({ sf, md, label, value, sub, tint }: { sf: IconProps['sf']; md: IconProps['md']; label: string; value: string; sub?: string; tint?: string }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileHead}>
        <Icon sf={sf} md={md} size={14} color={color.muted} />
        <AppText variant="caption" color={color.muted}>
          {label}
        </AppText>
      </View>
      <AppText variant="heading" tabular color={tint} numberOfLines={1} adjustsFontSizeToFit selectable>
        {value}
      </AppText>
      {sub ? (
        <AppText variant="caption" tabular color={tint}>
          {sub}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, paddingTop: space.md, paddingBottom: space.md, paddingHorizontal: space.lg, marginHorizontal: -space.lg },
  // údaje ve dvou sloupcích v jednom bloku – stejně jako Výkon v Analýze
  tiles: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  tile: { width: '50%', gap: 4, paddingRight: space.md },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  lot: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  actions: { flexDirection: 'row', gap: space.sm },
  delete: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
