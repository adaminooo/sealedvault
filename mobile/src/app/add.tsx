import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { expandQuery, numStr, parseNum, setFromName, todayIso, TYPE_NAMES } from '@/core/form';
import { fromDisplay, money, newId, toDisplay } from '@/core/format';
import { t } from '@/core/i18n';
import { bestMatch, formatSource, inferType, marketPrice, productImageFor, searchProducts, toCzk, type MarketProduct } from '@/core/market';
import { groupPositions } from '@/core/portfolio';
import { ALL_ID, MAIN_ID } from '@/core/portfolios';
import { CONDITIONS, GAMES, PRODUCT_TYPES, type Currency, type Game, type PortfolioItem, type ProductType } from '@/core/types';
import { useMarket } from '@/data/queries';
import { usePortfolios } from '@/data/use-portfolio';
import { useSetCatalog } from '@/data/use-set-catalog';
import { useStoredState } from '@/data/use-stored-state';
import { items as itemsStore, useCollection, wishlist as wishStore } from '@/db/store';
import { AppText, Button, Card, color, font, gameColor, radius, space } from '@/ui';
import { Chip, ChipRow } from '@/ui/chip';
import { DateField } from '@/ui/date-field';
import { Field } from '@/ui/field';
import { ProductThumb } from '@/ui/product-thumb';
import { PhotoStrip } from '@/ui/photo-strip';
import { Stepper } from '@/ui/stepper';
import { MAX_PHOTOS, pickPhotos } from '@/data/photos';

/**
 * Přidání nákupu / úprava nákupu.
 *  - ?wish=<id>: koupený produkt z wishlistu
 *  - bez parametrů: nový produkt (hlavní cesta = vyhledání na trhu)
 *  - ?from=<pozice>: další nákup stejného produktu
 *  - ?id=<nákup>: úprava existujícího nákupu (+ smazání)
 */
export default function AddScreen() {
  const { id, from, wish } = useLocalSearchParams<{ id?: string; from?: string; wish?: string }>();
  const wishes = useCollection(wishStore);
  const all = useCollection(itemsStore);
  const editing = id ? all.find((x) => x.id === id) : undefined;
  const template = from ? groupPositions(all).find((p) => p.key === from)?.head : undefined;
  // „Koupeno“ z wishlistu: předvyplněný produkt
  const w = wish ? wishes.find((x) => x.id === wish) : undefined;
  const fromWish: (Partial<PortfolioItem> & Pick<PortfolioItem, 'game' | 'name' | 'set' | 'type'>) | undefined = w
    ? { game: w.game, name: w.name, set: w.set, type: w.type, cmProductId: w.cmProductId, productImage: w.productImage }
    : undefined;
  const base = editing ?? template ?? fromWish;

  const market = useMarket().data ?? null;
  const [currency] = useStoredState<Currency>('currency', 'CZK');
  const [lastGame, setLastGame] = useStoredState<Game>('lastGame', 'Pokémon');
  const pf = usePortfolios();

  const [game, setGame] = useState<Game>(base?.game ?? lastGame);
  const catalog = useSetCatalog(game);
  const [query, setQuery] = useState('');
  // vybraný produkt z trhu: číslo = spárovaný, null = ruční zadání bez párování, undefined = zatím nic
  const [cmId, setCmId] = useState<number | null | undefined>(base ? (base.cmProductId ?? null) : undefined);
  const [name, setName] = useState(base?.name ?? '');
  const [set, setSet] = useState(base?.set ?? '');
  const [type, setType] = useState<ProductType>(base?.type ?? 'Booster box');
  const [qty, setQty] = useState(editing?.quantity ?? 1);
  const [buy, setBuy] = useState(editing ? numStr(toDisplay(editing.buyPrice, currency)) : '');
  const [fees, setFees] = useState(editing ? numStr(toDisplay(editing.fees, currency)) : '');
  const [buyDate, setBuyDate] = useState(editing?.buyDate ?? todayIso());
  const [note, setNote] = useState(editing?.note ?? '');
  const [condition, setCondition] = useState<string[]>(editing?.condition ?? []);
  const [photos, setPhotos] = useState<string[]>(editing?.photos ?? []);
  const [photoBusy, setPhotoBusy] = useState(false);
  const addPhotos = async (src: 'camera' | 'library') => {
    setPhotoBusy(true);
    setError(null);
    try {
      const added = await pickPhotos(src, MAX_PHOTOS - photos.length);
      setPhotos((p) => [...p, ...added].slice(0, MAX_PHOTOS));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Fotku se nepodařilo načíst.'));
    } finally {
      setPhotoBusy(false);
    }
  };
  const [more, setMore] = useState(!!editing && (editing.fees > 0 || !!editing.note || !!editing.condition?.length || !!editing.photos?.length));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const product: MarketProduct | null = useMemo(() => (market && typeof cmId === 'number' ? (market.byId.get(cmId) ?? null) : null), [market, cmId]);
  const unitPrice = product && marketPrice(product) != null ? toCzk(marketPrice(product)!, product.currency, market) : null;
  const [productImage, setProductImage] = useState<string | undefined>(base?.productImage);
  useEffect(() => {
    if (!product) return;
    let alive = true;
    productImageFor(product)
      .then((u) => alive && setProductImage(u ?? undefined))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [product]);

  const results = useMemo(
    () => (market && query.trim().length >= 2 ? searchProducts(market.products, game, expandQuery(query), 12) : []),
    [market, game, query],
  );

  const effectiveName = cmId === null && !name.trim() && set.trim() ? [set.trim(), TYPE_NAMES[type]].filter(Boolean).join(' ') : name;
  const cur = currency === 'CZK' ? t('Kč') : '€';
  const bp = parseNum(buy);
  const total = Number.isFinite(bp) ? bp * qty : null;
  const chosen = cmId !== undefined;

  const pick = (p: MarketProduct) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    setCmId(p.id);
    setName(p.name);
    setType(inferType(p));
    setSet(setFromName(p.name, catalog)?.name ?? '');
    setQuery('');
    setProductImage(undefined);
  };

  const save = async (another: boolean) => {
    const f = fees.trim() ? parseNum(fees) : 0;
    const nm = effectiveName.trim();
    if (!nm) return setError(t('Vyber edici nebo zadej název produktu.'));
    if (!Number.isFinite(bp) || bp < 0) return setError(t('Zadej nákupní cenu za kus.'));
    if (!Number.isFinite(f) || f < 0) return setError(t('Poštovné/poplatky nejsou platné číslo.'));
    const sold = (editing?.sales ?? []).reduce((a, s) => a + s.quantity, 0);
    if (qty < sold) return setError(t('Z této dávky už je prodáno {0} ks – počet nemůže být menší.', sold));

    // ručně zadaný produkt: zkusit spárovat s trhem (stejně jako web);
    // nákup, u kterého uživatel párování vypnul (na webu „Nepárovat“), zůstane nespárovaný
    const noPair = cmId === null && editing?.priceAuto === false;
    const matched = product ?? (cmId === null && !noPair && market ? bestMatch(market.products, { game, set, type, name: nm }) : null);
    const buyCzk = editing && buy === numStr(toDisplay(editing.buyPrice, currency)) ? editing.buyPrice : fromDisplay(bp, currency);
    const feesCzk = editing && fees === numStr(toDisplay(editing.fees, currency)) ? editing.fees : fromDisplay(f, currency);
    const priced = matched && marketPrice(matched) != null ? toCzk(marketPrice(matched)!, matched.currency, market) : null;
    const now = new Date().toISOString();
    const targetPf = base?.portfolioId ?? (pf.active === ALL_ID || pf.active === MAIN_ID ? undefined : pf.active);

    const item: PortfolioItem = {
      ...(editing ?? {}),
      id: editing?.id ?? newId(),
      name: nm,
      game,
      set: set.trim(),
      type,
      quantity: qty,
      buyPrice: buyCzk,
      buyDate,
      fees: feesCzk,
      currentPrice: priced ?? editing?.currentPrice ?? buyCzk,
      note: note.trim(),
      condition: condition.length ? condition : undefined,
      photos: photos.length ? photos : undefined,
      ...(market
        ? {
            productImage: matched ? productImage : editing?.productImage,
            cmProductId: matched?.id,
            cmName: matched?.name,
            priceAuto: matched ? true : noPair ? false : undefined,
            priceUpdatedAt: priced != null ? market.priceDate : editing?.priceUpdatedAt,
          }
        : // ceny nejsou načtené (offline) – párování nákupu zůstane beze změny
          {
            productImage: base?.productImage,
            cmProductId: base?.cmProductId,
            cmName: base?.cmName,
            priceAuto: base?.priceAuto,
            priceUpdatedAt: editing?.priceUpdatedAt,
          }),
      portfolioId: targetPf,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    };

    setError(null);
    setSaving(true);
    try {
      await itemsStore.put(item);
      setLastGame(game);
      if (process.env.EXPO_OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (another) {
        setCmId(undefined);
        setName('');
        setSet('');
        setQty(1);
        setBuy('');
        setFees('');
        setNote('');
        setCondition([]);
        setPhotos([]);
        setProductImage(undefined);
      } else close();
    } catch (e) {
      setError(t('Uložení selhalo: {0}', String(e)));
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!editing) return;
    const doIt = async () => {
      await itemsStore.remove(editing.id);
      // poslední nákup produktu → detail už nemá co ukázat, zpět na seznam
      const key = groupPositions([editing])[0]?.key;
      const others = groupPositions(all.filter((x) => x.id !== editing.id)).some((p) => p.key === key);
      if (others) close();
      else router.dismissTo('/');
    };
    const msg = t('Smazat tento nákup? Tuto akci nejde vrátit.');
    if (Platform.OS === 'web') {
      if (confirm(msg)) void doIt();
      return;
    }
    Alert.alert(t('Smazat nákup'), msg, [
      { text: t('Zrušit'), style: 'cancel' },
      { text: t('Smazat'), style: 'destructive', onPress: () => void doIt() },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: editing ? t('Upravit nákup') : template ? t('Další nákup') : t('Přidat produkt') }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {!base && (
          <View style={{ gap: space.sm }}>
            <AppText variant="label" color={color.muted}>
              {t('Hra')}
            </AppText>
            <View style={styles.games}>
              {GAMES.map((g) => {
                const on = g === game;
                const tint = gameColor[g][0];
                return (
                  <Pressable
                    key={g}
                    onPress={() => {
                      if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                      setGame(g);
                      setCmId(undefined);
                      setQuery('');
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={[styles.game, on && { borderColor: tint, backgroundColor: `${tint}1f` }]}>
                    <View style={[styles.gameDot, { backgroundColor: tint, opacity: on ? 1 : 0.55 }]} />
                    <AppText variant="label" numberOfLines={1} adjustsFontSizeToFit color={on ? color.text : color.muted} style={{ fontFamily: font.semibold }}>
                      {g}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {!chosen ? (
          <>
            <Field
              label={t('Najdi produkt')}
              value={query}
              onChangeText={setQuery}
              placeholder={market ? (game === 'Pokémon' ? 'charizard upc' : game === 'One Piece' ? 'romance dawn box' : 'origins display') : t('Načítám katalog produktů…')}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              editable={!!market}
              autoFocus
            />
            {results.length > 0 && (
              <Card style={{ gap: 0, paddingVertical: space.xs }}>
                {results.map((p, i) => {
                  const v = marketPrice(p);
                  return (
                    <Pressable key={p.id} onPress={() => pick(p)} style={({ pressed }) => [styles.result, i > 0 && styles.divider, pressed && { opacity: 0.6 }]}>
                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyStrong" numberOfLines={2}>
                          {p.name}
                        </AppText>
                        <AppText variant="caption" color={color.muted} numberOfLines={1}>
                          {p.category.replace(/^(Pokémon|One Piece|Riftbound) /, '')}
                        </AppText>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        {v != null ? (
                          <>
                            <AppText variant="bodyStrong" tabular>
                              {money(toCzk(v, p.currency, market), currency)}
                            </AppText>
                            <AppText variant="caption" color={color.faint}>
                              {formatSource(v, p.currency)}
                            </AppText>
                          </>
                        ) : (
                          <AppText variant="caption" color={color.faint}>
                            {t('bez ceny')}
                          </AppText>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </Card>
            )}
            <Pressable accessibilityRole="button" onPress={() => setCmId(null)} hitSlop={8} style={{ alignSelf: 'center', padding: space.sm }}>
              <AppText variant="label" color={color.accent2}>
                {t('Produkt nenajdu – zadat ručně')}
              </AppText>
            </Pressable>
          </>
        ) : (
          <>
            {cmId !== null ? (
              <Card style={styles.picked}>
                <ProductThumb item={{ game, name, productImage }} size={56} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyStrong" numberOfLines={3}>
                    {name}
                  </AppText>
                  <AppText variant="caption" color={color.muted}>
                    {unitPrice != null ? t('Na trhu {0} / ks', money(unitPrice, currency)) : t('Cena na trhu není známá')}
                  </AppText>
                </View>
                {!base && (
                  <Pressable accessibilityRole="button" onPress={() => setCmId(undefined)} hitSlop={8}>
                    <AppText variant="label" color={color.accent2}>
                      {t('Změnit')}
                    </AppText>
                  </Pressable>
                )}
              </Card>
            ) : (
              <Card>
                <Field label={t('Edice')} value={set} onChangeText={setSet} placeholder={game === 'Pokémon' ? 'Prismatic Evolutions' : ''} autoCorrect={false} />
                <AppText variant="label" color={color.muted}>
                  {t('Typ')}
                </AppText>
                <ChipRow>
                  {PRODUCT_TYPES.map((tp) => (
                    <Chip key={tp} label={t(tp)} active={tp === type} onPress={() => setType(tp)} />
                  ))}
                </ChipRow>
                <Field label={t('Název')} value={name} onChangeText={setName} placeholder={effectiveName || t('např. Prismatic Evolutions Elite Trainer Box')} />
                {!base && (
                  <Pressable accessibilityRole="button" onPress={() => setCmId(undefined)} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
                    <AppText variant="label" color={color.accent2}>
                      {t('Zpět na vyhledávání')}
                    </AppText>
                  </Pressable>
                )}
              </Card>
            )}

            <Card style={{ gap: space.lg }}>
              <Stepper label={t('Počet kusů')} value={qty} onChange={setQty} />
              <Field
                label={t('Nákupní cena za kus ({0})', cur)}
                value={buy}
                onChangeText={setBuy}
                keyboardType="decimal-pad"
                placeholder={unitPrice != null ? t('např. {0}', numStr(toDisplay(unitPrice, currency))) : '0'}
                hint={total != null && qty > 1 ? t('Celkem {0}', money(fromDisplay(total, currency), currency)) : undefined}
              />
              <DateField label={t('Datum nákupu')} value={buyDate} onChange={setBuyDate} />
            </Card>

            {more ? (
              <Card style={{ gap: space.lg }}>
                <Field label={t('Poštovné a poplatky celkem ({0})', cur)} value={fees} onChangeText={setFees} keyboardType="decimal-pad" placeholder="0" />
                <View style={{ gap: space.sm }}>
                  <AppText variant="label" color={color.muted}>
                    {t('Stav')}
                  </AppText>
                  <View style={styles.wrap}>
                    {CONDITIONS.map((c) => (
                      <Chip
                        key={c.id}
                        label={t(c.id)}
                        active={condition.includes(c.id)}
                        onPress={() => setCondition((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id]))}
                      />
                    ))}
                  </View>
                </View>
                <View style={{ gap: space.sm }}>
                  <AppText variant="label" color={color.muted}>
                    {t('Fotky ({0}/{1})', photos.length, MAX_PHOTOS)}
                  </AppText>
                  <PhotoStrip photos={photos} onRemove={(i) => setPhotos((p) => p.filter((_, k) => k !== i))} size={72} />
                  {process.env.EXPO_OS !== 'web' && photos.length < MAX_PHOTOS && (
                    <View style={{ flexDirection: 'row', gap: space.sm }}>
                      {photoBusy ? (
                        <ActivityIndicator color={color.accent2} />
                      ) : (
                        <>
                          <Chip label={t('Vyfotit')} onPress={() => void addPhotos('camera')} />
                          <Chip label={t('Z galerie')} onPress={() => void addPhotos('library')} />
                        </>
                      )}
                    </View>
                  )}
                </View>
                <Field label={t('Poznámka')} value={note} onChangeText={setNote} multiline style={{ minHeight: 80, paddingTop: 12, textAlignVertical: 'top' }} />
              </Card>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => setMore(true)} hitSlop={8} style={{ alignSelf: 'center', padding: space.sm }}>
                <AppText variant="label" color={color.accent2}>
                  {t('Poplatky, stav, fotky a poznámka')}
                </AppText>
              </Pressable>
            )}

            {error && <AppText color={color.neg}>{error}</AppText>}
            {saving ? (
              <ActivityIndicator color={color.accent2} style={{ minHeight: 50 }} />
            ) : (
              <View style={{ gap: space.sm }}>
                <Button label={editing ? t('Uložit změny') : t('Přidat do portfolia')} onPress={() => void save(false)} />
                {!editing && <Button variant="secondary" label={t('Uložit a přidat další')} onPress={() => void save(true)} />}
                {editing && (
                  <Pressable onPress={remove} style={styles.delete} accessibilityRole="button">
                    <AppText variant="bodyStrong" color={color.neg}>
                      {t('Smazat nákup')}
                    </AppText>
                  </Pressable>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  picked: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  games: { flexDirection: 'row', gap: space.sm },
  game: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  gameDot: { width: 10, height: 10, borderRadius: 5 },
  delete: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
});
