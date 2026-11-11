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

/** Dekorativní křivka v pozadí – stoupá při zisku, klesá při ztrátě (jen ozdoba, ne skutečná data) */
const TREND_PATHS = {
  pos: 'M0,104 C40,100 70,92 110,94 S170,78 210,72 S270,70 300,52 S360,30 400,14',
  neg: 'M0,22 C40,26 70,36 110,32 S170,50 210,56 S270,58 300,76 S360,96 400,108',
  neutral: 'M0,70 C50,62 90,74 140,68 S220,60 260,66 S340,74 400,64',
} as const;

function HeroTrend({ dir }: { dir: 'pos' | 'neg' | 'neutral' }) {
  const d = TREND_PATHS[dir];
  return (
    <svg className="hero-trend" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`ht-fill-${dir}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`ht-line-${dir}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.35" stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <path d={`${d} L400,120 L0,120 Z`} fill={`url(#ht-fill-${dir})`} />
      <path d={d} fill="none" stroke={`url(#ht-line-${dir})`} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Hlavní karta: hodnota portfolia, celkový výnos a souhrnná čísla */
export function Summary({ items, currency, filtered, dayChange, trend }: Props) {
  const tot = totalStats(items);
  const tn = tone(tot.profit);
  const shown = useCountUp(tot.value);
  return (
    <section className={`hero glow-${tn}`}>
      {/* skutečný vývoj hodnoty za 90 dní; dokud nejsou data, jen ozdobná křivka */}
      {trend && !filtered ? (
        <span className="hero-trend real" title={t('Vývoj hodnoty za 90 dní')}>
          <Sparkline values={trend} tone={tn} stroke={2} />
        </span>
      ) : (
        <HeroTrend dir={tn} />
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
