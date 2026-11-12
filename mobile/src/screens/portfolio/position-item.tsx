import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { memo } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import type { PriceChange } from '@/core/changes';
import { money, pct, signedMoney, tone } from '@/core/format';
import { t } from '@/core/i18n';
import type { Position } from '@/core/portfolio';
import type { Currency } from '@/core/types';
import { items as itemsStore } from '@/db/store';
import { AppText, color, font, radius, space, toneColor } from '@/ui';
import { ProductThumb } from '@/ui/product-thumb';

export type ItemProps = { p: Position; first?: boolean; last?: boolean; currency: Currency; change?: PriceChange; spark?: number[]; marketUrl?: string };

function confirmDelete(p: Position) {
  const run = async () => {
    for (const l of p.lots) await itemsStore.remove(l.id);
  };
  const msg = t('Smazat {0} včetně všech nákupů a prodejů? Tuto akci nejde vrátit.', p.name);
  if (Platform.OS === 'web') {
    if (confirm(msg)) void run();
    return;
  }
  Alert.alert(t('Smazat produkt'), msg, [
    { text: t('Zrušit'), style: 'cancel' },
    { text: t('Smazat'), style: 'destructive', onPress: () => void run() },
  ]);
}

/** Odkaz na detail + dlouhé podržení: náhled a rychlé akce (to web nemá) */
function Linked({ p, marketUrl, children }: { p: Position; marketUrl?: string; children: (pressed: boolean) => React.ReactNode }) {
  return (
    <Link href={{ pathname: '/product/[key]', params: { key: p.key } }} asChild>
      <Link.Trigger>
        <Pressable accessibilityRole="button">{({ pressed }) => children(pressed)}</Pressable>
      </Link.Trigger>
      <Link.Preview />
      <Link.Menu>
        {p.stats.held > 0 ? <Link.MenuAction title={t('Prodat')} icon="banknote" onPress={() => router.push({ pathname: '/sell/[key]', params: { key: p.key } })} /> : null}
        <Link.MenuAction title={t('Přidat další nákup')} icon="plus.circle" onPress={() => router.push({ pathname: '/add', params: { from: p.key } })} />
        {marketUrl ? <Link.MenuAction title={t('Otevřít na trhu')} icon="safari" onPress={() => void WebBrowser.openBrowserAsync(marketUrl)} /> : null}
        <Link.MenuAction title={t('Smazat')} icon="trash" destructive onPress={() => confirmDelete(p)} />
      </Link.Menu>
    </Link>
  );
}

/** Štítek s počtem kusů přes roh obrázku (jako na webu) */
function QtyBadge({ n }: { n: number }) {
  return (
    <View style={styles.qty}>
      <AppText style={styles.qtyText} tabular>
        {n}×
      </AppText>
    </View>
  );
}

/** Řádek seznamu: obrázek s počtem, název + edice, vpravo hodnota, zisk a cena za kus */
export const PositionRow = memo(function PositionRow({ p, first, last, currency, change, marketUrl }: ItemProps) {
  const d1 = change?.d1;
  const tn = tone(p.stats.profit);
  return (
    <Linked p={p} marketUrl={marketUrl}>
      {(pressed) => (
        <View style={[styles.row, first && styles.first, last && styles.last, !first && styles.divider, pressed && { backgroundColor: color.surface2 }]}>
          <View>
            <ProductThumb item={p.head} size={50} />
            <QtyBadge n={p.stats.held} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <AppText variant="label" numberOfLines={2} style={{ fontFamily: font.semibold }}>
              {p.name}
            </AppText>
            <View style={styles.sub}>
              <AppText variant="caption" color={color.muted} numberOfLines={1} style={{ flexShrink: 1 }}>
                {p.head.set || t(p.head.type)}
              </AppText>
              {d1 != null && Math.abs(d1) >= 0.05 ? (
                <AppText variant="caption" tabular color={toneColor[tone(d1)]}>
                  {pct(d1)}
                </AppText>
              ) : null}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <AppText variant="bodyStrong" tabular>
              {money(p.stats.value, currency)}
            </AppText>
            <AppText variant="caption" tabular color={toneColor[tn]}>
              {signedMoney(p.stats.profit, currency)} {pct(p.stats.profitPct)}
            </AppText>
            <AppText variant="caption" tabular color={color.faint}>
              {p.stats.held} × {money(p.head.currentPrice, currency)}
            </AppText>
          </View>
        </View>
      )}
    </Linked>
  );
});

/** Dlaždice mřížky: velký obrázek, název, hodnota a zisk */
export const PositionCard = memo(function PositionCard({ p, currency, marketUrl }: ItemProps) {
  const tn = tone(p.stats.profit);
  return (
    <Linked p={p} marketUrl={marketUrl}>
      {(pressed) => (
        <View style={[styles.card, pressed && { transform: [{ scale: 0.98 }], backgroundColor: color.surface2 }]}>
          <View style={styles.cardMedia}>
            <ProductThumb item={p.head} size={112} />
            <QtyBadge n={p.stats.held} />
          </View>
          <AppText variant="caption" numberOfLines={2} style={{ fontFamily: font.semibold, minHeight: 34 }}>
            {p.name}
          </AppText>
          <AppText variant="bodyStrong" tabular>
            {money(p.stats.value, currency)}
          </AppText>
          <AppText variant="caption" tabular color={toneColor[tn]}>
            {pct(p.stats.profitPct)}
          </AppText>
        </View>
      )}
    </Linked>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    backgroundColor: color.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
  },
  first: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  last: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qty: {
    position: 'absolute',
    left: -4,
    bottom: -4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: '#1f1f2a',
    borderWidth: 1.5,
    borderColor: color.bg,
  },
  qtyText: { fontFamily: 'Inter_700Bold', fontSize: 11, lineHeight: 14, color: color.text },
  card: {
    flex: 1,
    gap: 4,
    padding: space.md,
    margin: space.xs + 2,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
  },
  cardMedia: { alignSelf: 'center', marginBottom: space.xs },
});
