import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { memo, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { totalStats } from '@/core/calc';
import type { PriceChange } from '@/core/changes';
import { dirLabels, parseSort, SORT_FIELDS, type SortField } from '@/core/filters';
import { date, money, pct, signedMoney, tone } from '@/core/format';
import { t } from '@/core/i18n';
import { productUrl } from '@/core/market';
import type { Position } from '@/core/portfolio';
import { ALL_ID } from '@/core/portfolios';
import { GAMES, type Currency } from '@/core/types';
import { useMarket } from '@/data/queries';
import { useFilters, usePortfolios, usePortfolioView } from '@/data/use-portfolio';
import { useStoredState } from '@/data/use-stored-state';
import { items as itemsStore } from '@/db/store';
import { AppText, Button, Card, color, font, radius, space, toneColor } from '@/ui';
import { AnimatedNumber } from '@/ui/animated-number';
import { Chip, ChipRow } from '@/ui/chip';
import { Icon } from '@/ui/icon';
import { TrendPill } from '@/ui/pill';
import { ProductThumb } from '@/ui/product-thumb';
import { Sparkline, WideSparkline } from '@/ui/sparkline';

const IOS = process.env.EXPO_OS === 'ios';

export default function PortfolioScreen() {
  const market = useMarket();
  const [search, setSearch] = useState('');
  const view = usePortfolioView(search);
  const pf = usePortfolios();
  const [filters, setFilters] = useFilters();
  const [currency] = useStoredState<Currency>('currency', 'CZK');
  const stats = useMemo(() => totalStats(view.base), [view.base]);
  const games = useMemo(() => GAMES.filter((g) => view.pItems.some((i) => i.game === g)), [view.pItems]);
  const sort = parseSort(filters.sort);
  const m = market.data;
  const fmt = (n: number) => money(n, currency);
  const trendUp = view.trend ? view.trend[view.trend.length - 1] >= view.trend[0] : true;

  const header = (
    <View style={{ gap: space.lg, paddingBottom: space.md }}>
      {pf.list.length > 1 && (
        <ChipRow>
          <Chip label={t('Vše')} active={pf.active === ALL_ID} onPress={() => pf.setActive(ALL_ID)} />
          {pf.list.map((p) => (
            <Chip key={p.id} label={t(p.name)} active={pf.active === p.id} onPress={() => pf.setActive(p.id)} />
          ))}
        </ChipRow>
      )}

      {/* Hlavní karta: hodnota, výsledek, dnešní změna a vývoj za 90 dní */}
      <View style={styles.hero}>
        <LinearGradient
          colors={[trendUp ? 'rgba(61,220,132,0.10)' : 'rgba(255,77,106,0.10)', 'rgba(143,107,255,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ gap: space.sm, padding: space.xl, paddingBottom: space.md }}>
          <AppText variant="overline" color={color.muted}>
            {t('Hodnota portfolia')}
          </AppText>
          <AnimatedNumber value={stats.value} format={fmt} />
          <View style={styles.pills}>
            <TrendPill tone={tone(stats.profit)} label={`${signedMoney(stats.profit, currency)} · ${pct(stats.profitPct)}`} />
            {view.dayChange && Math.abs(view.dayChange.pct) >= 0.05 && (
              <TrendPill tone={tone(view.dayChange.abs)} label={`${t('Dnes')} ${pct(view.dayChange.pct)}`} />
            )}
          </View>
        </View>
        {view.trend ? (
          <View accessibilityLabel={t('Vývoj hodnoty za 90 dní')}>
            <View style={styles.trendHead}>
              <AppText variant="caption" color={color.faint}>
                {t('Držené kusy · 90 dní')}
              </AppText>
              <AppText variant="caption" tabular color={trendUp ? color.pos : color.neg}>
                {pct(view.trend[0] > 0 ? ((view.trend[view.trend.length - 1] - view.trend[0]) / view.trend[0]) * 100 : null)}
              </AppText>
            </View>
            <WideSparkline values={view.trend} height={84} color={trendUp ? color.pos : color.neg} fill />
          </View>
        ) : (
          <View style={{ height: space.sm }} />
        )}
        <View style={styles.stats}>
          <Stat label={t('Investováno')} value={fmt(stats.cost)} />
          <View style={styles.statDivider} />
          <Stat label={t('Kusů')} value={String(stats.held)} />
          <View style={styles.statDivider} />
          <Stat label={t('Realizováno')} value={signedMoney(stats.realized, currency)} tint={stats.realized ? toneColor[tone(stats.realized)] : undefined} />
        </View>
      </View>

      {games.length > 1 && (
        <ChipRow>
          <Chip label={t('Vše')} active={filters.game === 'all'} onPress={() => setFilters({ ...filters, game: 'all' })} />
          {games.map((g) => (
            <Chip key={g} label={g} active={filters.game === g} onPress={() => setFilters({ ...filters, game: g })} />
          ))}
        </ChipRow>
      )}

      {view.positions.length > 0 && (
        <View style={styles.listHead}>
          <AppText variant="overline" color={color.muted}>
            {search.trim() ? t('Výsledky hledání') : t('Produkty')} · {view.positions.length}
          </AppText>
          {!IOS && (
            <Pressable onPress={() => router.push('/sort')} hitSlop={8} style={styles.sortBtn} accessibilityRole="button">
              <Icon sf="arrow.up.arrow.down" md="sort" size={14} color={color.accent2} />
              <AppText variant="caption" color={color.accent2}>
                {t(SORT_FIELDS[sort.field])}
              </AppText>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );

  return (
    <>
      <Stack.SearchBar placeholder={t('Hledat v portfoliu')} onChangeText={(e) => setSearch(e.nativeEvent.text)} onCancelButtonPress={() => setSearch('')} hideWhenScrolling />
      {IOS ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon="arrow.up.arrow.down" accessibilityLabel={t('Řazení')}>
            {(Object.keys(SORT_FIELDS) as SortField[]).map((field) => (
              <Stack.Toolbar.Menu key={field} inline title={t(SORT_FIELDS[field])}>
                {(['desc', 'asc'] as const).map((dir) => (
                  <Stack.Toolbar.MenuAction key={dir} isOn={sort.field === field && sort.dir === dir} onPress={() => setFilters({ ...filters, sort: `${field}-${dir}` })}>
                    {`${t(SORT_FIELDS[field])} · ${t(dirLabels(field)[dir])}`}
                  </Stack.Toolbar.MenuAction>
                ))}
              </Stack.Toolbar.Menu>
            ))}
          </Stack.Toolbar.Menu>
          <Stack.Toolbar.Button icon="plus" onPress={() => router.push('/add')} accessibilityLabel={t('Přidat produkt')} />
        </Stack.Toolbar>
      ) : (
        <Stack.Screen
          options={{
            headerRight: () => (
              <Pressable onPress={() => router.push('/add')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Přidat produkt')} style={styles.addBtn}>
                <Icon sf="plus" md="add" size={22} color={color.accent2} />
              </Pressable>
            ),
          }}
        />
      )}
      <FlashList
        data={view.positions}
        keyExtractor={(p) => p.key}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        style={{ backgroundColor: color.bg }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 3 }}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl tintColor={color.accent2} refreshing={market.isRefetching} onRefresh={() => void market.refetch()} />}
        renderItem={({ item, index }) => (
          <PositionRow
            p={item}
            first={index === 0}
            last={index === view.positions.length - 1}
            currency={currency}
            change={item.head.cmProductId ? view.changes.get(item.head.cmProductId) : undefined}
            spark={item.head.cmProductId ? view.spark.get(item.head.cmProductId) : undefined}
            marketUrl={item.head.cmProductId && m?.byId.get(item.head.cmProductId) ? productUrl(m.byId.get(item.head.cmProductId)!) : undefined}
          />
        )}
        ListEmptyComponent={
          view.pItems.length === 0 ? (
            <Card style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon sf="shippingbox" md="inventory-2" size={30} color={color.accent2} />
              </View>
              <AppText variant="heading" style={{ textAlign: 'center' }}>
                {t('Zatím tu nic není')}
              </AppText>
              <AppText color={color.muted} style={{ textAlign: 'center' }}>
                {t('Přidej první sealed produkt a sleduj jeho hodnotu.')}
              </AppText>
              <Button label={t('Přidat produkt')} onPress={() => router.push('/add')} style={{ marginTop: space.sm, alignSelf: 'stretch' }} />
            </Card>
          ) : (
            <View style={[styles.empty, { paddingVertical: space.xl }]}>
              <Icon sf="magnifyingglass" md="search-off" size={26} color={color.faint} />
              <AppText color={color.muted} style={{ textAlign: 'center' }}>
                {search.trim() ? t('Nic neodpovídá „{0}“.', search.trim()) : t('Filtrům neodpovídá žádná položka.')}
              </AppText>
            </View>
          )
        }
        ListFooterComponent={
          <AppText variant="caption" color={color.faint} style={{ textAlign: 'center', marginTop: space.xl }}>
            {m
              ? t('Ceny ze dne {0} · {1} produktů na trhu', date(m.priceDate.slice(0, 10)), m.products.length.toLocaleString())
              : market.isError
                ? t('Ceny se nepodařilo načíst – zkontroluj připojení k internetu.')
                : t('Načítám ceny…')}
          </AppText>
        }
      />
    </>
  );
}

function Stat({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <AppText variant="caption" color={color.faint}>
        {label}
      </AppText>
      <AppText variant="label" tabular color={tint ?? color.text} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
    </View>
  );
}

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

type RowProps = { p: Position; first: boolean; last: boolean; currency: Currency; change?: PriceChange; spark?: number[]; marketUrl?: string };

const PositionRow = memo(function PositionRow({ p, first, last, currency, change, spark, marketUrl }: RowProps) {
  const d1 = change?.d1;
  return (
    <Link href={{ pathname: '/product/[key]', params: { key: p.key } }} asChild>
      <Link.Trigger>
        <Pressable accessibilityRole="button">
          {({ pressed }) => (
            <View style={[styles.row, first && styles.rowFirst, last && styles.rowLast, !first && styles.divider, pressed && { backgroundColor: color.surface2 }]}>
              <ProductThumb item={p.head} size={52} />
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="label" numberOfLines={2} style={{ fontFamily: font.semibold }}>
                  {p.name}
                </AppText>
                <View style={styles.sub}>
                  <AppText variant="caption" color={color.muted} numberOfLines={1}>
                    {p.stats.held}× {t(p.head.type)}
                  </AppText>
                  {spark && <Sparkline values={spark} width={34} height={14} color={spark[spark.length - 1] >= spark[0] ? color.pos : color.neg} />}
                  {d1 != null && Math.abs(d1) >= 0.05 && (
                    <AppText variant="caption" tabular color={toneColor[tone(d1)]}>
                      {pct(d1)}
                    </AppText>
                  )}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <AppText variant="bodyStrong" tabular>
                  {money(p.stats.value, currency)}
                </AppText>
                <TrendPill small tone={tone(p.stats.profit)} label={pct(p.stats.profitPct)} />
              </View>
            </View>
          )}
        </Pressable>
      </Link.Trigger>
      <Link.Preview />
      <Link.Menu>
        {p.stats.held > 0 && <Link.MenuAction title={t('Prodat')} icon="banknote" onPress={() => router.push({ pathname: '/sell/[key]', params: { key: p.key } })} />}
        <Link.MenuAction title={t('Přidat další nákup')} icon="plus.circle" onPress={() => router.push({ pathname: '/add', params: { from: p.key } })} />
        {marketUrl ? <Link.MenuAction title={t('Otevřít na trhu')} icon="safari" onPress={() => void WebBrowser.openBrowserAsync(marketUrl)} /> : null}
        <Link.MenuAction title={t('Smazat')} icon="trash" destructive onPress={() => confirmDelete(p)} />
      </Link.Menu>
    </Link>
  );
});

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.lg + 4,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  trendHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingBottom: space.xs },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: color.border },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtn: { paddingHorizontal: space.sm },
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
  rowFirst: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  rowLast: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  sub: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(143,107,255,0.14)', marginBottom: space.xs },
});
