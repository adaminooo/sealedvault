import { useMemo } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { totalStats } from '@/core/calc';
import { date, money, pct, signedMoney, tone } from '@/core/format';
import { t } from '@/core/i18n';
import { groupPositions } from '@/core/portfolio';
import { useMarket } from '@/data/queries';
import { items, useCollection } from '@/db/store';
import { AppText, Button, Card, Screen, color, space, toneColor } from '@/ui';
import { router } from 'expo-router';

export default function PortfolioScreen() {
  const list = useCollection(items);
  const market = useMarket();
  const stats = useMemo(() => totalStats(list), [list]);
  const positions = useMemo(() => groupPositions(list).filter((p) => p.stats.held > 0), [list]);
  const m = market.data;

  return (
    <Screen refreshControl={<RefreshControl tintColor={color.accent2} refreshing={market.isRefetching} onRefresh={() => void market.refetch()} />}>
      <Card style={styles.hero}>
        <AppText variant="overline" color={color.muted}>
          {t('Hodnota portfolia')}
        </AppText>
        <AppText variant="hero" tabular>
          {money(stats.value, 'CZK')}
        </AppText>
        <AppText variant="label" tabular color={toneColor[tone(stats.profit)]}>
          {signedMoney(stats.profit, 'CZK')} · {pct(stats.profitPct)}
        </AppText>
      </Card>

      {positions.length === 0 ? (
        <Card>
          <AppText variant="heading">{t('Zatím tu nic není')}</AppText>
          <AppText color={color.muted}>{t('Přidej první sealed produkt a sleduj jeho hodnotu.')}</AppText>
          <Button label={t('Přidat produkt')} onPress={() => router.push('/add')} style={{ marginTop: space.sm }} />
        </Card>
      ) : (
        <Card style={{ gap: 0, paddingVertical: space.xs }}>
          {positions.map((p, i) => (
            <View key={p.key} style={[styles.row, i > 0 && styles.divider]}>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {p.name}
                </AppText>
                <AppText variant="caption" color={color.muted}>
                  {p.stats.held}× · {p.game}
                </AppText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <AppText variant="bodyStrong" tabular>
                  {money(p.stats.value, 'CZK')}
                </AppText>
                <AppText variant="caption" tabular color={toneColor[tone(p.stats.profit)]}>
                  {pct(p.stats.profitPct)}
                </AppText>
              </View>
            </View>
          ))}
        </Card>
      )}

      <AppText variant="caption" color={color.faint} style={{ textAlign: 'center' }}>
        {m
          ? t('Ceny ze dne {0} · {1} produktů na trhu', date(m.priceDate.slice(0, 10)), m.products.length.toLocaleString())
          : market.isError
            ? t('Ceny se nepodařilo načíst – zkontroluj připojení k internetu.')
            : t('Načítám ceny…')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.xs, paddingVertical: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
});
