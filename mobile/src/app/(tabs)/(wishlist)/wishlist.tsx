import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { expandQuery, numStr, parseNum } from '@/core/form';
import { fromDisplay, money, newId, toDisplay } from '@/core/format';
import { t } from '@/core/i18n';
import { inferType, marketPrice, productImageFor, searchProducts, toCzk, type MarketProduct } from '@/core/market';
import { GAMES, type Currency, type Game, type WishlistItem } from '@/core/types';
import { wishDistance, wishPrice } from '@/core/wish';
import { useMarket } from '@/data/queries';
import { useStoredState } from '@/data/use-stored-state';
import { useCollection, wishlist as wishStore } from '@/db/store';
import { AppText, Card, Screen, color, font, radius, space } from '@/ui';
import { Chip, ChipRow } from '@/ui/chip';
import { Field } from '@/ui/field';
import { Icon } from '@/ui/icon';
import { ProductThumb } from '@/ui/product-thumb';

/** Wishlist: produkty, které chceš koupit, s cílovou cenou */
export default function WishlistScreen() {
  const list = useCollection(wishStore);
  const market = useMarket().data ?? null;
  const [currency] = useStoredState<Currency>('currency', 'CZK');
  const [game, setGame] = useState<Game>('Pokémon');
  const [query, setQuery] = useState('');

  const results = useMemo(
    () => (market && query.trim().length >= 2 ? searchProducts(market.products, game, expandQuery(query), 8) : []),
    [market, game, query],
  );
  const sorted = useMemo(
    () => [...list].sort((a, b) => (wishDistance(a, market) ?? 1e9) - (wishDistance(b, market) ?? 1e9)),
    [list, market],
  );
  const hits = list.filter((w) => (wishDistance(w, market) ?? 1) <= 0).length;

  const add = async (p: MarketProduct) => {
    setQuery('');
    if (list.some((w) => w.cmProductId === p.id)) return;
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    const img = await productImageFor(p).catch(() => null);
    const czk = marketPrice(p) != null ? toCzk(marketPrice(p)!, p.currency, market) : undefined;
    await wishStore.put({
      id: newId(),
      name: p.name,
      game: p.game,
      set: '',
      type: inferType(p),
      cmProductId: p.id,
      productImage: img ?? undefined,
      // výchozí cíl: o 10 % levněji než dnes (jako web)
      targetPrice: czk ? Math.round(czk * 0.9) : undefined,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <AppText color={color.muted}>{t('Produkty, které chceš koupit. Nastav cílovou cenu a uvidíš, jak blízko k ní trh je.')}</AppText>
      <ChipRow>
        {GAMES.map((g) => (
          <Chip key={g} label={g} active={g === game} onPress={() => setGame(g)} />
        ))}
      </ChipRow>
      <Field label={t('Přidat produkt')} value={query} onChangeText={setQuery} placeholder={market ? t('Hledej na trhu…') : t('Načítám katalog produktů…')} editable={!!market} autoCorrect={false} autoCapitalize="none" />
      {results.length > 0 && (
        <Card style={{ gap: 0, paddingVertical: space.xs }}>
          {results.map((p, i) => {
            const v = marketPrice(p);
            const there = list.some((w) => w.cmProductId === p.id);
            return (
              <Pressable key={p.id} disabled={there} onPress={() => void add(p)} style={({ pressed }) => [styles.result, i > 0 && styles.divider, (pressed || there) && { opacity: 0.5 }]} accessibilityRole="button">
                <AppText variant="bodyStrong" numberOfLines={2} style={{ flex: 1 }}>
                  {p.name}
                </AppText>
                <AppText variant="label" tabular color={there ? color.muted : color.text}>
                  {there ? t('Už ve wishlistu') : v != null ? money(toCzk(v, p.currency, market), currency) : '—'}
                </AppText>
              </Pressable>
            );
          })}
        </Card>
      )}

      {hits > 0 && (
        <AppText variant="bodyStrong" color={color.pos}>
          {t('{0} na cílové ceně nebo pod ní', hits === 1 ? t('1 produkt je') : t('{0} produkty jsou', hits))}
        </AppText>
      )}

      {list.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xxl }}>
          <Icon sf="heart" md="favorite-border" size={30} color={color.accent2} />
          <AppText variant="heading">{t('Wishlist je prázdný')}</AppText>
          <AppText color={color.muted}>{t('Vyhledej produkt nahoře a přidej ho.')}</AppText>
        </Card>
      ) : (
        sorted.map((w) => <WishCard key={w.id} w={w} now={wishPrice(w, market)} dist={wishDistance(w, market)} currency={currency} />)
      )}
    </Screen>
  );
}

function WishCard({ w, now, dist, currency }: { w: WishlistItem; now: number | null; dist: number | null; currency: Currency }) {
  const hit = dist != null && dist <= 0;
  const [target, setTarget] = useState(w.targetPrice ? numStr(toDisplay(w.targetPrice, currency)) : '');

  const saveTarget = () => {
    const v = parseNum(target);
    const next = Number.isFinite(v) && v > 0 ? fromDisplay(v, currency) : undefined;
    if (next !== w.targetPrice) void wishStore.put({ ...w, targetPrice: next });
  };

  return (
    <Card style={[hit && { borderColor: color.pos }]}>
      <View style={styles.head}>
        <ProductThumb item={w} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {w.name}
          </AppText>
          <AppText variant="caption" color={color.muted}>
            {w.game} · {t(w.type)}
          </AppText>
        </View>
      </View>
      <View style={styles.prices}>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" color={color.muted}>
            {t('Teď')}
          </AppText>
          <AppText variant="heading" tabular>
            {now != null ? money(now, currency) : '—'}
          </AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" color={color.muted}>
            {t('Cíl ({0})', currency === 'CZK' ? t('Kč') : '€')}
          </AppText>
          <TextInput
            value={target}
            onChangeText={setTarget}
            onBlur={saveTarget}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={color.faint}
            keyboardAppearance="dark"
            accessibilityLabel={t('Cílová cena')}
            style={styles.target}
          />
        </View>
      </View>
      {dist != null && (
        <View style={{ gap: space.xs }}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(4, Math.min(100, 100 - dist * 200))}%`, backgroundColor: hit ? color.pos : color.accent }]} />
          </View>
          <AppText variant="caption" color={hit ? color.pos : color.muted}>
            {hit ? t('{0} % pod cílem', Math.round(-dist * 100)) : t('ještě {0} % nad cílem', Math.round(dist * 100))}
          </AppText>
        </View>
      )}
      <View style={styles.actions}>
        <Pressable style={[styles.action, { backgroundColor: color.accent }]} onPress={() => router.push({ pathname: '/add', params: { wish: w.id } })} accessibilityRole="button">
          <Icon sf="cart.fill" md="shopping-cart" size={14} color="#fff" />
          <AppText variant="label" color="#fff">
            {t('Koupeno')}
          </AppText>
        </Pressable>
        <Pressable style={styles.action} onPress={() => void wishStore.remove(w.id)} accessibilityRole="button">
          <Icon sf="trash" md="delete-outline" size={14} color={color.muted} />
          <AppText variant="label" color={color.muted}>
            {t('Odebrat')}
          </AppText>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  result: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  prices: { flexDirection: 'row', gap: space.md, marginTop: space.xs },
  target: { fontFamily: font.display, fontSize: 20, color: color.text, paddingVertical: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borderStrong },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: color.surface3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  action: { flex: 1, flexDirection: 'row', gap: 6, minHeight: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface2 },
});
