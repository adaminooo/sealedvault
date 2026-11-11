import { useMemo, useState } from 'react';
import type { Currency, PortfolioItem } from '../types';
import type { HistoryData, PortfolioPoint } from '../lib/portfolio';
import { avgHoldingDays, cashFlows, groupPerformance, portfolioChange, positionPerformance, xirr } from '../lib/performance';
import { plural, money, pct, signedMoney, tone } from '../lib/format';
import { TrendIcon, TrophyIcon, TrendDownIcon } from './icons';

import { LANG, t } from '../i18n';
interface Props {
  items: PortfolioItem[];
  hist: HistoryData | null;
  points: PortfolioPoint[];
  currency: Currency;
  seriesOf: (it: PortfolioItem) => string;
  onOpen: (key: string) => void;
}

type GroupBy = 'series' | 'set' | 'type' | 'game';
const GROUP_LABEL: Record<GroupBy, string> = { series: 'Série', set: 'Edice', type: 'Typ', game: 'Hra' };

const pctOrDash = (v: number | null) => (v == null ? '—' : pct(v));
const annualTxt = (v: number | null) => (v == null ? '—' : `${pct(v * 100)} / rok`);

/** Pokročilá analytika: roční zhodnocení, nejlepší/nejhorší, pohyby, výkon po skupinách */
export function PerformanceSection({ items, hist, points, currency, seriesOf, onOpen }: Props) {
  const [by, setBy] = useState<GroupBy>('series');

  const annual = useMemo(() => xirr(cashFlows(items)), [items]);
  const holding = useMemo(() => avgHoldingDays(items), [items]);
  const ch7 = useMemo(() => portfolioChange(points, 7), [points]);
  const ch30 = useMemo(() => portfolioChange(points, 30), [points]);
  const perf = useMemo(() => positionPerformance(items, hist?.series), [items, hist]);

  const ranked = [...perf].filter((p) => p.position.stats.profitPct != null).sort((a, b) => b.position.stats.profitPct! - a.position.stats.profitPct!);
  const best = ranked.slice(0, 3);
  const worst = ranked.slice(-3).reverse().filter((p) => !best.includes(p));
  const movers = perf.filter((p) => p.change7 != null && Math.abs(p.change7) >= 0.5).sort((a, b) => Math.abs(b.change7!) - Math.abs(a.change7!)).slice(0, 5);

  const keyOf = (it: PortfolioItem) => (by === 'series' ? seriesOf(it) : by === 'set' ? it.set || 'Bez edice' : by === 'type' ? it.type : it.game);
  const groups = useMemo(() => groupPerformance(items, keyOf), [items, by, seriesOf]); // eslint-disable-line react-hooks/exhaustive-deps

  const Row = ({ p }: { p: (typeof perf)[number] }) => {
    const s = p.position.stats;
    const tn = tone(s.profit);
    return (
      <li>
        <button onClick={() => onOpen(p.position.key)}>
          <span className="pf-name">{p.position.name}</span>
          <span className={`pill sm ${tn}`}>
            <TrendIcon dir={tn} />
            {pct(s.profitPct)}
          </span>
          <span className="pf-sub">
            {signedMoney(s.profit, currency)} · {annualTxt(p.annual)}
          </span>
        </button>
      </li>
    );
  };

  return (
    <section className="card perf">
      <header className="card-head">
        <h3>{t('Výkon')}</h3>
        <span className="hint">{t('roční zhodnocení počítáme metodou XIRR (zohlední, kdy jsi kupoval a prodával)')}</span>
      </header>

      <div className="perf-kpis">
        <div className="kpi">
          <span>{t('Roční zhodnocení')}</span>
          <b className={annual != null ? tone(annual) : ''}>{annual == null ? '—' : pct(annual * 100)}</b>
          <em>{annual == null ? t('potřebuje aspoň 30 dní dat') : t('XIRR celého portfolia')}</em>
        </div>
        <div className="kpi">
          <span>{t('Za 7 dní')}</span>
          <b className={ch7 ? tone(ch7.abs) : ''}>{ch7 ? signedMoney(ch7.abs, currency) : '—'}</b>
          <em>{ch7 ? pct(ch7.pct) : t('po týdnu záznamu cen')}</em>
        </div>
        <div className="kpi">
          <span>{t('Za 30 dní')}</span>
          <b className={ch30 ? tone(ch30.abs) : ''}>{ch30 ? signedMoney(ch30.abs, currency) : '—'}</b>
          <em>{ch30 ? pct(ch30.pct) : t('po měsíci záznamu cen')}</em>
        </div>
        <div className="kpi">
          <span>{t('Ø doba držení')}</span>
          <b>{holding == null ? '—' : holding >= 365 ? `${(holding / 365).toFixed(1).replace('.', LANG === 'en' ? '.' : ',')} ${t('roku')}` : plural(holding, ['den', 'dny', 'dní'])}</b>
          <em>{t('vážená investovanou částkou')}</em>
        </div>
      </div>

      <div className="perf-cols">
        <div>
          <h4 className="h-icon gold"><TrophyIcon size={15} />{t('Nejlepší')}</h4>
          <ul className="pf-list">{best.map((p) => <Row key={p.position.key} p={p} />)}</ul>
        </div>
        <div>
          <h4 className="h-icon neg"><TrendDownIcon size={15} />{t('Nejslabší')}</h4>
          <ul className="pf-list">{worst.length ? worst.map((p) => <Row key={p.position.key} p={p} />) : <li className="hint">{t('Zatím málo položek.')}</li>}</ul>
        </div>
      </div>

      <div className="perf-movers">
        <h4>{t('Největší pohyby ceny za 7 dní')}</h4>
        {movers.length ? (
          <ul className="pf-list">
            {movers.map((p) => (
              <li key={p.position.key}>
                <button onClick={() => onOpen(p.position.key)}>
                  <span className="pf-name">{p.position.name}</span>
                  <span className={`pill sm ${tone(p.change7!)}`}>
                    <TrendIcon dir={tone(p.change7!)} />
                    {pctOrDash(p.change7)}
                  </span>
                  <span className="pf-sub">{t('30 dní:')} {pctOrDash(p.change30)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">{t('Za posledních 7 dní se ceny tvých produktů skoro nehnuly (méně než ±0,5 %).')}</p>
        )}
      </div>

      <div className="perf-groups">
        <div className="card-head">
          <h4>{t('Výkon podle skupin')}</h4>
          <div className="segmented sm">
            {(Object.keys(GROUP_LABEL) as GroupBy[]).map((g) => (
              <button key={g} className={by === g ? 'active' : ''} onClick={() => setBy(g)}>{t(GROUP_LABEL[g])}</button>
            ))}
          </div>
        </div>
        <table className="pf-table">
          <thead>
            <tr>
              <th>{t(GROUP_LABEL[by])}</th>
              <th>{t('Hodnota')}</th>
              <th>{t('Zisk')}</th>
              <th className="hide-sm">{t('Ročně')}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.label}>
                <td>{g.label}</td>
                <td>{money(g.value, currency)}</td>
                <td className={tone(g.profit)}>
                  {signedMoney(g.profit, currency)} <small>{pctOrDash(g.pct)}</small>
                </td>
                <td className="hide-sm">{g.annual == null ? '—' : pct(g.annual * 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
