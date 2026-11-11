import { useEffect, useMemo, useState } from 'react';
import type { Currency, PortfolioItem } from '../types';
import { heldQty, totalStats, unitCost } from '../lib/calc';
import { fetchHistory } from '../lib/history';
import {
  concentration,
  DEFAULT_LIQUIDATION,
  liquidationValue,
  portfolioSeries,
  positionKey,
  type ConcentrationBy,
  type HistoryData,
  type LiquidationSettings,
} from '../lib/portfolio';
import { plural, date, displayMoney, getEurRate, money, pct, signedMoney, tone } from '../lib/format';
import type { MarketSnapshot } from '../lib/market';
import { usePersistentState } from '../hooks/usePersistentState';
import { LineChart, type ChartSeries } from './LineChart';
import { PerformanceSection } from './PerformanceSection';
import { PremiumLock } from './PremiumLock';
import { LockIcon } from './icons';
import { usePremium } from '../lib/premium';

import { t, LOCALE } from '../i18n';
interface Props {
  items: PortfolioItem[];
  currency: Currency;
  market: MarketSnapshot | null;
  onOpen: (key: string) => void;
  seriesOf: (it: PortfolioItem) => string;
}

type Range = '1M' | '3M' | '6M' | '1R' | 'ALL';
const RANGE_DAYS: Record<Range, number> = { '1M': 30, '3M': 91, '6M': 182, '1R': 365, ALL: 1e6 };
const FREE_RANGES: Range[] = ['1M', '3M'];
const today = () => new Date().toISOString().slice(0, 10);
const ts = (d: string) => new Date(d + 'T12:00:00Z').getTime();
const monthFmt = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' });
const recFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'numeric', year: 'numeric' });

export function AnalyticsView({ items, currency, market, onOpen, seriesOf }: Props) {
  const tot = totalStats(items);
  const [hist, setHist] = useState<HistoryData | null>(null);
  const [histErr, setHistErr] = useState(false);
  const { isPremium, openPaywall } = usePremium();
  const [savedRange, setRange] = usePersistentState<Range>('chartRange', 'ALL');
  // verze zdarma: jen 1M a 3M
  const range: Range = isPremium || FREE_RANGES.includes(savedRange) ? savedRange : '3M';
  const [chartCur, setChartCur] = useState<Currency>(currency);
  const [liq, setLiq] = usePersistentState<LiquidationSettings>('liquidation', DEFAULT_LIQUIDATION);
  const [concBy, setConcBy] = usePersistentState<ConcentrationBy>('concBy', 'product');

  useEffect(() => setChartCur(currency), [currency]);

  const ids = useMemo(() => [...new Set(items.map((i) => i.cmProductId).filter((x): x is number => !!x))], [items]);
  const from = useMemo(() => items.map((i) => i.buyDate || today()).sort()[0] ?? today(), [items]);

  useEffect(() => {
    let alive = true;
    fetchHistory(ids, from)
      .then((h) => alive && setHist(h))
      .catch(() => alive && setHistErr(true));
    return () => {
      alive = false;
    };
  }, [ids, from]);

  // ---------- 1 + 6: vývoj portfolia v Kč / € ----------
  const points = useMemo(() => portfolioSeries(items, hist, today()), [items, hist]);
  const shown = useMemo(() => {
    const cutoff = new Date(Date.now() - RANGE_DAYS[range] * 864e5).toISOString().slice(0, 10);
    return points.filter((p) => p.date >= cutoff);
  }, [points, range]);
  const conv = (czk: number, eur: number | null) => (chartCur === 'EUR' ? czk / (eur || getEurRate()) : czk);
  const series: ChartSeries[] = [
    { id: 'value', label: t('Hodnota'), color: 'var(--accent)', area: true, points: shown.map((p) => ({ x: ts(p.date), y: p.value == null ? null : conv(p.value, p.eur) })) },
    { id: 'inv', label: t('Investováno'), color: 'var(--muted)', dashed: true, points: shown.map((p) => ({ x: ts(p.date), y: conv(p.invested, p.eur) })) },
  ];
  const firstVal = shown.find((p) => p.value != null);
  const lastVal = shown[shown.length - 1];
  const change = firstVal && lastVal?.value != null && firstVal !== lastVal ? conv(lastVal.value, lastVal.eur) - conv(firstVal.value!, firstVal.eur) : null;

  // ---------- 4: likvidační hodnota ----------
  const lv = liquidationValue(items, liq, market);

  // ---------- 5: koncentrace ----------
  const conc = concentration(items, concBy);
  const LEVEL = {
    low: { label: 'Diverzifikované', hint: 'Hodnota je rozložená mezi víc položek.' },
    mid: { label: 'Střední koncentrace', hint: 'Několik položek tvoří velkou část hodnoty.' },
    high: { label: 'Vysoká koncentrace', hint: 'Většina hodnoty stojí na pár položkách – vyšší riziko.' },
  }[conc.level];
  const heavy = conc.rows.filter((r) => r.share > 0.25);

  // ---------- 7: nákupní dávky po měsících ----------
  const lotsByMonth = useMemo(() => {
    const sorted = [...items].sort((a, b) => (b.buyDate || '').localeCompare(a.buyDate || ''));
    const map = new Map<string, PortfolioItem[]>();
    for (const it of sorted) {
      const m = (it.buyDate || '????-??').slice(0, 7);
      (map.get(m) ?? map.set(m, []).get(m)!).push(it);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <div className="analytics">
      {/* Vývoj portfolia */}
      <section className="card an-chart">
        <header className="an-head">
          <div>
            <span className="eyebrow">{t('Vývoj portfolia')}</span>
            <div className="an-big">{money(tot.value, chartCur)}</div>
            {change != null && (
              <span className={`hero-profit ${tone(change)}`}>
                {change >= 0 ? '+' : '−'}
                {displayMoney(Math.abs(change), chartCur)} {t('za období')}
              </span>
            )}
          </div>
          <div className="an-controls">
            <div className="segmented sm">
              {(['1M', '3M', '6M', '1R', 'ALL'] as Range[]).map((r) => {
                const locked = !isPremium && !FREE_RANGES.includes(r);
                return (
                  <button
                    key={r}
                    className={`${range === r ? 'active' : ''} ${locked ? 'locked' : ''}`}
                    onClick={() => (locked ? openPaywall('history') : setRange(r))}
                    title={locked ? t('Delší historie je v Premium') : undefined}
                  >
                    {r === 'ALL' ? t('Vše') : r}
                    {locked && <LockIcon size={10} />}
                  </button>
                );
              })}
            </div>
            <div className="segmented sm">
              <button className={chartCur === 'CZK' ? 'active' : ''} onClick={() => setChartCur('CZK')}>{t('Kč')}</button>
              <button className={chartCur === 'EUR' ? 'active' : ''} onClick={() => setChartCur('EUR')}>€</button>
            </div>
          </div>
        </header>
        <LineChart series={series} height={260} formatY={(v) => displayMoney(v, chartCur, true)} empty={t('Přidej první položku')} />
        <p className="hint">
          {histErr
            ? t('Historii cen se nepodařilo načíst – zobrazuji jen investice.')
            : hist?.recordedSince
              ? hist.ownSince && hist.recordedSince < hist.ownSince
                ? t('Tržní hodnota od {0}: do {1} podle archivu cen TCGplayeru (týdně, přepočet kurzem ČNB, u Cardmarket produktů srovnáno na jeho úroveň), potom denní ceny z trhů.', recFmt.format(new Date(hist.recordedSince)), recFmt.format(new Date(hist.ownSince)))
                : t('Investováno počítáme od data nákupů. Tržní hodnotu ukládáme denně od {0} – graf se bude každý den plnit.', recFmt.format(new Date(hist.recordedSince)))
              : t('Načítám historii…')}
          {chartCur === 'EUR' && t(' Přepočet € podle kurzu ČNB v daný den.')}
        </p>
      </section>

      {/* Zisky */}
      <section className="an-kpis">
        <div className="kpi">
          <span>{t('Nerealizovaný zisk')}</span>
          <b className={tone(tot.profit)}>{signedMoney(tot.profit, currency)}</b>
          <em>{pct(tot.profitPct)} {t('· držené kusy')}</em>
        </div>
        <div className="kpi">
          <span>{t('Realizovaný zisk')}</span>
          <b className={tone(tot.realized)}>{signedMoney(tot.realized, currency)}</b>
          <em>{tot.sold ? t('{0} prodaných ks · tržby {1}', tot.sold, money(tot.proceeds, currency)) : t('zatím nic neprodáno')}</em>
        </div>
        <div className="kpi accent">
          <span>{t('Celkový zisk')}</span>
          <b className={tone(tot.profit + tot.realized)}>{signedMoney(tot.profit + tot.realized, currency)}</b>
          <em>{t('nerealizovaný + realizovaný')}</em>
        </div>
      </section>

      {/* Pokročilá analytika (Premium) */}
      <PremiumLock
        feature="analytics"
        title={t('Pokročilá analytika')}
        text={t('Roční zhodnocení, nejlepší a nejslabší kusy, výkon po sériích, likvidační hodnota a koncentrace rizika.')}
      >
      <div className="an-advanced">
      <PerformanceSection items={items} hist={hist} points={points} currency={currency} seriesOf={seriesOf} onOpen={onOpen} />

      <div className="an-grid">
        {/* Likvidační hodnota */}
        <section className="card an-liq">
          <header className="card-head">
            <h3>{t('Likvidační hodnota')}</h3>
            <div className="segmented sm">
              <button className={liq.basis === 'trend' ? 'active' : ''} onClick={() => setLiq({ ...liq, basis: 'trend' })}>{t('Trend')}</button>
              <button className={liq.basis === 'low' ? 'active' : ''} onClick={() => setLiq({ ...liq, basis: 'low' })}>{t('Rychlý prodej')}</button>
            </div>
          </header>
          <div className="liq-big">{money(lv.net, currency)}</div>
          <p className="hint">
            {t('Kolik bys dostal, kdybys dnes prodal vše, co držíš')}
            {liq.basis === 'low' ? t(' za nejnižší nabídky na trhu') : ''}.
          </p>
          <ul className="liq-rows">
            <li><span>{t('Tržní hodnota')}</span><b>{money(lv.gross, currency)}</b></li>
            <li><span>{t('Poplatky tržiště (')}{liq.feePct} %)</span><b className="neg">−{money(lv.fees, currency)}</b></li>
            {lv.shipping > 0 && <li><span>{t('Poštovné a balné')}</span><b className="neg">−{money(lv.shipping, currency)}</b></li>}
            <li className="total"><span>{t('Po prodeji vs. investice')}</span><b className={tone(lv.net - tot.cost)}>{signedMoney(lv.net - tot.cost, currency)}</b></li>
          </ul>
          <div className="liq-settings">
            <label className="field">
              <span>{t('Poplatek tržiště %')}</span>
              <input inputMode="decimal" value={String(liq.feePct).replace('.', ',')} onChange={(e) => {
                const v = Number(e.target.value.replace(',', '.'));
                if (Number.isFinite(v) && v >= 0 && v < 100) setLiq({ ...liq, feePct: v });
              }} />
            </label>
            <label className="field">
              <span>{t('Poštovné na produkt (Kč)')}</span>
              <input inputMode="decimal" value={String(liq.shippingPerPosition)} onChange={(e) => {
                const v = Number(e.target.value.replace(',', '.'));
                if (Number.isFinite(v) && v >= 0) setLiq({ ...liq, shippingPerPosition: v });
              }} />
            </label>
          </div>
        </section>

        {/* Koncentrace */}
        <section className="card an-conc">
          <header className="card-head">
            <h3>{t('Koncentrace')}</h3>
            <div className="segmented sm">
              {(
                [
                  ['product', 'Produkt'],
                  ['set', 'Edice'],
                  ['type', 'Typ'],
                  ['game', 'Hra'],
                ] as [ConcentrationBy, string][]
              ).map(([k, l]) => (
                <button key={k} className={concBy === k ? 'active' : ''} onClick={() => setConcBy(k)}>{t(l)}</button>
              ))}
            </div>
          </header>
          <div className={`conc-level ${conc.level}`}>
            <b>{t(LEVEL.label)}</b>
            <span>
              {t(LEVEL.hint)} {t('Top 3 =')} {Math.round(conc.top3 * 100)} {t('% hodnoty · HHI')} {conc.hhi.toLocaleString(LOCALE)}
            </span>
          </div>
          <ul className="conc-rows">
            {conc.rows.slice(0, 8).map((r) => (
              <li key={r.label} className={r.share > 0.25 ? 'heavy' : ''}>
                <span className="conc-label">{r.label}</span>
                <span className="conc-bar"><i style={{ width: `${Math.max(2, r.share * 100)}%` }} /></span>
                <span className="conc-pct">{Math.round(r.share * 100)} %</span>
              </li>
            ))}
            {conc.rows.length > 8 && (
              <li className="more">+ {conc.rows.length - 8} {t('dalších (')}{Math.round(conc.rows.slice(8).reduce((a, r) => a + r.share, 0) * 100)} %)</li>
            )}
          </ul>
          {heavy.length > 0 && (
            <p className="conc-warn">
              ⚠ {heavy.map((h) => h.label).join(', ')} {heavy.length === 1 ? t('tvoří') : t('tvoří každý')} {t('víc než 25 % hodnoty portfolia.')}
            </p>
          )}
        </section>
      </div>
      </div>
      </PremiumLock>

      {/* Nákupní dávky */}
      <section className="card an-lots">
        <header className="card-head">
          <h3>{t('Nákupní dávky')}</h3>
          <span className="hint">{plural(items.length, ['nákup', 'nákupy', 'nákupů'])}</span>
        </header>
        {lotsByMonth.map(([m, lots]) => {
          const spent = lots.reduce((a, l) => a + l.quantity * unitCost(l), 0);
          return (
            <div key={m} className="lots-month">
              <div className="lots-month-head">
                <span>{m.includes('?') ? t('Bez data') : monthFmt.format(new Date(m + '-15'))}</span>
                <b>{money(spent, currency)}</b>
              </div>
              <ul>
                {lots.map((l) => {
                  const held = heldQty(l);
                  const pl = held * l.currentPrice - held * unitCost(l);
                  return (
                    <li key={l.id}>
                      <button onClick={() => onOpen(positionKey(l))}>
                        <span className="lot-date">{date(l.buyDate)}</span>
                        <span className="lot-name">{l.name}</span>
                        <span className="lot-q">{l.quantity} {t('×')} {money(unitCost(l), currency)}</span>
                        <span className={`lot-pl ${held ? tone(pl) : ''}`}>
                          {held === 0 ? t('prodáno') : held < l.quantity ? t('{0} drženo · {1}', held, signedMoney(pl, currency)) : signedMoney(pl, currency)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}
