import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { totalStats } from '@/core/calc';
import { money, pct, signedMoney, tone } from '@/core/format';
import { t } from '@/core/i18n';
import { GAMES, type Currency, type Game, type PortfolioItem } from '@/core/types';
import { AppText, color, radius, space, toneColor } from '@/ui';
import { Donut } from '@/ui/donut';
import { GAME_COLOR } from '@/ui/product-thumb';

type Mode = 'value' | 'cost';

/**
 * Rozložení portfolia podle hry (jako na webu). Navíc: klepnutím na hru se seznam vyfiltruje
 * jen na ni (znovu klepnout = zrušit filtr).
 */
export function Allocation({ items, currency, active, onPick }: { items: PortfolioItem[]; currency: Currency; active: Game | 'all'; onPick: (g: Game | 'all') => void }) {
  const [mode, setMode] = useState<Mode>('value');
  const rows = useMemo(
    () =>
      GAMES.map((g) => {
        const s = totalStats(items.filter((i) => i.game === g));
        return { game: g, value: s.value, cost: s.cost, profit: s.profit, pct: s.profitPct };
      }),
    [items],
  );
  const total = rows.reduce((a, r) => a + r[mode], 0);
  const shareOf = (r: (typeof rows)[number]) => (total > 0 ? r[mode] / total : 0);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <AppText variant="heading">{t('Rozložení')}</AppText>
        <View style={styles.seg}>
          {(['value', 'cost'] as const).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={[styles.segBtn, mode === m && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}>
              <AppText variant="caption" color={mode === m ? color.bg : color.muted} style={{ fontFamily: 'Inter_600SemiBold' }}>
                {m === 'value' ? t('Hodnota') : t('Investice')}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.donutWrap}>
          <Donut segments={rows.map((r) => ({ key: r.game, share: shareOf(r), color: GAME_COLOR[r.game] }))} highlight={active === 'all' ? null : active} />
          <View style={styles.center} pointerEvents="none">
            <AppText variant="overline" color={color.muted}>
              {t('Celkem')}
            </AppText>
            <AppText variant="label" tabular style={{ fontFamily: 'SpaceGrotesk_700Bold' }} adjustsFontSizeToFit numberOfLines={1}>
              {money(total, currency)}
            </AppText>
          </View>
        </View>

        <View style={{ flex: 1, gap: space.md }}>
          {rows.map((r) => {
            const on = active === r.game;
            const dim = active !== 'all' && !on;
            return (
              <Pressable
                key={r.game}
                onPress={() => {
                  if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                  onPick(on ? 'all' : r.game);
                }}
                style={({ pressed }) => [styles.legend, (pressed || dim) && { opacity: 0.45 }]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityHint={t('Vyfiltruje seznam na tuto hru')}>
                <View style={[styles.swatch, { backgroundColor: GAME_COLOR[r.game] }]} />
                <View style={{ flex: 1 }}>
                  <AppText variant="label" style={{ fontFamily: 'Inter_600SemiBold' }}>
                    {r.game}
                  </AppText>
                  <AppText variant="caption" tabular color={color.muted}>
                    {money(r[mode], currency)}
                  </AppText>
                  {r.cost > 0 ? (
                    <AppText variant="caption" tabular color={toneColor[tone(r.profit)]}>
                      {signedMoney(r.profit, currency)} · {pct(r.pct)}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="bodyStrong" tabular>
                  {Math.round(shareOf(r) * 100)} %
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.lg + 4,
    borderCurve: 'continuous',
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seg: { flexDirection: 'row', backgroundColor: color.surface2, borderRadius: radius.sm, padding: 3 },
  segBtn: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: 9 },
  segOn: { backgroundColor: color.text },
  body: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  donutWrap: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', paddingHorizontal: 22 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});
