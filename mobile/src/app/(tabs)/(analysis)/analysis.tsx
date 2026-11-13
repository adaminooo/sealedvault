import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { totalStats } from '@/core/calc';
import { date, displayMoney, money, pct, plural, signedMoney, toDisplay, tone } from '@/core/format';
import { LANG, LOCALE, t } from '@/core/i18n';
import { avgHoldingDays, cashFlows, portfolioChange, positionPerformance, xirr } from '@/core/performance';
import { concentration, DEFAULT_LIQUIDATION, liquidationValue, portfolioSeries, type ConcentrationBy, type LiquidationSettings } from '@/core/portfolio';
import { todayIso } from '@/core/form';
import { isoDaysAgo } from '@/core/trend';
import type { Currency } from '@/core/types';
import { useHistory, useMarket } from '@/data/queries';
import { usePortfolioView } from '@/data/use-portfolio';
import { useStoredState } from '@/data/use-stored-state';
import { AppText, Card, Screen, color, radius, space, toneColor } from '@/ui';
import { Chip, ChipRow } from '@/ui/chip';
import { Icon } from '@/ui/icon';
import { InfoBubble, InfoButton, useInfo } from '@/ui/info';
import { LineChart } from '@/ui/line-chart';

const RANGES = { '1M': 30, '3M': 91, '6M': 182, '1R': 365, ALL: 1e6 } as const;
type Range = keyof typeof RANGES;
const CONC_BY: [ConcentrationBy, string][] = [
  ['product', 'Produkt'],
  ['set', 'Edice'],
  ['type', 'Typ'],
  ['game', 'Hra'],
];
const LEVEL = {
  low: { label: 'Diverzifikované', hint: 'Hodnota je rozložená mezi víc položek.', color: color.pos },
  mid: { label: 'Střední koncentrace', hint: 'Několik položek tvoří velkou část hodnoty.', color: color.gold },
  high: { label: 'Vysoká koncentrace', hint: 'Většina hodnoty stojí na pár položkách – vyšší riziko.', color: color.neg },
};

/** Analýza: vývoj portfolia, zisky, výkon, likvidační hodnota a koncentrace (stejné výpočty jako web) */
export default function AnalysisScreen() {
  const { visible: items } = usePortfolioView();
  const market = useMarket().data ?? null;
  const [currency] = useStoredState<Currency>('currency', 'CZK');
  const [range, setRange] = useStoredState<Range>('chartRange', 'ALL');
  const [liq, setLiq] = useStoredState<LiquidationSettings>('liquidation', DEFAULT_LIQUIDATION);
  const [concBy, setConcBy] = useStoredState<ConcentrationBy>('concBy', 'product');
  const [scrub, setScrub] = useState<number | null>(null);
  const chartTip = useInfo();

  const ids = useMemo(() => items.flatMap((i) => (i.cmProductId ? [i.cmProductId] : [])), [items]);
  const from = useMemo(() => items.map((i) => i.buyDate || todayIso()).sort()[0] ?? todayIso(), [items]);
  const histQ = useHistory(ids, from);
  const hist = histQ.data ?? null;

  const tot = totalStats(items);
  const points = useMemo(() => portfolioSeries(items, hist, todayIso()), [items, hist]);
  const shown = useMemo(() => {
    const cutoff = RANGES[range] >= 1e6 ? '' : isoDaysAgo(RANGES[range]);
    return points.filter((p) => p.date >= cutoff && p.value != null);
  }, [points, range]);
  const chart = useMemo(() => shown.map((p) => [p.date, p.value!] as [string, number]), [shown]);
  const invested = useMemo(() => shown.map((p) => p.invested), [shown]);
  const cur = scrub != null ? shown[scrub] : shown[shown.length - 1];
  const change = shown.length >= 2 && cur ? cur.value! - cur.invested - (shown[0].value! - shown[0].invested) : null;

  const annual = useMemo(() => xirr(cashFlows(items)), [items]);
  const holding = useMemo(() => avgHoldingDays(items), [items]);
  const ch7 = useMemo(() => portfolioChange(points, 7), [points]);
  const ch30 = useMemo(() => portfolioChange(points, 30), [points]);
  const perf = useMemo(() => positionPerformance(items, hist?.series), [items, hist]);
  const ranked = [...perf].filter((p) => p.position.stats.profitPct != null).sort((a, b) => b.position.stats.profitPct! - a.position.stats.profitPct!);
  const best = ranked.slice(0, 3);
  const worst = ranked.slice(-3).reverse().filter((p) => !best.includes(p));

  const lv = liquidationValue(items, liq, market);
  const conc = concentration(items, concBy);
  const level = LEVEL[conc.level];

  if (!items.length) {
    return (
      <Screen>
        <Card style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xxl }}>
          <Icon sf="chart.xyaxis.line" md="insights" size={30} color={color.accent2} />
          <AppText variant="heading">{t('Zatím není co analyzovat')}</AppText>
          <AppText color={color.muted}>{t('Přidej první produkt a uvidíš tu vývoj hodnoty, zisky a rozložení portfolia.')}</AppText>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <View style={styles.labelRow}>
          <AppText variant="overline" color={color.muted}>
            {scrub != null && cur ? date(cur.date) : t('Vývoj portfolia')}
          </AppText>
          {scrub == null && <InfoButton open={chartTip.open} onPress={chartTip.toggle} label={t('Vývoj portfolia')} />}
        </View>
        <InfoBubble open={chartTip.open} onClose={chartTip.toggle} text={t("Fialová čára je tržní hodnota toho, co jsi v daný den držel (denní ceny z Cardmarketu a TCGplayeru přepočtené kurzem ČNB). Čárkovaná ukazuje, kolik jsi do toho v tu dobu investoval. Táhni prstem po grafu a uvidíš konkrétní den.")} />
        <AppText variant="title" tabular>
          {money(cur?.value ?? tot.value, currency)}
        </AppText>
        {cur && (
          <AppText variant="caption" color={color.muted} tabular>
            {t('Investováno {0}', money(cur.invested, currency))}
            {change != null && scrub == null ? (
              <AppText variant="caption" color={toneColor[tone(change)]}>
                {'  ·  '}
                {signedMoney(change, currency)} {t('za období')}
              </AppText>
            ) : null}
          </AppText>
        )}
        {chart.length >= 2 ? (
          <LineChart
            points={chart}
            secondary={invested}
            height={220}
            color={color.accent}
            formatY={(v) => displayMoney(toDisplay(v, currency), currency, true)}
            legend={{ primary: t('Hodnota'), secondary: t('Investováno') }}
            onScrub={setScrub}
          />
        ) : (
          <AppText variant="caption" color={color.faint} style={styles.empty}>
            {histQ.isLoading ? t('Načítám historii…') : histQ.isError ? t('Historii cen se nepodařilo načíst.') : t('Graf se začne plnit s historií cen tvých produktů.')}
          </AppText>
        )}
        <ChipRow>
          {(Object.keys(RANGES) as Range[]).map((r) => (
            <Chip key={r} label={r === 'ALL' ? t('Vše') : t(r)} active={range === r} onPress={() => setRange(r)} />
          ))}
        </ChipRow>
      </Card>

      <View style={styles.kpis}>
        <Kpi info={t("Rozdíl mezi dnešní tržní hodnotou kusů, které držíš, a tím, kolik jsi za ně zaplatil včetně poplatků. Je to zisk „na papíře“ – skutečný bude až po prodeji.")} label={t('Nerealizovaný zisk')} value={signedMoney(tot.profit, currency)} sub={pct(tot.profitPct)} tint={toneColor[tone(tot.profit)]} />
        <Kpi
          label={t('Realizovaný zisk')}
          info={t("Zisk z kusů, které už jsi prodal: tržba po odečtení poplatků mínus nákupní cena prodaných kusů.")}
          value={signedMoney(tot.realized, currency)}
          sub={tot.sold ? t('{0} prodaných ks', tot.sold) : t('zatím nic neprodáno')}
          tint={toneColor[tone(tot.realized)]}
        />
        <Kpi info={t("Součet nerealizovaného a realizovaného zisku – celkový výsledek tvého portfolia od prvního nákupu.")} label={t('Celkový zisk')} value={signedMoney(tot.profit + tot.realized, currency)} sub={t('nerealizovaný + realizovaný')} tint={toneColor[tone(tot.profit + tot.realized)]} wide />
      </View>

      <Section title={t('Výkon')} info={t("Produkty s nejvyšším a nejnižším ziskem v % proti nákupní ceně. Klepnutím otevřeš detail.")}>
        <Card>
          <Line info={t("Kolik % ročně portfolio vydělává (metoda XIRR). Zohledňuje, kdy jsi nakupoval a prodával, takže se dá srovnat třeba s úrokem na spořicím účtu. Potřebuje aspoň 30 dní dat.")} label={t('Roční zhodnocení')} value={annual == null ? '—' : `${pct(annual * 100)} / ${t('rok')}`} hint={annual == null ? t('potřebuje aspoň 30 dní dat') : undefined} tint={annual != null ? toneColor[tone(annual)] : undefined} />
          <Line info={t("Změna hodnoty za posledních 7 dní očištěná o nákupy a prodeje v tom období – ukazuje jen pohyb cen.")} label={t('Za 7 dní')} value={ch7 ? signedMoney(ch7.abs, currency) : '—'} hint={ch7 ? pct(ch7.pct) : t('po týdnu záznamu cen')} tint={ch7 ? toneColor[tone(ch7.abs)] : undefined} />
          <Line info={t("Změna hodnoty za posledních 30 dní očištěná o nákupy a prodeje v tom období – ukazuje jen pohyb cen.")} label={t('Za 30 dní')} value={ch30 ? signedMoney(ch30.abs, currency) : '—'} hint={ch30 ? pct(ch30.pct) : t('po měsíci záznamu cen')} tint={ch30 ? toneColor[tone(ch30.abs)] : undefined} />
          <Line
            label={t('Ø doba držení')}
            info={t("Jak dlouho v průměru držíš své kusy. Dražší nákupy mají větší váhu.")}
            value={holding == null ? '—' : holding >= 365 ? `${(holding / 365).toFixed(1).replace('.', LANG === 'en' ? '.' : ',')} ${t('roku')}` : plural(holding, ['den', 'dny', 'dní'])}
          />
        </Card>
        {best.length > 0 && (
          <Card style={{ gap: 0, paddingVertical: space.xs }}>
            <AppText variant="overline" color={color.gold} style={{ paddingTop: space.sm }}>
              {t('Nejlepší')}
            </AppText>
            {best.map((p) => (
              <PerfRow key={p.position.key} name={p.position.name} k={p.position.key} pctV={p.position.stats.profitPct} profit={p.position.stats.profit} currency={currency} />
            ))}
            {worst.length > 0 && (
              <AppText variant="overline" color={color.neg} style={{ paddingTop: space.md }}>
                {t('Nejslabší')}
              </AppText>
            )}
            {worst.map((p) => (
              <PerfRow key={p.position.key} name={p.position.name} k={p.position.key} pctV={p.position.stats.profitPct} profit={p.position.stats.profit} currency={currency} />
            ))}
          </Card>
        )}
      </Section>

      <Section title={t('Likvidační hodnota')} info={t("Kolik bys reálně dostal, kdybys dnes všechno prodal: tržní hodnota mínus poplatek tržiště (Cardmarket bere kolem 5 %) a poštovné. „Rychlý prodej“ počítá s nejnižší nabídkou na trhu místo běžné ceny.")}>
        <Card>
          <AppText variant="caption" color={color.muted}>
            {t('Kolik bys dostal, kdybys dnes prodal vše, co držíš')}
            {liq.basis === 'low' ? t(' za nejnižší nabídky na trhu') : ''}.
          </AppText>
          <ChipRow>
            <Chip label={t('Trend')} active={liq.basis === 'trend'} onPress={() => setLiq({ ...liq, basis: 'trend' })} />
            <Chip label={t('Rychlý prodej')} active={liq.basis === 'low'} onPress={() => setLiq({ ...liq, basis: 'low' })} />
            {[0, 5, 10, 15].map((f) => (
              <Chip key={f} label={`${f} %`} active={liq.feePct === f} onPress={() => setLiq({ ...liq, feePct: f })} />
            ))}
          </ChipRow>
          <Line label={t('Tržní hodnota')} value={money(lv.gross, currency)} />
          <Line label={t('Poplatky tržiště ({0} %)', liq.feePct)} value={`−${money(lv.fees, currency)}`} tint={color.neg} />
          {lv.shipping > 0 && <Line label={t('Poštovné a balné')} value={`−${money(lv.shipping, currency)}`} tint={color.neg} />}
          <Line label={t('Dostaneš')} value={money(lv.net, currency)} strong />
          <Line label={t('Po prodeji vs. investice')} value={signedMoney(lv.net - tot.cost, currency)} tint={toneColor[tone(lv.net - tot.cost)]} />
        </Card>
      </Section>

      <Section title={t('Koncentrace')} info={t("Ukazuje, jak moc hodnota stojí na pár položkách. Index HHI: pod 1 500 je portfolio rozložené, 1 500–2 500 středně koncentrované, nad 2 500 vysoce – pád ceny jednoho produktu by ho pak citelně zasáhl.")}>
        <Card>
          <ChipRow>
            {CONC_BY.map(([k, l]) => (
              <Chip key={k} label={t(l)} active={concBy === k} onPress={() => setConcBy(k)} />
            ))}
          </ChipRow>
          <AppText variant="bodyStrong" color={level.color}>
            {t(level.label)}
          </AppText>
          <AppText variant="caption" color={color.muted}>
            {t(level.hint)} {t('Top 3 =')} {Math.round(conc.top3 * 100)} {t('% hodnoty · HHI')} {conc.hhi.toLocaleString(LOCALE)}
          </AppText>
          <View style={{ gap: space.sm, marginTop: space.xs }}>
            {conc.rows.slice(0, 8).map((r) => (
              <View key={r.label} style={styles.concRow}>
                <AppText variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                  {r.label}
                </AppText>
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${Math.max(2, r.share * 100)}%`, backgroundColor: r.share > 0.25 ? color.gold : color.accent }]} />
                </View>
                <AppText variant="caption" tabular color={color.muted} style={{ width: 40, textAlign: 'right' }}>
                  {Math.round(r.share * 100)} %
                </AppText>
              </View>
            ))}
          </View>
        </Card>
      </Section>
    </Screen>
  );
}

function Section({ title, info, children }: { title: string; info?: string; children: React.ReactNode }) {
  const tip = useInfo();
  return (
    <View style={{ gap: space.sm }}>
      <View style={[styles.labelRow, { paddingHorizontal: space.xs }]}>
        <AppText variant="overline" color={color.muted}>
          {title}
        </AppText>
        {info ? <InfoButton open={tip.open} onPress={tip.toggle} label={title} /> : null}
      </View>
      {info ? <InfoBubble open={tip.open} onClose={tip.toggle} text={info} /> : null}
      {children}
    </View>
  );
}

function Kpi({ label, value, sub, tint, wide, info }: { label: string; value: string; sub: string; tint?: string; wide?: boolean; info?: string }) {
  const tip = useInfo();
  return (
    <Card style={[styles.kpi, wide && { flexBasis: '100%' }]}>
      <View style={styles.labelRow}>
        <AppText variant="caption" color={color.muted}>
          {label}
        </AppText>
        {info ? <InfoButton open={tip.open} onPress={tip.toggle} label={label} /> : null}
      </View>
      <AppText variant="heading" tabular color={tint} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="caption" color={color.faint} numberOfLines={1}>
        {sub}
      </AppText>
      {info ? <InfoBubble open={tip.open} onClose={tip.toggle} text={info} /> : null}
    </Card>
  );
}

function Line({ label, value, hint, tint, strong, info }: { label: string; value: string; hint?: string; tint?: string; strong?: boolean; info?: string }) {
  const tip = useInfo();
  return (
    <View>
      <View style={styles.line}>
        <View style={{ flex: 1 }}>
          <View style={styles.labelRow}>
            <AppText color={strong ? color.text : color.muted} variant={strong ? 'bodyStrong' : 'body'}>
              {label}
            </AppText>
            {info ? <InfoButton open={tip.open} onPress={tip.toggle} label={label} /> : null}
          </View>
          {hint ? (
            <AppText variant="caption" color={color.faint}>
              {hint}
            </AppText>
          ) : null}
        </View>
        <AppText variant="bodyStrong" tabular color={tint}>
          {value}
        </AppText>
      </View>
      {info ? <InfoBubble open={tip.open} onClose={tip.toggle} text={info} /> : null}
    </View>
  );
}

function PerfRow({ name, k, pctV, profit, currency }: { name: string; k: string; pctV: number | null; profit: number; currency: Currency }) {
  return (
    <Pressable onPress={() => router.push({ pathname: '/product/[key]', params: { key: k } })} style={({ pressed }) => [styles.line, { paddingVertical: space.sm }, pressed && { opacity: 0.6 }]} accessibilityRole="button">
      <AppText numberOfLines={1} style={{ flex: 1 }}>
        {name}
      </AppText>
      <AppText variant="caption" tabular color={color.muted}>
        {signedMoney(profit, currency)}
      </AppText>
      <AppText variant="bodyStrong" tabular color={toneColor[tone(profit)]} style={{ minWidth: 64, textAlign: 'right' }}>
        {pct(pctV)}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: space.xl, textAlign: 'center' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  kpi: { flexBasis: '47%', flexGrow: 1, gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 3 },
  concRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bar: { flex: 1.2, height: 6, borderRadius: radius.pill, backgroundColor: color.surface3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill },
});
