import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { expandQuery, numStr, parseNum } from '@/core/form';
import { fromDisplay, money, newId, pct, toDisplay } from '@/core/format';
import { t } from '@/core/i18n';
import { inferType, marketPrice, productImageFor, searchProducts, toCzk, type MarketProduct } from '@/core/market';
import { GAMES, type Currency, type Game, type WishlistItem } from '@/core/types';
import { wishDistance, wishPrice } from '@/core/wish';
import { useMarket } from '@/data/queries';
import { useStoredState } from '@/data/use-stored-state';
import { useCollection, wishlist as wishStore } from '@/db/store';
import { AppText, Screen, color, font, gameColor, radius, space } from '@/ui';
import { Icon } from '@/ui/icon';
import { Panel } from '@/ui/panel';
import { TrendPill } from '@/ui/pill';
import { ProductThumb } from '@/ui/product-thumb';
import { Segmented } from '@/ui/segmented';

/** Wishlist: produkty, které chceš koupit, s cílovou cenou a tím, jak blízko k ní trh je */
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
  const sorted = useMemo(() => [...list].sort((a, b) => (wishDistance(a, market) ?? 1e9) - (wishDistance(b, market) ?? 1e9)), [list, market]);
  const hits = list.filter((w) => (wishDistance(w, market) ?? 1) <= 0).length;

  const add = async (p: MarketProduct) => {
    setQuery('');
    if (list.some((w) => w.cmProductId === p.id)) return;
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      {/* Přidání */}
      <Panel>
        <View style={styles.head}>
          <AppText variant="overline" color={color.muted}>
            {t('Přidat do wishlistu')}
          </AppText>
        </View>
        <Segmented stretch value={game} onChange={(g) => setGame(g)} options={GAMES.map((g) => ({ value: g, label: g }))} />
        <View style={styles.search}>
          <Icon sf="magnifyingglass" md="search" size={16} color={color.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={market ? t('Hledej na trhu…') : t('Načítám katalog produktů…')}
            placeholderTextColor={color.faint}
            editable={!!market}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            keyboardAppearance="dark"
            style={styles.searchInput}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Smazat hledání')}>
              <Icon sf="xmark.circle.fill" md="cancel" size={16} color={color.faint} />
            </Pressable>
          ) : null}
        </View>
        {results.length > 0 && (
          <View>
            {results.map((p, i) => {
              const v = marketPrice(p);
              const there = list.some((w) => w.cmProductId === p.id);
              return (
                <Pressable key={p.id} disabled={there} onPress={() => void add(p)} accessibilityRole="button">
                  {({ pressed }) => (
                    <View style={[styles.result, i > 0 && styles.divider, (pressed || there) && { opacity: 0.5 }]}>
                      <View style={[styles.dot, { backgroundColor: gameColor[p.game][0] }]} />
                      <AppText variant="label" numberOfLines={2} style={{ flex: 1, fontFamily: font.semibold }}>
                        {p.name}
                      </AppText>
                      <AppText variant="label" tabular color={color.muted}>
                        {v != null ? money(toCzk(v, p.currency, market), currency) : '—'}
                      </AppText>
                      <Icon sf={there ? 'checkmark.circle.fill' : 'plus.circle.fill'} md={there ? 'check-circle' : 'add-circle'} size={20} color={there ? color.pos : color.accent2} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </Panel>

      {/* Souhrn */}
      {list.length > 0 && (
        <View style={styles.summary}>
          <AppText variant="heading">{t('Sleduješ')}</AppText>
          <View style={styles.count}>
            <AppText variant="caption" tabular color={color.accent2} style={{ fontFamily: font.semibold }}>
              {list.length}
            </AppText>
          </View>
          {hits > 0 && <TrendPill small tone="pos" label={hits === 1 ? t('1 na cílové ceně') : t('{0} na cílové ceně', hits)} />}
        </View>
      )}

      {list.length === 0 ? (
        <Panel style={{ alignItems: 'center', paddingVertical: space.xxl }}>
          <View style={styles.emptyIcon}>
            <Icon sf="heart" md="favorite-border" size={28} color={color.accent2} />
          </View>
          <AppText variant="heading">{t('Wishlist je prázdný')}</AppText>
          <AppText color={color.muted} style={{ textAlign: 'center' }}>
            {t('Vyhledej produkt nahoře, nastav cílovou cenu a uvidíš, jak blízko k ní trh je.')}
          </AppText>
        </Panel>
      ) : (
        sorted.map((w) => <WishCard key={w.id} w={w} now={wishPrice(w, market)} dist={wishDistance(w, market)} currency={currency} />)
      )}
    </Screen>
  );
}

function WishCard({ w, now, dist, currency }: { w: WishlistItem; now: number | null; dist: number | null; currency: Currency }) {
  const hit = dist != null && dist <= 0;
  const [target, setTarget] = useState(w.targetPrice ? numStr(toDisplay(w.targetPrice, currency)) : '');
  const cur = currency === 'CZK' ? t('Kč') : '€';
  // naplnění ukazatele: 100 % = na cíli; 50 % nad cílem a víc = prázdný
  const fill = dist == null ? 0 : Math.max(4, Math.min(100, 100 - dist * 200));

  const saveTarget = () => {
    const v = parseNum(target);
    const next = Number.isFinite(v) && v > 0 ? fromDisplay(v, currency) : undefined;
    if (next !== w.targetPrice) void wishStore.put({ ...w, targetPrice: next });
  };

  return (
    <Panel style={hit ? styles.hitCard : undefined}>
      <View style={styles.top}>
        <ProductThumb item={w} size={56} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <AppText variant="label" numberOfLines={2} style={{ fontFamily: font.semibold }}>
            {w.name}
          </AppText>
          <View style={styles.meta}>
            <View style={[styles.dot, { backgroundColor: gameColor[w.game][0] }]} />
            <AppText variant="caption" color={color.muted} numberOfLines={1}>
              {w.game} · {t(w.type)}
            </AppText>
          </View>
        </View>
        {hit && <TrendPill small tone="pos" label={t('Na cíli')} />}
      </View>

      <View style={styles.prices}>
        <View style={styles.price}>
          <AppText variant="caption" color={color.muted}>
            {t('Teď')}
          </AppText>
          <AppText style={styles.big} tabular numberOfLines={1} adjustsFontSizeToFit>
            {now != null ? money(now, currency) : '—'}
          </AppText>
        </View>
        <View style={styles.vline} />
        <View style={styles.price}>
          <AppText variant="caption" color={color.muted}>
            {t('Cíl ({0})', cur)}
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
            style={[styles.big, styles.target]}
          />
        </View>
        <View style={styles.vline} />
        <View style={[styles.price, { alignItems: 'flex-end' }]}>
          <AppText variant="caption" color={color.muted}>
            {t('Rozdíl')}
          </AppText>
          <AppText style={styles.big} tabular color={dist == null ? color.faint : hit ? color.pos : color.text}>
            {dist == null ? '—' : pct(dist * 100)}
          </AppText>
        </View>
      </View>

      {dist != null && (
        <View style={{ gap: 6 }}>
          <View style={styles.track}>
            <LinearGradient
              colors={hit ? ['#3ddc84', '#34c7a0'] : ['#9b7bff', '#4f7dff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.fill, { width: `${fill}%` }]}
            />
          </View>
          <AppText variant="caption" color={hit ? color.pos : color.muted}>
            {hit ? t('{0} % pod cílem – dobrá chvíle koupit', Math.round(-dist * 100)) : t('Ještě {0} % nad cílem', Math.round(dist * 100))}
          </AppText>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={({ pressed }) => [styles.action, styles.primary, pressed && { opacity: 0.8 }]} onPress={() => router.push({ pathname: '/add', params: { wish: w.id } })} accessibilityRole="button">
          <Icon sf="cart.fill" md="shopping-cart" size={14} color="#fff" />
          <AppText variant="label" color="#fff" style={{ fontFamily: font.semibold }}>
            {t('Koupeno')}
          </AppText>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]} onPress={() => void wishStore.remove(w.id)} accessibilityRole="button">
          <Icon sf="trash" md="delete-outline" size={14} color={color.muted} />
          <AppText variant="label" color={color.muted}>
            {t('Odebrat')}
          </AppText>
        </Pressable>
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    minHeight: 46,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
  },
  searchInput: { flex: 1, color: color.text, fontFamily: font.body, fontSize: 16, minHeight: 44 },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm + 2 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  dot: { width: 7, height: 7, borderRadius: 4 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs, paddingHorizontal: space.xs },
  count: { minWidth: 26, height: 22, paddingHorizontal: 8, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(143,107,255,0.16)' },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(143,107,255,0.14)' },
  hitCard: { boxShadow: 'inset 0 0 0 1px rgba(61,220,132,0.45)' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prices: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.border },
  price: { flex: 1, gap: 2, paddingHorizontal: space.xs },
  vline: { width: StyleSheet.hairlineWidth, backgroundColor: color.border },
  big: { fontFamily: font.displayBold, fontSize: 17, letterSpacing: -0.3, color: color.text },
  target: { paddingVertical: 0, minHeight: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(169,157,255,0.45)' },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  actions: { flexDirection: 'row', gap: space.sm },
  action: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
  },
  primary: { backgroundColor: 'rgba(143,107,255,0.85)', borderColor: 'rgba(169,157,255,0.6)' },
});
