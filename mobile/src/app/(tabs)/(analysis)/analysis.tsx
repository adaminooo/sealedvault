import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';

import { totalStats } from '@/core/calc';
import { date, displayMoney, money, pct, plural, signedMoney, toDisplay, tone } from '@/core/format';
import { LANG, LOCALE, t } from '@/core/i18n';
import { avgHoldingDays, cashFlows, portfolioChange, positionPerformance, xirr, type PositionPerf } from '@/core/performance';
import { concentration, DEFAULT_LIQUIDATION, liquidationValue, portfolioSeries, type ConcentrationBy, type LiquidationSettings } from '@/core/portfolio';
import { todayIso } from '@/core/form';
import { isoDaysAgo } from '@/core/trend';
import type { Currency } from '@/core/types';
import { useHistory, useMarket } from '@/data/queries';
import { usePortfolioView } from '@/data/use-portfolio';
import { useStoredState } from '@/data/use-stored-state';
import { AppText, Card, Screen, color, font, radius, space, toneColor } from '@/ui';
import { Icon } from '@/ui/icon';
import { InfoBubble, InfoButton } from '@/ui/info';
import { LineChart } from '@/ui/line-chart';
import { Panel } from '@/ui/panel';
import { TrendPill } from '@/ui/pill';
import { ProductThumb } from '@/ui/product-thumb';
import { Segmented } from '@/ui/segmented';

const RANGES = { '1M': 30, '3M': 91, '6M': 182, '1R': 365, ALL: 1e6 } as const;
type Range = keyof typeof RANGES;
const LEVEL = {
  low: { label: 'Rozložené', hint: 'Hodnota je rozložená mezi víc položek.', tone: 'pos' as const },
  mid: { label: 'Střední koncentrace', hint: 'Několik položek tvoří velkou část hodnoty.', tone: 'neutral' as const },
  high: { label: 'Vysoká koncentrace', hint: 'Většina hodnoty stojí na pár položkách – vyšší riziko.', tone: 'neg' as const },
};

const INFO = {
  chart: 'Fialová čára je tržní hodnota toho, co jsi v daný den držel (denní ceny z Cardmarketu a TCGplayeru přepočtené kurzem ČNB). Čárkovaná ukazuje, kolik jsi do toho v tu dobu investoval. Táhni prstem po grafu a uvidíš konkrétní den.',
  unreal: 'Rozdíl mezi dnešní tržní hodnotou kusů, které držíš, a tím, kolik jsi za ně zaplatil včetně poplatků. Je to zisk „na papíře“ – skutečný bude až po prodeji.',
  real: 'Zisk z kusů, které už jsi prodal: tržba po odečtení poplatků mínus nákupní cena prodaných kusů.',
  total: 'Součet nerealizovaného a realizovaného zisku – celkový výsledek tvého portfolia od prvního nákupu.',
  xirr: 'Kolik % ročně portfolio vydělává (metoda XIRR). Zohledňuje, kdy jsi nakupoval a prodával, takže se dá srovnat třeba s úrokem na spořicím účtu. Potřebuje aspoň 30 dní dat.',
  d7: 'Změna hodnoty za posledních 7 dní očištěná o nákupy a prodeje v tom období – ukazuje jen pohyb cen.',
  d30: 'Změna hodnoty za posledních 30 dní očištěná o nákupy a prodeje v tom období – ukazuje jen pohyb cen.',
  hold: 'Jak dlouho v průměru držíš své kusy. Dražší nákupy mají větší váhu.',
  best: 'Produkty s nejvyšším a nejnižším ziskem v % proti nákupní ceně. Klepnutím otevřeš detail.',
  liq: 'Kolik bys reálně dostal, kdybys dnes všechno prodal: tržní hodnota mínus poplatek tržiště (Cardmarket bere kolem 5 %) a poštovné. „Rychlý prodej“ počítá s nejnižší nabídkou na trhu místo běžné ceny.',
  conc: 'Ukazuje, jak moc hodnota stojí na pár položkách. Index HHI: pod 1 500 je portfolio rozložené, 1 500–2 500 středně koncentrované, nad 2 500 vysoce – pád ceny jednoho produktu by ho pak citelně zasáhl.',
};
type InfoKey = keyof typeof INFO;

/** Jedna otevřená vysvětlivka na obrazovce (klepnutí na jinou ⓘ přepne, na stejnou zavře) */
function useInfoGroup() {
  const [open, setOpen] = useState<InfoKey | null>(null);
  const toggle = (k: InfoKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    setOpen((o) => (o === k ? null : k));
  };
  return { open, toggle };
}

/** Analýza: vývoj portfolia, zisky, výkon, nejlepší/nejslabší, likvidační hodnota a koncentrace */
export default function AnalysisScreen() {
  // celé aktivní portfolio včetně prodaných kusů (filtry seznamu sem nepatří – jinak by chyběl realizovaný zisk)
  const { pItems: items } = usePortfolioView();
  const market = useMarket().data ?? null;
  const [currency] = useStoredState<Currency>('currency', 'CZK');
  const [range, setRange] = useStoredState<Range>('chartRange', 'ALL');
  const [liq, setLiq] = useStoredState<LiquidationSettings>('liquidation', DEFAULT_LIQUIDATION);
  const [concBy, setConcBy] = useStoredState<ConcentrationBy>('concBy', 'product');
  const [rank, setRank] = useState<'best' | 'worst'>('best');
  const [scrub, setScrub] = useState<number | null>(null);
  const info = useInfoGroup();

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
  const start = shown[0];
  // zisk za období = změna hodnoty očištěná o nákupy; % z kapitálu v období (počáteční hodnota + co jsi mezitím dokoupil)
  const change = shown.length >= 2 && cur && start ? Math.round(cur.value! - cur.invested - (start.value! - start.invested)) : null;
  const capital = start?.value != null && cur ? start.value + Math.max(0, cur.invested - start.invested) : 0;
  const changePct = change != null && capital > 0 ? (change / capital) * 100 : null;

  const annual = useMemo(() => xirr(cashFlows(items)), [items]);
  const holding = useMemo(() => avgHoldingDays(items), [items]);
  const ch7 = useMemo(() => portfolioChange(points, 7), [points]);
  const ch30 = useMemo(() => portfolioChange(points, 30), [points]);
  const perf = useMemo(() => positionPerformance(items, hist?.series), [items, hist]);
  const ranked = useMemo(() => [...perf].filter((p) => p.position.stats.profitPct != null).sort((a, b) => b.position.stats.profitPct! - a.position.stats.profitPct!), [perf]);
  const rankList = rank === 'best' ? ranked.slice(0, 3) : ranked.slice(-3).reverse();

  const lv = liquidationValue(items, liq, market);
  const conc = concentration(items, concBy);
  const level = LEVEL[conc.level];
  const fmt = (v: number) => money(v, currency);

  if (!items.length) {
    return (
      <Screen>
        <Card style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xxl }}>
          <View style={styles.emptyIcon}>
            <Icon sf="chart.xyaxis.line" md="insights" size={28} color={color.accent2} />
          </View>
          <AppText variant="heading">{t('Zatím není co analyzovat')}</AppText>
          <AppText color={color.muted} style={{ textAlign: 'center' }}>
            {t('Přidej první produkt a uvidíš tu vývoj hodnoty, zisky a rozložení portfolia.')}
          </AppText>
        </Card>
      </Screen>
    );
  }

  const holdingTxt = holding == null ? '—' : holding >= 365 ? `${(holding / 365).toFixed(1).replace('.', LANG === 'en' ? '.' : ',')} ${t('roku')}` : plural(holding, ['den', 'dny', 'dní']);

  return (
    <Screen>
      {/* 1) Vývoj */}
      <Panel>
        <Head title={scrub != null && cur ? date(cur.date) : t('Vývoj portfolia')} infoKey={scrub == null ? 'chart' : undefined} info={info} />
        <View style={{ gap: space.xs }}>
          <AppText variant="hero" tabular numberOfLines={1} adjustsFontSizeToFit>
            {fmt(cur?.value ?? tot.value)}
          </AppText>
          <View style={styles.inline}>
            {change != null && scrub == null && <TrendPill tone={tone(change)} label={`${signedMoney(change, currency)} · ${pct(changePct)}`} />}
            <AppText variant="caption" color={color.muted} tabular>
              {t('Investováno {0}', fmt(cur?.invested ?? tot.cost))}
            </AppText>
          </View>
        </View>
        {chart.length >= 2 ? (
          <LineChart
            points={chart}
            secondary={invested}
            height={200}
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
        <Segmented stretch value={range} onChange={setRange} options={(Object.keys(RANGES) as Range[]).map((r) => ({ value: r, label: r === 'ALL' ? t('Vše') : t(r) }))} />
      </Panel>

      {/* 2) Zisk – tři čísla vedle sebe */}
      <Panel>
        <Head title={t('Zisk')} info={info} />
        <View>
          <MetricRow label={t('Nerealizovaný')} infoKey="unreal" info={info} value={signedMoney(tot.profit, currency)} sub={pct(tot.profitPct)} tint={toneColor[tone(tot.profit)]} />
          <MetricRow label={t('Realizovaný')} infoKey="real" info={info} value={signedMoney(tot.realized, currency)} sub={tot.sold ? t('{0} ks prodáno', tot.sold) : t('nic neprodáno')} tint={tot.realized ? toneColor[tone(tot.realized)] : color.text} divider />
          <MetricRow strong label={t('Celkem')} infoKey="total" info={info} value={signedMoney(tot.profit + tot.realized, currency)} tint={toneColor[tone(tot.profit + tot.realized)]} divider />
        </View>
        <Bubble keys={['unreal', 'real', 'total']} info={info} />
      </Panel>

      {/* 3) Výkon – mřížka 2 × 2 */}
      <Panel>
        <Head title={t('Výkon')} info={info} />
        <View style={styles.grid}>
          <Metric cell label={t('Ročně')} infoKey="xirr" info={info} value={annual == null ? '—' : pct(annual * 100)} sub={annual == null ? t('min. 30 dní dat') : t('XIRR')} tint={annual != null ? toneColor[tone(annual)] : undefined} />
          <Metric cell label={t('Ø držení')} infoKey="hold" info={info} value={holdingTxt} />
          <Metric cell label={t('Za 7 dní')} infoKey="d7" info={info} value={ch7 ? pct(ch7.pct) : '—'} sub={ch7 ? signedMoney(Math.round(ch7.abs), currency) : t('po týdnu záznamu')} tint={ch7 ? toneColor[tone(ch7.abs)] : undefined} />
          <Metric cell label={t('Za 30 dní')} infoKey="d30" info={info} value={ch30 ? pct(ch30.pct) : '—'} sub={ch30 ? signedMoney(Math.round(ch30.abs), currency) : t('po měsíci záznamu')} tint={ch30 ? toneColor[tone(ch30.abs)] : undefined} />
        </View>
        <Bubble keys={['xirr', 'hold', 'd7', 'd30']} info={info} />
      </Panel>

      {/* 4) Nejlepší / nejslabší */}
      {ranked.length > 0 && (
        <Panel>
          <Head title={t('Produkty')} infoKey="best" info={info} right={<Segmented value={rank} onChange={setRank} options={[{ value: 'best', label: t('Nejlepší') }, { value: 'worst', label: t('Nejslabší') }]} />} />
          <View>
            {rankList.map((p, i) => (
              <RankRow key={p.position.key} p={p} first={i === 0} currency={currency} />
            ))}
          </View>
        </Panel>
      )}

      {/* 5) Likvidační hodnota */}
      <Panel>
        <Head title={t('Kdybys dnes vše prodal')} infoKey="liq" info={info} />
        <View style={{ gap: space.xs }}>
          <AppText variant="title" tabular>
            {fmt(lv.net)}
          </AppText>
          <View style={styles.inline}>
            <TrendPill tone={tone(lv.net - tot.cost)} label={`${signedMoney(lv.net - tot.cost, currency)} ${t('vs. investice')}`} />
          </View>
        </View>
        <View style={styles.breakdown}>
          <Row label={t('Tržní hodnota')} value={fmt(lv.gross)} />
          <Row label={t('Poplatky tržiště ({0} %)', liq.feePct)} value={`−${fmt(lv.fees)}`} tint={color.neg} />
          {lv.shipping > 0 && <Row label={t('Poštovné a balné')} value={`−${fmt(lv.shipping)}`} tint={color.neg} />}
        </View>
        <View style={styles.controls}>
          <Segmented value={liq.basis} onChange={(basis) => setLiq({ ...liq, basis })} options={[{ value: 'trend', label: t('Běžná cena') }, { value: 'low', label: t('Rychlý prodej') }]} />
          <Segmented value={String(liq.feePct)} onChange={(v) => setLiq({ ...liq, feePct: Number(v) })} options={['0', '5', '10'].map((f) => ({ value: f, label: `${f} %` }))} />
        </View>
      </Panel>

      {/* 6) Koncentrace */}
      <Panel>
        <Head title={t('Koncentrace')} infoKey="conc" info={info} right={<TrendPill small tone={level.tone} label={t(level.label)} />} />
        <Segmented
          stretch
          value={concBy}
          onChange={setConcBy}
          options={[
            { value: 'product', label: t('Produkt') },
            { value: 'set', label: t('Edice') },
            { value: 'type', label: t('Typ') },
            { value: 'game', label: t('Hra') },
          ]}
        />
        <View style={{ gap: space.md }}>
          {conc.rows.slice(0, 5).map((r) => (
            <View key={r.label} style={{ gap: 6 }}>
              <View style={styles.concHead}>
                <AppText variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                  {r.label}
                </AppText>
                <AppText variant="caption" tabular color={color.muted} style={{ fontFamily: font.semibold }}>
                  {Math.round(r.share * 100)} %
                </AppText>
              </View>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${Math.max(2, r.share * 100)}%`, backgroundColor: r.share > 0.25 ? color.accent : color.accent2 }]} />
              </View>
            </View>
          ))}
          {conc.rows.length > 5 && (
            <AppText variant="caption" color={color.faint}>
              {t('+ {0} dalších · {1} % hodnoty', conc.rows.length - 5, Math.round(conc.rows.slice(5).reduce((a, r) => a + r.share, 0) * 100))}
            </AppText>
          )}
          <AppText variant="caption" color={color.faint}>
            {t(level.hint)} HHI {conc.hhi.toLocaleString(LOCALE)}
          </AppText>
        </View>
      </Panel>
    </Screen>
  );
}

type Info = ReturnType<typeof useInfoGroup>;

/** Hlavička bloku: malý nadpis, volitelně ⓘ a prvek vpravo; vysvětlivka bloku pod ní */
function Head({ title, infoKey, info, right }: { title: string; infoKey?: InfoKey; info: Info; right?: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.head}>
        <View style={styles.label}>
          <AppText variant="overline" color={color.muted} numberOfLines={1}>
            {title}
          </AppText>
          {infoKey && <InfoButton open={info.open === infoKey} onPress={() => info.toggle(infoKey)} label={title} />}
        </View>
        {right}
      </View>
      {infoKey && <InfoBubble open={info.open === infoKey} onClose={() => info.toggle(infoKey)} text={t(INFO[infoKey])} />}
    </View>
  );
}

/** Vysvětlivka sdílená pro skupinu čísel (zobrazí tu, která je otevřená) */
function Bubble({ keys, info }: { keys: InfoKey[]; info: Info }) {
  const k = keys.find((x) => x === info.open);
  return k ? <InfoBubble open onClose={() => info.toggle(k)} text={t(INFO[k])} /> : null;
}

function Metric({ label, value, sub, tint, infoKey, info }: { label: string; value: string; sub?: string; tint?: string; infoKey: InfoKey; info: Info; cell?: boolean }) {
  return (
    <View style={styles.cell}>
      <View style={styles.label}>
        <AppText variant="caption" color={color.muted} numberOfLines={1}>
          {label}
        </AppText>
        <InfoButton open={info.open === infoKey} onPress={() => info.toggle(infoKey)} label={label} />
      </View>
      <AppText style={styles.metric} tabular color={tint ?? color.text} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      {sub ? (
        <AppText variant="caption" tabular color={color.faint} numberOfLines={1}>
          {sub}
        </AppText>
      ) : null}
    </View>
  );
}

/** Řádek se ziskem: popisek a ⓘ vlevo, částka (a pod ní doplněk) vpravo */
function MetricRow({ label, value, sub, tint, infoKey, info, divider, strong }: { label: string; value: string; sub?: string; tint?: string; infoKey: InfoKey; info: Info; divider?: boolean; strong?: boolean }) {
  return (
    <View style={[styles.metricRow, divider && styles.divider]}>
      <View style={styles.label}>
        <AppText variant={strong ? 'bodyStrong' : 'label'} color={strong ? color.text : color.muted}>
          {label}
        </AppText>
        <InfoButton open={info.open === infoKey} onPress={() => info.toggle(infoKey)} label={label} />
      </View>
      <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
        <AppText style={[styles.metric, strong && { fontSize: 21 }]} tabular color={tint ?? color.text} numberOfLines={1}>
          {value}
        </AppText>
        {sub ? (
          <AppText variant="caption" tabular color={color.faint}>
            {sub}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

function Row({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="label" color={color.muted}>
        {label}
      </AppText>
      <AppText variant="label" tabular color={tint ?? color.text}>
        {value}
      </AppText>
    </View>
  );
}

function RankRow({ p, first, currency }: { p: PositionPerf; first: boolean; currency: Currency }) {
  const s = p.position.stats;
  return (
    <Pressable onPress={() => router.push({ pathname: '/product/[key]', params: { key: p.position.key } })} accessibilityRole="button">
      {({ pressed }) => (
        <View style={[styles.rank, !first && styles.divider, pressed && { opacity: 0.6 }]}>
          <ProductThumb item={p.position.head} size={40} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="label" numberOfLines={1} style={{ fontFamily: font.semibold }}>
              {p.position.name}
            </AppText>
            <AppText variant="caption" tabular color={toneColor[tone(s.profit)]}>
              {signedMoney(s.profit, currency)}
            </AppText>
          </View>
          <TrendPill small tone={tone(s.profit)} label={pct(s.profitPct).replace(/^[+−-]/, '')} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  emptyIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(143,107,255,0.14)', marginBottom: space.xs },
  empty: { paddingVertical: space.xl, textAlign: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: 28 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  metricRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, paddingVertical: space.sm + 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  cell: { width: '50%', gap: 4, paddingRight: space.md },
  metric: { fontFamily: font.displayBold, fontSize: 19, letterSpacing: -0.4 },
  breakdown: { gap: 6, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  rank: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  concHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bar: { height: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill },
});
