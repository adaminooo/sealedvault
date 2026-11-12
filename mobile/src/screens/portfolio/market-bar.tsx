import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';

import { getEurRate } from '@/core/format';
import { t, LOCALE } from '@/core/i18n';
import { SOURCE_LABEL } from '@/core/market';
import { useMarket } from '@/data/queries';
import { AppText, color, radius, space } from '@/ui';
import { Icon } from '@/ui/icon';

const dayFmt = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString(LOCALE, { day: 'numeric', month: 'numeric' });

/** Lišta „Ceny · kurz“ jako na webu: stav ceníku, rozbalení zdrojů a ruční obnovení */
export function MarketBar() {
  const market = useMarket();
  const [open, setOpen] = useState(false);
  const m = market.data;
  const ok = !!m && !market.isError;
  const newest = m ? m.sources.map((s) => s.priceDate).sort().at(-1) : null;
  const eur = m?.eurCzk ?? getEurRate();

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };
  const refresh = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void market.refetch();
  };

  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        <Pressable onPress={toggle} style={styles.main} accessibilityRole="button" accessibilityState={{ expanded: open }}>
          <View style={[styles.dot, { backgroundColor: market.isError ? color.neg : ok ? color.pos : color.gold }]} />
          <AppText variant="label" color={color.muted} numberOfLines={1} style={{ flex: 1 }}>
            {m
              ? `${t('Ceny')} ${newest ? dayFmt(newest) : ''} · 1 € = ${eur.toLocaleString(LOCALE, { maximumFractionDigits: 1 })} ${t('Kč')}`
              : market.isError
                ? t('Ceny se nepodařilo načíst')
                : t('Načítám ceny…')}
          </AppText>
          <Icon sf={open ? 'chevron.up' : 'chevron.down'} md={open ? 'expand-less' : 'expand-more'} size={14} color={color.faint} />
        </Pressable>
        <Pressable onPress={refresh} style={styles.refresh} accessibilityRole="button" accessibilityLabel={t('Obnovit ceny')} disabled={market.isFetching}>
          {market.isFetching ? <ActivityIndicator size="small" color={color.accent2} /> : <Icon sf="arrow.clockwise" md="refresh" size={16} color={color.text} />}
        </Pressable>
      </View>
      {open && m && (
        <View style={styles.details}>
          {m.sources.map((s) => (
            <View key={`${s.game}-${s.source}`} style={styles.src}>
              <AppText variant="caption" color={color.text} style={{ flex: 1 }}>
                {s.game}
              </AppText>
              <AppText variant="caption" color={color.muted}>
                {SOURCE_LABEL[s.source]} · {s.currency} · {dayFmt(s.priceDate)}
              </AppText>
            </View>
          ))}
          <AppText variant="caption" color={color.faint}>
            {t('{0} produktů · kurzy ČNB · 1 $ = {1} Kč', m.products.length.toLocaleString(LOCALE), (m.usdCzk ?? 0).toLocaleString(LOCALE, { maximumFractionDigits: 1 }))}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    padding: space.sm,
    paddingLeft: space.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 36 },
  dot: { width: 8, height: 8, borderRadius: 4, boxShadow: '0 0 8px rgba(61,220,132,0.6)' },
  refresh: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface2 },
  details: { gap: space.sm, paddingTop: space.sm, paddingBottom: space.xs, paddingRight: space.sm },
  src: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
