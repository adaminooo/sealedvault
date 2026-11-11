import { memo, useState } from 'react';
import { GAMES, type Currency, type Game, type PortfolioItem } from '../types';
import { totalStats } from '../lib/calc';
import { money, pct, signedMoney, tone } from '../lib/format';

import { t } from '../i18n';
/** Barvy ověřené na kontrast a čitelnost pro barvoslepé na tmavém pozadí */
export const GAME_COLORS: Record<Game, string> = {
  Pokémon: '#b08a0c',
  'One Piece': '#d0517a',
  Riftbound: '#2b9fd6',
};

interface Props {
  items: PortfolioItem[];
  currency: Currency;
}

const R = 42;
const C = 2 * Math.PI * R;
const GAP = 1.6; // mezera mezi segmenty (v jednotkách obvodu)

/** Rozložení portfolia podle hry – prstencový graf + legenda */
export const GameChart = memo(function GameChart({ items, currency }: Props) {
  const [hover, setHover] = useState<Game | null>(null);
  const [metric, setMetric] = useState<'value' | 'cost'>('value');

  if (items.length === 0) return null;

  const rows = GAMES.map((game) => ({ game, ...totalStats(items.filter((i) => i.game === game)) }));
  const total = rows.reduce((a, r) => a + r[metric], 0);
  const visible = rows.filter((r) => r[metric] > 0);
  const share = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  let offset = 0;
  const segments = visible.map((r) => {
    const len = (r[metric] / total) * C;
    const gap = visible.length > 1 ? GAP : 0;
    const seg = { ...r, dash: Math.max(len - gap, 0.5), offset };
    offset += len;
    return seg;
  });

  const focus = hover ? rows.find((r) => r.game === hover) : null;

  return (
    <section className="card">
      <header className="card-head">
        <h3>{t('Rozložení')}</h3>
        <div className="segmented sm">
          <button className={metric === 'value' ? 'active' : ''} onClick={() => setMetric('value')}>{t('Hodnota')}</button>
          <button className={metric === 'cost' ? 'active' : ''} onClick={() => setMetric('cost')}>{t('Investice')}</button>
        </div>
      </header>

      <div className="alloc">
        <div className="donut-wrap">
          <svg viewBox="0 0 100 100" className="donut" role="img" aria-label={rows.map((r) => `${r.game} ${Math.round(share(r[metric]))} %`).join(', ')}>
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
            {segments.map((s) => (
              <circle
                key={s.game}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={GAME_COLORS[s.game]}
                strokeWidth={hover === s.game ? 12 : 10}
                strokeDasharray={`${s.dash} ${C - s.dash}`}
                strokeDashoffset={-s.offset}
                transform="rotate(-90 50 50)"
                className={`donut-seg ${hover && hover !== s.game ? 'dim' : ''}`}
                onMouseEnter={() => setHover(s.game)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(hover === s.game ? null : s.game)}
              />
            ))}
          </svg>
          <div className="donut-center">
            <span>{focus ? focus.game : t('Celkem')}</span>
            <strong>{money(focus ? focus[metric] : total, currency)}</strong>
            {focus && <span>{Math.round(share(focus[metric]))} %</span>}
          </div>
        </div>

        <ul className="legend">
          {rows.map((r) => (
            <li
              key={r.game}
              className={hover && hover !== r.game ? 'dim' : ''}
              onMouseEnter={() => setHover(r.game)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="swatch" style={{ background: GAME_COLORS[r.game] }} />
              <div className="legend-main">
                <span className="legend-name">{r.game}</span>
                <span className="legend-sub">{money(r[metric], currency)}</span>
                <span className={`legend-sub ${tone(r.profit)}`}>
                  {r.cost > 0 ? `${signedMoney(r.profit, currency)} · ${pct(r.profitPct)}` : '—'}
                </span>
              </div>
              <span className="legend-share">{Math.round(share(r[metric]))} %</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
});
