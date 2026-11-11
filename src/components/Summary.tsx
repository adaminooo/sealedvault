import type { Currency, PortfolioItem } from '../types';
import { totalStats } from '../lib/calc';
import { money, pct, signedMoney, tone } from '../lib/format';
import { TrendIcon } from './icons';
import { useCountUp } from '../hooks/useCountUp';
import { Sparkline } from './Sparkline';

import { t } from '../i18n';
interface Props {
  items: PortfolioItem[];
  currency: Currency;
  filtered?: boolean;
  /** Změna hodnoty za poslední den (z historie cen) */
  dayChange?: { abs: number; pct: number } | null;
  /** Hodnota portfolia po dnech (posledních 90 dní) */
  trend?: number[] | null;
}

/** Hlavní karta: hodnota portfolia, celkový výnos a souhrnná čísla */
export function Summary({ items, currency, filtered, dayChange, trend }: Props) {
  const tot = totalStats(items);
  const tn = tone(tot.profit);
  const shown = useCountUp(tot.value);
  return (
    <section className={`hero glow-${tn}`}>
      {/* skutečný vývoj hodnoty zobrazených položek za 90 dní (bez dat se nekreslí nic) */}
      {trend && (
        <span className="hero-trend real" title={t('Vývoj hodnoty za 90 dní')}>
          <Sparkline values={trend} tone={tn} stroke={2} />
        </span>
      )}
      <span className="eyebrow">{filtered ? t('Hodnota vybraných položek') : t('Hodnota portfolia')}</span>
      <div className="hero-value">{money(Math.round(shown), currency)}</div>
      <div className="hero-change">
        <span className={`pill ${tn}`}>
          <TrendIcon dir={tn} />
          {pct(tot.profitPct)}
        </span>
        <span className={`hero-profit ${tn}`}>{signedMoney(tot.profit, currency)}</span>
        <span className="muted">{t('celkem')}</span>
      </div>
      {dayChange && Math.abs(dayChange.pct) >= 0.05 && (
        <div className={`hero-day ${tone(dayChange.abs)}`}>
          <b>{signedMoney(dayChange.abs, currency)}</b>
          <span>({pct(dayChange.pct)})</span>
          <span className="muted">{t('za den')}</span>
        </div>
      )}
      <dl className="hero-stats">
        <div>
          <dt>{t('Investováno')}</dt>
          <dd>{money(tot.cost, currency)}</dd>
        </div>
        <div>
          <dt>{t('Položek')}</dt>
          <dd>{items.length}</dd>
        </div>
        <div>
          <dt>{t('Kusů')}</dt>
          <dd>{tot.count}</dd>
        </div>
      </dl>
    </section>
  );
}
