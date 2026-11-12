import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { totalStats } from '@/core/calc';
import { dirLabels, parseSort, SORT_FIELDS, type SortField } from '@/core/filters';
import { t } from '@/core/i18n';
import { productUrl } from '@/core/market';
import { ALL_ID, portfolioOf } from '@/core/portfolios';
import { GAMES, type Currency } from '@/core/types';
import { useMarket } from '@/data/queries';
import { useFilters, usePortfolios, usePortfolioView } from '@/data/use-portfolio';
import { useStoredState } from '@/data/use-stored-state';
import { Allocation } from '@/screens/portfolio/allocation';
import { PortfolioHero } from '@/screens/portfolio/hero';
import { PositionCard, PositionRow } from '@/screens/portfolio/position-item';
import { AppText, Button, Card, color, radius, space } from '@/ui';
import { Chip, ChipRow } from '@/ui/chip';
import { Icon } from '@/ui/icon';

const IOS = process.env.EXPO_OS === 'ios';
type ListView = 'list' | 'grid';

/** Značka v hlavičce (jako na webu): logo + Sealed + fialové Vault */
function Brand() {
  return (
    <View style={styles.brand}>
      <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
      <AppText style={styles.brandText}>
        Sealed<AppText style={[styles.brandText, { color: color.accent2 }]}>Vault</AppText>
      </AppText>
    </View>
  );
}

export default function PortfolioScreen() {
  const market = useMarket();
  const [search, setSearch] = useState('');
  const view = usePortfolioView(search);
  const pf = usePortfolios();
  const [filters, setFilters] = useFilters();
  const [currency] = useStoredState<Currency>('currency', 'CZK');
  const [listView, setListView] = useStoredState<ListView>('view', 'list');
  const stats = useMemo(() => totalStats(view.base), [view.base]);
  const sort = parseSort(filters.sort);
  const m = market.data;
  const grid = listView === 'grid';
  const urlOf = (id?: number) => (id && m?.byId.get(id) ? productUrl(m.byId.get(id)!) : undefined);
  const countIn = (id: string) => new Set(view.all.filter((i) => portfolioOf(i) === id).map((i) => i.cmProductId ?? i.name)).size;

  const header = (
    <View style={{ gap: space.lg, paddingBottom: space.md }}>
      {pf.list.length > 1 && (
        <ChipRow>
          <Chip label={t('Vše')} active={pf.active === ALL_ID} onPress={() => pf.setActive(ALL_ID)} />
          {pf.list.map((p) => (
            <Chip key={p.id} label={`${t(p.name)}  ${countIn(p.id)}`} active={pf.active === p.id} onPress={() => pf.setActive(p.id)} />
          ))}
        </ChipRow>
      )}

      {view.pItems.length > 0 && <PortfolioHero stats={stats} positions={view.positions.length} currency={currency} dayChange={view.dayChange} trend={view.trend} />}
      {view.pItems.length > 0 && <Allocation items={view.pItems} currency={currency} active={filters.game} onPick={(g) => setFilters({ ...filters, game: g })} />}

      {view.pItems.length > 0 && (
        <>
          <View style={styles.listHead}>
            <View style={styles.titleRow}>
              <AppText variant="heading">{search.trim() ? t('Výsledky') : t('Položky')}</AppText>
              <View style={styles.count}>
                <AppText variant="caption" tabular color={color.muted}>
                  {view.positions.length}
                </AppText>
              </View>
            </View>
            <View style={styles.tools}>
              <View style={styles.seg}>
                {(['list', 'grid'] as const).map((v) => (
                  <Pressable key={v} onPress={() => setListView(v)} style={[styles.segBtn, listView === v && styles.segOn]} accessibilityRole="button" accessibilityLabel={v === 'list' ? t('Seznam') : t('Mřížka')} accessibilityState={{ selected: listView === v }}>
                    <Icon sf={v === 'list' ? 'list.bullet' : 'square.grid.2x2'} md={v === 'list' ? 'view-list' : 'grid-view'} size={15} color={listView === v ? color.bg : color.muted} />
                  </Pressable>
                ))}
              </View>
              {!IOS && (
                <Pressable onPress={() => router.push('/sort')} style={styles.sortBtn} accessibilityRole="button">
                  <AppText variant="overline" color={color.faint}>
                    {t('Řadit')}
                  </AppText>
                  <AppText variant="caption" color={color.text}>
                    {t(SORT_FIELDS[sort.field])} {sort.dir === 'desc' ? '↓' : '↑'}
                  </AppText>
                </Pressable>
              )}
            </View>
          </View>
          <ChipRow>
            <Chip label={t('Vše')} active={filters.game === 'all'} onPress={() => setFilters({ ...filters, game: 'all' })} />
            {GAMES.map((g) => (
              <Chip key={g} label={g} active={filters.game === g} onPress={() => setFilters({ ...filters, game: g })} />
            ))}
          </ChipRow>
        </>
      )}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: '', headerLargeTitle: false, headerLeft: () => <Brand /> }} />
      <Stack.SearchBar placeholder={t('Hledat…')} onChangeText={(e) => setSearch(e.nativeEvent.text)} onCancelButtonPress={() => setSearch('')} hideWhenScrolling />
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
          <Stack.Toolbar.Button icon="plus" variant="prominent" tintColor={color.accent} onPress={() => router.push('/add')} accessibilityLabel={t('Přidat produkt')} />
        </Stack.Toolbar>
      ) : (
        <Stack.Screen
          options={{
            headerRight: () => (
              <Pressable onPress={() => router.push('/add')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Přidat produkt')} style={styles.addBtn}>
                <Icon sf="plus" md="add" size={20} color="#fff" />
              </Pressable>
            ),
          }}
        />
      )}
      <FlashList
        key={listView}
        data={view.positions}
        numColumns={grid ? 2 : 1}
        keyExtractor={(p) => p.key}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        style={{ backgroundColor: color.bg }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 3 }}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl tintColor={color.accent2} refreshing={market.isRefetching} onRefresh={() => void market.refetch()} />}
        renderItem={({ item, index }) => {
          const props = {
            p: item,
            first: index === 0,
            last: index === view.positions.length - 1,
            currency,
            change: item.head.cmProductId ? view.changes.get(item.head.cmProductId) : undefined,
            spark: item.head.cmProductId ? view.spark.get(item.head.cmProductId) : undefined,
            marketUrl: urlOf(item.head.cmProductId),
          };
          return grid ? <PositionCard {...props} /> : <PositionRow {...props} />;
        }}
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
      />
    </>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: IOS ? space.sm : 0 },
  logo: { width: 30, height: 30, borderRadius: 8 },
  brandText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, letterSpacing: -0.4, color: color.text },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: color.accent, marginRight: space.sm },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  count: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface2 },
  tools: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  seg: { flexDirection: 'row', backgroundColor: color.surface2, borderRadius: radius.sm, padding: 3 },
  segBtn: { width: 34, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: color.text },
  sortBtn: { paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: color.surface2 },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(143,107,255,0.14)', marginBottom: space.xs },
});
