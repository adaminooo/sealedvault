import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import type { ItemStats } from '@/core/calc';
import { date, money, pct, signedMoney, tone } from '@/core/format';
import { t } from '@/core/i18n';
import type { Currency } from '@/core/types';
import { AppText, color, radius, space, toneColor } from '@/ui';
import { AnimatedNumber } from '@/ui/animated-number';
import { Glow } from '@/ui/glow';
import { LineChart } from '@/ui/line-chart';
import { TrendPill } from '@/ui/pill';

const POS = { h1: 'rgba(61,220,132,0.8)', h2: 'rgba(52,199,160,0.4)', glow: 'rgba(61,220,132,0.22)', glowSolid: '#3ddc84', glow2Solid: '#34c7a0' };
const NEG = { h1: 'rgba(255,77,106,0.8)', h2: 'rgba(255,159,67,0.45)', glow: 'rgba(255,77,106,0.22)', glowSolid: '#ff4d6a', glow2Solid: '#ff9f43' };
const NEUTRAL = { h1: 'rgba(143,107,255,0.75)', h2: 'rgba(79,125,255,0.55)', glow: 'rgba(143,107,255,0.26)', glowSolid: '#8f6bff', glow2Solid: '#4f7dff' };

/** Jemný tečkovaný vzor karty (16 px) */
function Dots() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="heroDots" width={16} height={16} patternUnits="userSpaceOnUse">
          <Circle cx={1} cy={1} r={1} fill="rgba(255,255,255,0.045)" />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#heroDots)" />
    </Svg>
  );
}

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
  // barvy karty podle výsledku (jako na webu): okraj, záře
  const pal = tn === 'neg' ? NEG : tn === 'pos' ? POS : NEUTRAL;

  const first = trend?.[0]?.[1];
  const last = trend?.[trend.length - 1]?.[1];
  const periodAbs = first != null && last != null ? last - first : null;
  const periodPct = first && periodAbs != null ? (periodAbs / first) * 100 : null;
  const lineColor = periodAbs != null && periodAbs < 0 ? color.neg : color.pos;
  const point = scrub != null && trend ? trend[scrub] : null;

  return (
    <LinearGradient colors={[pal.h1, 'rgba(255,255,255,0.06)', pal.h2]} locations={[0, 0.45, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.border, { boxShadow: `0 24px 50px -28px ${pal.glow}` }]}>
    <View style={styles.card}>
      <LinearGradient colors={['#121219', '#0b0b10']} style={StyleSheet.absoluteFill} />
      <Dots />
      <Glow size={340} color={pal.glowSolid} opacity={0.22} style={{ right: -90, bottom: -150 }} drift={{ x: -50, y: -30, scale: 1.15, ms: 18000 }} />
      <Glow size={360} color={pal.glow2Solid} opacity={0.14} style={{ left: -120, top: -140 }} drift={{ x: 60, y: 40, scale: 1.15, ms: 14000 }} />

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
                    {signedMoney(Math.round(dayChange.abs), currency)}
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
    </LinearGradient>
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
  border: { borderRadius: radius.lg + 4, borderCurve: 'continuous', padding: 1 },
  card: {
    borderRadius: radius.lg + 3,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: '#0d0d12',
  },
  top: { gap: space.xs, paddingHorizontal: space.xl, paddingTop: space.xl },
  results: { flexDirection: 'row', gap: space.lg, marginTop: space.sm },
  result: { flex: 1, gap: 4, minWidth: 0 },
  resultLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.sm, rowGap: 4 },
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
