import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { memo, type ReactNode } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import type { PriceChange } from '@/core/changes';
import { money, pct, signedMoney, tone } from '@/core/format';
import { t } from '@/core/i18n';
import type { Position } from '@/core/portfolio';
import type { Currency } from '@/core/types';
import { items as itemsStore } from '@/db/store';
import { AppText, color, font, gameColor, radius, space, toneColor } from '@/ui';
import { Glow } from '@/ui/glow';
import { TrendPill } from '@/ui/pill';
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

/** Odkaz na detail + dlouhé podržení: náhled a rychlé akce */
function Linked({ p, marketUrl, children }: { p: Position; marketUrl?: string; children: (pressed: boolean) => ReactNode }) {
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

/** Obrázek produktu (jednotné zaoblení) se štítkem počtu kusů */
function Media({ p, size }: { p: Position; size: number }) {
  return (
    <View>
      <ProductThumb item={p.head} size={size} />
      <View style={styles.qty}>
        <AppText style={styles.qtyText} tabular>
          {p.stats.held}×
        </AppText>
      </View>
    </View>
  );
}

/**
 * Řádek seznamu jako samostatná karta:
 *  vlevo obrázek s počtem kusů, uprostřed název, hra · edice a cena za kus (+ dnešní změna),
 *  vpravo hodnota, zisk v % (štítek) a zisk v Kč.
 */
export const PositionRow = memo(function PositionRow({ p, currency, change, marketUrl }: ItemProps) {
  const d1 = change?.d1;
  const tn = tone(p.stats.profit);
  return (
    <Linked p={p} marketUrl={marketUrl}>
      {(pressed) => (
        <View style={[styles.row, pressed && styles.pressed]}>
          <Media p={p} size={56} />
          <View style={styles.middle}>
            <AppText variant="label" numberOfLines={2} style={{ fontFamily: font.semibold }}>
              {p.name}
            </AppText>
            <View style={styles.meta}>
              <View style={[styles.dot, { backgroundColor: gameColor[p.game][0] }]} />
              <AppText variant="caption" color={color.muted} numberOfLines={1} style={{ flexShrink: 1 }}>
                {p.head.set || t(p.head.type)}
              </AppText>
            </View>
            <View style={[styles.meta, styles.wrap]}>
              <AppText variant="caption" tabular color={color.faint} numberOfLines={1}>
                {money(p.head.currentPrice, currency)}/{t('ks')}
              </AppText>
              {d1 != null && Math.abs(d1) >= 0.05 ? (
                <AppText variant="caption" tabular color={toneColor[tone(d1)]}>
                  {t('dnes')} {pct(d1)}
                </AppText>
              ) : null}
            </View>
          </View>
          <View style={styles.right}>
            <AppText style={styles.value} tabular numberOfLines={1}>
              {money(p.stats.value, currency)}
            </AppText>
            <TrendPill small tone={tn} label={pct(p.stats.profitPct).replace(/^[+−-]/, '')} />
            <AppText variant="caption" tabular color={toneColor[tn]} numberOfLines={1}>
              {signedMoney(p.stats.profit, currency)}
            </AppText>
          </View>
        </View>
      )}
    </Linked>
  );
});

/** Dlaždice mřížky: velký obrázek se září v barvě hry, název, hodnota a zisk */
export const PositionCard = memo(function PositionCard({ p, currency, marketUrl }: ItemProps) {
  const tn = tone(p.stats.profit);
  return (
    <Linked p={p} marketUrl={marketUrl}>
      {(pressed) => (
        <View style={[styles.card, pressed && styles.pressed]}>
          <View style={styles.cardMedia}>
            <Glow size={170} color={gameColor[p.game][0]} opacity={0.22} style={{ alignSelf: 'center', top: -25 }} />
            <ProductThumb item={p.head} size={104} />
            <View style={[styles.qty, styles.cardQty]}>
              <AppText style={styles.qtyText} tabular>
                {p.stats.held}×
              </AppText>
            </View>
          </View>
          <AppText variant="caption" numberOfLines={2} style={{ fontFamily: font.semibold, color: color.text, minHeight: 34 }}>
            {p.name}
          </AppText>
          <View style={styles.cardFoot}>
            <AppText style={styles.cardValue} tabular numberOfLines={1} adjustsFontSizeToFit>
              {money(p.stats.value, currency)}
            </AppText>
            <TrendPill small tone={tn} label={pct(p.stats.profitPct).replace(/^[+−-]/, '')} />
          </View>
        </View>
      )}
    </Linked>
  );
});

const cardBase = {
  borderRadius: radius.lg,
  borderCurve: 'continuous' as const,
  backgroundColor: '#0f0f16',
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: 'rgba(255,255,255,0.1)',
  boxShadow: '0 12px 28px -18px rgba(0,0,0,0.9)',
};

const styles = StyleSheet.create({
  row: { ...cardBase, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, marginBottom: space.sm + 2 },
  pressed: { backgroundColor: '#16161f', transform: [{ scale: 0.985 }] },
  middle: { flex: 1, minWidth: 0, gap: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  wrap: { flexWrap: 'wrap', columnGap: 8, rowGap: 0 },
  right: { alignItems: 'flex-end', gap: 4, maxWidth: '38%' },
  value: { fontFamily: font.displayBold, fontSize: 17, letterSpacing: -0.4, color: color.text },
  qty: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    minWidth: 24,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.text,
    borderWidth: 2,
    borderColor: '#0f0f16',
  },
  qtyText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 11, lineHeight: 13, color: color.bg },
  card: { ...cardBase, flex: 1, gap: space.sm, padding: space.md, margin: space.xs + 1, overflow: 'hidden' },
  cardMedia: { height: 120, alignItems: 'center', justifyContent: 'center' },
  cardQty: { right: 0, bottom: 4 },
  cardFoot: { gap: 4 },
  cardValue: { fontFamily: font.displayBold, fontSize: 17, letterSpacing: -0.4, color: color.text },
});
