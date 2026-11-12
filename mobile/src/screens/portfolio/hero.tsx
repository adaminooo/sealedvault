import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import type { ItemStats } from '@/core/calc';
import { money, pct, signedMoney, tone } from '@/core/format';
import { t } from '@/core/i18n';
import type { Currency } from '@/core/types';
import { AppText, color, radius, space, toneColor } from '@/ui';
import { AnimatedNumber } from '@/ui/animated-number';
import { TrendPill } from '@/ui/pill';
import { WideSparkline } from '@/ui/sparkline';

type Props = {
  stats: ItemStats & { count: number };
  positions: number;
  currency: Currency;
  dayChange: { abs: number; pct: number } | null;
  trend: number[] | null;
};

/** Hlavní karta jako na webu: hodnota, zisk celkem, změna za den a křivka za souhrnem */
export function PortfolioHero({ stats, positions, currency, dayChange, trend }: Props) {
  const tn = tone(stats.profit);
  const glow = tn === 'neg' ? 'rgba(255,77,106,' : 'rgba(61,220,132,';
  const lineColor = trend && trend[trend.length - 1] < trend[0] ? color.neg : color.pos;

  return (
    <View style={[styles.card, { borderColor: `${glow}0.45)`, boxShadow: `0 0 32px ${glow}0.12)` }]}>
      <LinearGradient colors={[`${glow}0.16)`, 'rgba(13,13,18,0)', 'rgba(143,107,255,0.06)']} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      <View style={styles.top}>
        <AppText variant="overline" color={color.muted}>
          {t('Hodnota portfolia')}
        </AppText>
        <AnimatedNumber value={stats.value} format={(n) => money(n, currency)} />
        <View style={styles.line}>
          <TrendPill tone={tn} label={pct(stats.profitPct)} />
          <AppText variant="bodyStrong" tabular color={toneColor[tn]}>
            {signedMoney(stats.profit, currency)}
          </AppText>
          <AppText color={color.muted}>{t('celkem')}</AppText>
        </View>
        {dayChange && Math.abs(dayChange.pct) >= 0.05 && (
          <View style={styles.line}>
            <AppText variant="label" tabular color={toneColor[tone(dayChange.abs)]} style={{ fontFamily: 'Inter_600SemiBold' }}>
              {signedMoney(dayChange.abs, currency)}
            </AppText>
            <AppText variant="label" tabular color={toneColor[tone(dayChange.abs)]}>
              ({pct(dayChange.pct)})
            </AppText>
            <AppText variant="label" color={color.muted}>
              {t('za den')}
            </AppText>
          </View>
        )}
      </View>

      <View style={styles.bottom}>
        {trend && (
          <View style={styles.spark} pointerEvents="none">
            <WideSparkline values={trend} height={76} color={lineColor} fill />
          </View>
        )}
        <View style={styles.divider} />
        <View style={styles.stats}>
          <Stat label={t('Investováno')} value={money(stats.cost, currency)} />
          <Stat label={t('Položek')} value={String(positions)} />
          <Stat label={t('Kusů')} value={String(stats.held)} />
        </View>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="overline" color={color.muted}>
        {label}
      </AppText>
      <AppText variant="heading" tabular>
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
  top: { gap: space.sm, padding: space.xl, paddingBottom: space.md },
  line: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  bottom: { position: 'relative', paddingTop: space.lg },
  spark: { position: 'absolute', left: 0, right: 0, bottom: 0, opacity: 0.85 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.borderStrong, marginHorizontal: space.xl },
  stats: { flexDirection: 'row', gap: space.xxl, paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xl },
});
