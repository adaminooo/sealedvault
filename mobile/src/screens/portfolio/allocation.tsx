import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { totalStats } from '@/core/calc';
import { money, pct, tone } from '@/core/format';
import { t } from '@/core/i18n';
import { GAMES, type Currency, type Game, type PortfolioItem } from '@/core/types';
import { AppText, color, font, gameColor, radius, space, toneColor } from '@/ui';
import { Donut } from '@/ui/donut';
import { Glow } from '@/ui/glow';

type Mode = 'value' | 'cost';

/**
 * Rozložení portfolia podle hry. Klepnutím na hru se seznam pod tím vyfiltruje jen na ni
 * (znovu klepnout = zrušit filtr). Hry bez produktů jsou ztlumené dole.
 */
export function Allocation({ items, currency, active, onPick }: { items: PortfolioItem[]; currency: Currency; active: Game | 'all'; onPick: (g: Game | 'all') => void }) {
  const [mode, setMode] = useState<Mode>('value');
  const rows = useMemo(
    () =>
      GAMES.map((g) => {
        const s = totalStats(items.filter((i) => i.game === g));
        return { game: g, value: s.value, cost: s.cost, profit: s.profit, pct: s.profitPct, held: s.held };
      }),
    [items],
  );
  const total = rows.reduce((a, r) => a + r[mode], 0);
  const shareOf = (r: (typeof rows)[number]) => (total > 0 ? r[mode] / total : 0);
  // hry s produkty nahoře podle podílu, prázdné dole
  const sorted = [...rows].sort((a, b) => Number(b.held > 0) - Number(a.held > 0) || b[mode] - a[mode]);
  const focus = active === 'all' ? null : rows.find((r) => r.game === active);

  return (
    <LinearGradient colors={['rgba(143,107,255,0.55)', 'rgba(255,255,255,0.05)', 'rgba(79,125,255,0.4)']} locations={[0, 0.5, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.border}>
      <View style={styles.card}>
        <LinearGradient colors={['#121219', '#0b0b10']} style={StyleSheet.absoluteFill} />
        <Glow size={300} color="#8f6bff" opacity={0.16} style={{ left: -140, bottom: -170 }} />

        {/* Hlavička: název + přepínač */}
        <View style={styles.head}>
          <View style={{ gap: 2 }}>
            <AppText variant="overline" color={color.muted}>
              {t('Rozložení')}
            </AppText>
            <AppText variant="heading">{mode === 'value' ? t('Podle hodnoty') : t('Podle investice')}</AppText>
          </View>
          <View style={styles.seg}>
            {(['value', 'cost'] as const).map((m) => {
              const on = mode === m;
              return (
                <Pressable key={m} onPress={() => setMode(m)} style={[styles.segBtn, on && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                  <AppText variant="caption" color={on ? color.text : color.muted} style={{ fontFamily: font.semibold }}>
                    {m === 'value' ? t('Hodnota') : t('Investice')}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Prstenec + střed */}
        <View style={styles.body}>
          <View style={styles.donutWrap}>
            <Donut
              size={148}
              stroke={16}
              segments={rows.map((r) => ({ key: r.game, share: shareOf(r), color: gameColor[r.game][0], gradient: [gameColor[r.game][1], gameColor[r.game][2]] as const }))}
              highlight={focus?.game ?? null}
            />
            <View style={styles.center} pointerEvents="none">
              <AppText variant="overline" color={color.muted}>
                {focus ? focus.game : t('Celkem')}
              </AppText>
              <AppText style={styles.centerValue} tabular adjustsFontSizeToFit numberOfLines={1}>
                {money(focus ? focus[mode] : total, currency)}
              </AppText>
              {focus && (
                <AppText variant="caption" tabular color={color.muted}>
                  {Math.round(shareOf(focus) * 100)} %
                </AppText>
              )}
            </View>
          </View>

          {/* Legenda */}
          <View style={{ flex: 1, gap: space.xs }}>
            {sorted.map((r) => {
              const on = active === r.game;
              const empty = r.held === 0;
              const dim = (active !== 'all' && !on) || empty;
              return (
                <Pressable
                  key={r.game}
                  disabled={empty}
                  onPress={() => {
                    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                    onPick(on ? 'all' : r.game);
                  }}
                  style={({ pressed }) => [styles.legend, on && styles.legendOn, (pressed || dim) && { opacity: empty ? 0.35 : 0.5 }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled: empty }}
                  accessibilityHint={t('Vyfiltruje seznam na tuto hru')}>
                  <LinearGradient colors={[gameColor[r.game][1], gameColor[r.game][2]]} style={styles.swatch} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="label" numberOfLines={1} style={{ fontFamily: font.semibold }}>
                      {r.game}
                    </AppText>
                    {empty ? (
                      <AppText variant="caption" color={color.faint}>
                        {t('nic v portfoliu')}
                      </AppText>
                    ) : (
                      <AppText variant="caption" tabular color={toneColor[tone(r.profit)]} numberOfLines={1}>
                        {pct(r.pct)}
                      </AppText>
                    )}
                  </View>
                  {!empty && (
                    <AppText style={styles.share} tabular>
                      {Math.round(shareOf(r) * 100)}
                      <AppText style={styles.shareUnit}> %</AppText>
                    </AppText>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  border: { borderRadius: radius.lg + 4, borderCurve: 'continuous', padding: 1, boxShadow: '0 24px 50px -30px rgba(143,107,255,0.35)' },
  card: { borderRadius: radius.lg + 3, borderCurve: 'continuous', overflow: 'hidden', padding: space.lg, gap: space.lg, backgroundColor: '#0d0d12' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  seg: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.pill, padding: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: color.border },
  segBtn: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill },
  segOn: { backgroundColor: 'rgba(143,107,255,0.28)', boxShadow: 'inset 0 0 0 1px rgba(169,157,255,0.45)' },
  body: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  donutWrap: { width: 148, height: 148, alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', paddingHorizontal: 26, gap: 1 },
  centerValue: { fontFamily: font.displayBold, fontSize: 17, letterSpacing: -0.4, color: color.text },
  legend: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 7, paddingHorizontal: space.sm, borderRadius: radius.sm },
  legendOn: { backgroundColor: 'rgba(255,255,255,0.06)' },
  swatch: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  share: { fontFamily: font.displayBold, fontSize: 20, letterSpacing: -0.6, color: color.text },
  shareUnit: { fontFamily: font.display, fontSize: 12, color: color.muted },
});
