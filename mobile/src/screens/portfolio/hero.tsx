import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ItemStats } from '@/core/calc';
import { date, money, pct, signedMoney, tone } from '@/core/format';
import { t } from '@/core/i18n';
import type { Currency } from '@/core/types';
import { AppText, color, radius, space, toneColor } from '@/ui';
import { AnimatedNumber } from '@/ui/animated-number';
import { LineChart } from '@/ui/line-chart';
import { TrendPill } from '@/ui/pill';

type Props = {
  stats: ItemStats & { count: number };
  positions: number;
  currency: Currency;
  dayChange: { abs: number; pct: number } | null;
  /** Skutečná denní hodnota držených kusů za 90 dní [datum, Kč] */
  trend: [string, number][] | null;
};

/**
 * Hlavní karta: hodnota, výsledek celkem a za den, graf posledních 90 dní (táhni prstem
 * a hodnota nahoře ukáže daný den) a souhrn ve spodní liště.
 */
export function PortfolioHero({ stats, positions, currency, dayChange, trend }: Props) {
  const [scrub, setScrub] = useState<number | null>(null);
  const tn = tone(stats.profit);
  const glow = tn === 'neg' ? 'rgba(255,77,106,' : 'rgba(61,220,132,';

  const first = trend?.[0]?.[1];
  const last = trend?.[trend.length - 1]?.[1];
  const periodAbs = first != null && last != null ? last - first : null;
  const periodPct = first && periodAbs != null ? (periodAbs / first) * 100 : null;
  const lineColor = periodAbs != null && periodAbs < 0 ? color.neg : color.pos;
  const point = scrub != null && trend ? trend[scrub] : null;

  return (
    <View style={[styles.card, { borderColor: `${glow}0.35)` }]}>
      <LinearGradient colors={[`${glow}0.12)`, 'rgba(13,13,18,0)']} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.8 }} style={StyleSheet.absoluteFill} />

      {/* Hodnota a výsledek */}
      <View style={styles.top}>
        <AppText variant="overline" color={color.muted}>
          {point ? date(point[0]) : t('Hodnota portfolia')}
        </AppText>
        {point ? (
          <AppText variant="hero" tabular numberOfLines={1} adjustsFontSizeToFit>
            {money(point[1], currency)}
          </AppText>
        ) : (
          <AnimatedNumber value={stats.value} format={(n) => money(n, currency)} />
        )}
        {point ? (
          <AppText variant="label" color={color.muted}>
            {t('Hodnota toho, co dnes držíš, v daný den')}
          </AppText>
        ) : (
          <View style={styles.results}>
            <View style={styles.result}>
              <AppText variant="caption" color={color.muted}>
                {t('Celkem')}
              </AppText>
              <View style={styles.resultLine}>
                <AppText variant="bodyStrong" tabular color={toneColor[tn]}>
                  {signedMoney(stats.profit, currency)}
                </AppText>
                <TrendPill small tone={tn} label={pct(stats.profitPct)} />
              </View>
            </View>
            {dayChange && (
              <View style={styles.result}>
                <AppText variant="caption" color={color.muted}>
                  {t('Dnes')}
                </AppText>
                <View style={styles.resultLine}>
                  <AppText variant="bodyStrong" tabular color={toneColor[tone(dayChange.abs)]}>
                    {signedMoney(dayChange.abs, currency)}
                  </AppText>
                  <TrendPill small tone={tone(dayChange.abs)} label={pct(dayChange.pct)} />
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Graf 90 dní ze skutečných denních cen */}
      {trend && trend.length >= 2 && (
        <View style={styles.chart}>
          <LineChart points={trend} height={110} color={lineColor} onScrub={setScrub} />
          <View style={styles.chartCaption}>
            <AppText variant="caption" color={color.faint}>
              {t('Posledních 90 dní')}
            </AppText>
            {periodAbs != null && (
              <AppText variant="caption" tabular color={toneColor[tone(periodAbs)]}>
                {signedMoney(periodAbs, currency)} · {pct(periodPct)}
              </AppText>
            )}
          </View>
        </View>
      )}

      {/* Souhrn */}
      <View style={styles.footer}>
        <Stat label={t('Investováno')} value={money(stats.cost, currency)} />
        <View style={styles.vline} />
        <Stat label={t('Produktů')} value={String(positions)} />
        <View style={styles.vline} />
        <Stat label={t('Kusů')} value={String(stats.held)} />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="caption" color={color.muted}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" tabular numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg + 4,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: color.surface,
  },
  top: { gap: space.xs, paddingHorizontal: space.xl, paddingTop: space.xl },
  results: { flexDirection: 'row', gap: space.xl, marginTop: space.sm },
  result: { gap: 2 },
  resultLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chart: { paddingHorizontal: space.md, paddingTop: space.lg, gap: space.xs },
  chartCaption: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.sm },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.lg,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: space.sm },
  vline: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: color.border },
});
