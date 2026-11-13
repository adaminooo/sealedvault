import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { expandQuery, numStr, parseNum } from '@/core/form';
import { fromDisplay, money, newId, toDisplay } from '@/core/format';
import { t } from '@/core/i18n';
import { inferType, marketPrice, productImageFor, productUrl, searchProducts, toCzk, type MarketProduct } from '@/core/market';
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

/** Wishlist: produkty, které chceš koupit – cílová cena a jak daleko od ní trh je */
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
  // nejblíž cíli nahoře
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
      {/* Hledání a přidání */}
      <Panel>
        <View style={{ gap: 2 }}>
          <AppText variant="overline" color={color.muted}>
            {t('Najdi produkt')}
          </AppText>
          <AppText variant="caption" color={color.faint}>
            {t('Přidej, co chceš koupit, a nastav si cenu, za kterou ho chceš.')}
          </AppText>
        </View>
        <Segmented stretch value={game} onChange={(g) => setGame(g)} options={GAMES.map((g) => ({ value: g, label: g }))} />
        <View style={styles.search}>
          <Icon sf="magnifyingglass" md="search" size={16} color={color.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={market ? t('např. {0}', game === 'Pokémon' ? '151 upc' : game === 'One Piece' ? 'romance dawn box' : 'origins display') : t('Načítám katalog produktů…')}
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
        {query.trim().length >= 2 && results.length === 0 && market && (
          <AppText variant="caption" color={color.faint}>
            {t('Nic jsme nenašli – zkus jiný název nebo zkratku (etb, upc, bb).')}
          </AppText>
        )}
        {results.length > 0 && (
          <View>
            {results.map((p, i) => {
              const v = marketPrice(p);
              const there = list.some((w) => w.cmProductId === p.id);
              return (
                <Pressable key={p.id} disabled={there} onPress={() => void add(p)} accessibilityRole="button" accessibilityLabel={there ? t('{0} – už sleduješ', p.name) : t('Sledovat {0}', p.name)}>
                  {({ pressed }) => (
                    <View style={[styles.result, i > 0 && styles.divider, (pressed || there) && { opacity: 0.5 }]}>
                      <View style={[styles.dot, { backgroundColor: gameColor[p.game][0] }]} />
                      <AppText variant="label" numberOfLines={2} style={{ flex: 1, fontFamily: font.semibold }}>
                        {p.name}
                      </AppText>
                      <AppText variant="label" tabular color={color.muted}>
                        {v != null ? money(toCzk(v, p.currency, market), currency) : '—'}
                      </AppText>
                      <Icon sf={there ? 'checkmark.circle.fill' : 'plus.circle.fill'} md={there ? 'check-circle' : 'add-circle'} size={22} color={there ? color.pos : color.accent2} />
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
          <AppText variant="heading">{t('Sledované')}</AppText>
          <View style={styles.count}>
            <AppText variant="caption" tabular color={color.accent2} style={{ fontFamily: font.semibold }}>
              {list.length}
            </AppText>
          </View>
          <View style={{ flex: 1 }} />
          {hits > 0 && <TrendPill small tone="pos" label={hits === 1 ? t('1 za tvoji cenu') : t('{0} za tvoji cenu', hits)} />}
        </View>
      )}

      {list.length === 0 ? (
        <Panel style={{ alignItems: 'center', paddingVertical: space.xxl }}>
          <View style={styles.emptyIcon}>
            <Icon sf="heart" md="favorite-border" size={28} color={color.accent2} />
          </View>
          <AppText variant="heading">{t('Zatím nic nesleduješ')}</AppText>
          <AppText color={color.muted} style={{ textAlign: 'center' }}>
            {t('Najdi produkt nahoře a nastav si cílovou cenu. Jakmile na ni trh klesne, uvidíš to tady.')}
          </AppText>
        </Panel>
      ) : (
        sorted.map((w) => {
          const p = w.cmProductId ? market?.byId.get(w.cmProductId) : undefined;
          return <WishCard key={w.id} w={w} now={wishPrice(w, market)} dist={wishDistance(w, market)} currency={currency} marketUrl={p ? productUrl(p) : undefined} />;
        })
      )}
    </Screen>
  );
}

function WishCard({ w, now, dist, currency, marketUrl }: { w: WishlistItem; now: number | null; dist: number | null; currency: Currency; marketUrl?: string }) {
  const hit = dist != null && dist <= 0;
  const [target, setTarget] = useState(w.targetPrice ? numStr(toDisplay(w.targetPrice, currency)) : '');
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cur = currency === 'CZK' ? t('Kč') : '€';
  // o kolik % musí cena ještě klesnout (z dnešní ceny), aby byla na cíli
  const drop = now != null && w.targetPrice && now > w.targetPrice ? ((now - w.targetPrice) / now) * 100 : null;
  // naplnění ukazatele: 100 % = na cíli; 50 % a víc nad cílem = skoro prázdný
  const fill = dist == null ? 0 : Math.max(4, Math.min(100, 100 - dist * 200));

  const saveTarget = (text = target) => {
    const v = parseNum(text);
    const next = Number.isFinite(v) && v > 0 ? fromDisplay(v, currency) : undefined;
    if (next !== w.targetPrice) void wishStore.put({ ...w, targetPrice: next });
  };

  const remove = () => {
    const run = () => void wishStore.remove(w.id);
    if (Platform.OS === 'web') {
      if (confirm(t('Přestat sledovat {0}?', w.name))) run();
      return;
    }
    Alert.alert(t('Přestat sledovat?'), w.name, [
      { text: t('Zrušit'), style: 'cancel' },
      { text: t('Přestat sledovat'), style: 'destructive', onPress: run },
    ]);
  };

  return (
    <Panel style={hit ? styles.hitCard : undefined}>
      {/* Produkt */}
      <View style={styles.top}>
        <ProductThumb item={w} size={60} />
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
      </View>

      {/* Cena teď × tvoje cena */}
      <View style={styles.prices}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText variant="caption" color={color.muted}>
            {t('Cena na trhu')}
          </AppText>
          <AppText style={styles.now} tabular numberOfLines={1} adjustsFontSizeToFit color={hit ? color.pos : color.text}>
            {now != null ? money(now, currency) : '—'}
          </AppText>
        </View>
        <Pressable onPress={() => input.current?.focus()} style={styles.targetBox} accessibilityRole="button" accessibilityLabel={t('Upravit cílovou cenu')}>
          <AppText variant="caption" color={color.muted}>
            {t('Chci koupit za')}
          </AppText>
          <View style={styles.targetRow}>
            <TextInput
              ref={input}
              value={target}
              onChangeText={(v) => {
                setTarget(v);
                // uloží se i bez opuštění pole (krátce po dopsání)
                if (timer.current) clearTimeout(timer.current);
                timer.current = setTimeout(() => saveTarget(v), 900);
              }}
              onBlur={() => saveTarget()}
              onSubmitEditing={() => saveTarget()}
              keyboardType="decimal-pad"
              placeholder={t('nastavit')}
              placeholderTextColor={color.faint}
              keyboardAppearance="dark"
              accessibilityLabel={t('Cílová cena')}
              style={styles.targetInput}
            />
            <AppText variant="caption" color={color.muted}>
              {cur}
            </AppText>
            <Icon sf="pencil" md="edit" size={12} color={color.accent2} />
          </View>
        </Pressable>
      </View>

      {/* Jak daleko od cíle */}
      {dist != null && (
        <View style={{ gap: 6 }}>
          <View style={styles.track}>
            <LinearGradient colors={hit ? ['#3ddc84', '#34c7a0'] : ['#9b7bff', '#4f7dff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: `${fill}%` }]} />
          </View>
          <View style={styles.statusRow}>
            <Icon sf={hit ? 'checkmark.seal.fill' : 'arrow.down.right'} md={hit ? 'verified' : 'south-east'} size={13} color={hit ? color.pos : color.muted} />
            <AppText variant="caption" color={hit ? color.pos : color.muted} style={{ flex: 1 }}>
              {hit
                ? t('Cena je {0} % pod tvým cílem – dobrá chvíle koupit', Math.round(-dist * 100))
                : t('Cena musí klesnout ještě o {0} %', Math.max(1, Math.round(drop ?? dist * 100)))}
            </AppText>
          </View>
        </View>
      )}

      {/* Akce */}
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.buy, hit && styles.buyHit, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          onPress={() => router.push({ pathname: '/add', params: { wish: w.id } })}
          accessibilityRole="button"
          accessibilityHint={t('Otevře přidání nákupu do portfolia')}>
          <Icon sf="cart.fill" md="shopping-cart" size={15} color="#fff" />
          <AppText variant="label" color="#fff" style={{ fontFamily: font.semibold }}>
            {t('Koupit')}
          </AppText>
        </Pressable>
        {marketUrl ? (
          <Pressable style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]} onPress={() => void WebBrowser.openBrowserAsync(marketUrl)} accessibilityRole="link" accessibilityLabel={t('Otevřít na trhu')}>
            <Icon sf="safari" md="open-in-new" size={17} color={color.text} />
          </Pressable>
        ) : null}
        <Pressable style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]} onPress={remove} accessibilityRole="button" accessibilityLabel={t('Přestat sledovat')}>
          <Icon sf="trash" md="delete-outline" size={17} color={color.muted} />
        </Pressable>
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
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
  hitCard: { boxShadow: 'inset 0 0 0 1px rgba(61,220,132,0.5), inset 0 0 40px rgba(61,220,132,0.08)' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prices: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  now: { fontFamily: font.displayBold, fontSize: 24, letterSpacing: -0.6 },
  targetBox: {
    gap: 2,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(143,107,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,157,255,0.35)',
    flex: 1,
    minWidth: 0,
  },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  targetInput: { flex: 1, minWidth: 0, width: '100%', fontFamily: font.displayBold, fontSize: 18, color: color.text, paddingVertical: 0, minHeight: 26 },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', gap: space.sm },
  buy: {
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(143,107,255,0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,157,255,0.6)',
  },
  buyHit: { backgroundColor: 'rgba(61,220,132,0.85)', borderColor: 'rgba(61,220,132,0.9)' },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
  },
});
