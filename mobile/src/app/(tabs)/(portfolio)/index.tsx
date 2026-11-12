import { FlashList } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { memo, useMemo } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { totalStats } from '@/core/calc';
import type { PriceChange } from '@/core/changes';
import { DEFAULT_FILTERS, parseSort, SORT_FIELDS } from '@/core/filters';
import { date, money, pct, signedMoney, tone } from '@/core/format';
import { t } from '@/core/i18n';
import type { Position } from '@/core/portfolio';
import { ALL_ID } from '@/core/portfolios';
import { GAMES, type Currency } from '@/core/types';
import { useMarket } from '@/data/queries';
import { useFilters, usePortfolios, usePortfolioView } from '@/data/use-portfolio';
import { useStoredState } from '@/data/use-stored-state';
import { AppText, Button, Card, color, space, toneColor } from '@/ui';
import { Chip, ChipRow } from '@/ui/chip';
import { ProductThumb } from '@/ui/product-thumb';
import { Sparkline, WideSparkline } from '@/ui/sparkline';

export default function PortfolioScreen() {
  const market = useMarket();
  const view = usePortfolioView();
  const pf = usePortfolios();
  const [filters, setFilters] = useFilters();
  const [currency] = useStoredState<Currency>('currency', 'CZK');
  const stats = useMemo(() => totalStats(view.visible), [view.visible]);
  const games = useMemo(() => GAMES.filter((g) => view.pItems.some((i) => i.game === g)), [view.pItems]);
  const sort = parseSort(filters.sort);
  const m = market.data;

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

      <Card style={styles.hero}>
        <AppText variant="overline" color={color.muted}>
          {t('Hodnota portfolia')}
        </AppText>
        <AppText variant="hero" tabular adjustsFontSizeToFit numberOfLines={1}>
          {money(stats.value, currency)}
        </AppText>
        <View style={styles.heroLine}>
          <AppText variant="label" tabular color={toneColor[tone(stats.profit)]}>
            {signedMoney(stats.profit, currency)} · {pct(stats.profitPct)}
          </AppText>
          {view.dayChange && Math.abs(view.dayChange.pct) >= 0.05 && (
            <AppText variant="label" tabular color={toneColor[tone(view.dayChange.abs)]}>
              {t('Dnes')} {signedMoney(view.dayChange.abs, currency)}
            </AppText>
          )}
        </View>
        {view.trend && (
          <View style={{ marginTop: space.sm }} accessibilityLabel={t('Vývoj hodnoty za 90 dní')}>
            <WideSparkline values={view.trend} height={56} color={view.trend[view.trend.length - 1] >= view.trend[0] ? color.pos : color.neg} fill />
          </View>
        )}
        <AppText variant="caption" color={color.faint}>
          {t('Investováno {0} · {1} ks', money(stats.cost, currency), stats.held)}
        </AppText>
      </Card>

      {view.pItems.length > 0 && (
        <ChipRow>
          <Chip label={`${t(SORT_FIELDS[sort.field])} ${sort.dir === 'desc' ? '↓' : '↑'}`} active onPress={() => router.push('/sort')} />
          {games.length > 1 && <Chip label={t('Vše')} active={filters.game === 'all'} onPress={() => setFilters({ ...filters, game: 'all' })} />}
          {games.length > 1 &&
            games.map((g) => <Chip key={g} label={g} active={filters.game === g} onPress={() => setFilters({ ...filters, game: g })} />)}
          {filters.game !== 'all' && games.length <= 1 && <Chip label={t('Zrušit filtry')} onPress={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })} />}
        </ChipRow>
      )}
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/add')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Přidat produkt')}>
              <AppText variant="heading" color={color.accent2}>
                ＋
              </AppText>
            </Pressable>
          ),
        }}
      />
      <FlashList
        data={view.positions}
        keyExtractor={(p) => p.key}
        contentInsetAdjustmentBehavior="automatic"
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
          />
        )}
        ListEmptyComponent={
          view.pItems.length === 0 ? (
            <Card>
              <AppText variant="heading">{t('Zatím tu nic není')}</AppText>
              <AppText color={color.muted}>{t('Přidej první sealed produkt a sleduj jeho hodnotu.')}</AppText>
              <Button label={t('Přidat produkt')} onPress={() => router.push('/add')} style={{ marginTop: space.sm }} />
            </Card>
          ) : (
            <AppText color={color.muted} style={{ textAlign: 'center', paddingVertical: space.xl }}>
              {t('Filtrům neodpovídá žádná položka.')}
            </AppText>
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

type RowProps = { p: Position; first: boolean; last: boolean; currency: Currency; change?: PriceChange; spark?: number[] };

const PositionRow = memo(function PositionRow({ p, first, last, currency, change, spark }: RowProps) {
  const d1 = change?.d1;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/product/[key]', params: { key: p.key } })}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, first && styles.rowFirst, last && styles.rowLast, !first && styles.divider, pressed && { backgroundColor: color.surface2 }]}>
      <ProductThumb item={p.head} size={46} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {p.name}
        </AppText>
        <AppText variant="caption" color={color.muted} numberOfLines={1}>
          {p.stats.held}× · {t(p.head.type)}
          {d1 != null && Math.abs(d1) >= 0.05 ? (
            <AppText variant="caption" color={toneColor[tone(d1)]}>
              {'  '}
              {pct(d1)} {t('1D')}
            </AppText>
          ) : null}
        </AppText>
      </View>
      {spark && <Sparkline values={spark} width={44} height={22} color={spark[spark.length - 1] >= spark[0] ? color.pos : color.neg} />}
      <View style={{ alignItems: 'flex-end', minWidth: 84 }}>
        <AppText variant="bodyStrong" tabular>
          {money(p.stats.value, currency)}
        </AppText>
        <AppText variant="caption" tabular color={toneColor[tone(p.stats.profit)]}>
          {pct(p.stats.profitPct)}
        </AppText>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  hero: { gap: space.xs, paddingVertical: space.xl },
  heroLine: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md },
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
  rowFirst: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  rowLast: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
});
