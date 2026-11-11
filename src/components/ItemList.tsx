import { memo, useMemo } from 'react';
import { conditionTone, type Currency, type PortfolioItem } from '../types';
import { useSetCatalog } from '../hooks/useSetCatalog';
import { money, pct, signedMoney, tone } from '../lib/format';
import type { Position } from '../lib/portfolio';
import type { PriceChange } from '../lib/changes';
import { ProductImage } from './ProductImage';
import { TrendIcon } from './icons';
import { Sparkline } from './Sparkline';

import { t } from '../i18n';
export type ListView = 'list' | 'grid';

interface Props {
  positions: Position[];
  currency: Currency;
  view: ListView;
  onOpen: (p: Position) => void;
  changes?: Map<number, PriceChange>;
  /** průběh ceny za 30 dní (id produktu → ceny) */
  spark?: Map<number, number[]>;
}

/** Změna ceny za den (a týden v nápovědě) – malý ukazatel u produktu */
function DayChange({ c }: { c?: PriceChange }) {
  if (!c || c.d1 == null || Math.abs(c.d1) < 0.05) return null;
  const tn = tone(c.d1);
  return (
    <span className={`day-chg ${tn}`} title={t('Za den {0}{1}', pct(c.d1), c.d7 != null ? ` · za 7 dní ${pct(c.d7)}` : '')}>
      <TrendIcon dir={tn} />{pct(Math.abs(c.d1)).replace(/^[+−-]/, '')} <i>{t('1D')}</i>
    </span>
  );
}

const SourceTag = ({ it }: { it: PortfolioItem }) =>
  it.cmProductId && it.priceAuto !== false ? (
    <span className="cm-mini" title={it.cmName ?? ''}>{it.cmProductId >= 1_000_000_000 ? 'TCG' : 'CM'}</span>
  ) : null;

const NoteIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 4h16v12H8l-4 4z" />
  </svg>
);

/** Počet držených kusů – odznak přes obrázek produktu */
const QtyBadge = ({ q }: { q: number }) => (
  <span className={`qty-badge ${q > 1 ? 'multi' : ''} ${q === 0 ? 'zero' : ''}`} title={`${q} ks`}>
    {q}{t('×')}
  </span>
);

/** Štítky stavu (ze všech dávek) + náhled poznámky + počet dávek */
function PositionMeta({ p }: { p: Position }) {
  const cond = [...new Set(p.lots.flatMap((l) => l.condition ?? []))];
  const note = p.lots.map((l) => l.note).find(Boolean);
  if (!cond.length && !note && p.lots.length < 2) return null;
  return (
    <span className="item-meta">
      {p.lots.length > 1 && <span className="cond-tag lots">{p.lots.length} {t('dávky')}</span>}
      {cond.map((c) => (
        <span key={c} className={`cond-tag ${conditionTone(c)}`}>
          {t(c)}
        </span>
      ))}
      {note && (
        <span className="note-snip" title={note}>
          <NoteIcon />
          {note}
        </span>
      )}
    </span>
  );
}

export const ItemList = memo(function ItemList({ positions, currency, view, onOpen, changes, spark }: Props) {
  const chg = (p: Position) => (p.stats.held && p.head.cmProductId ? changes?.get(p.head.cmProductId) : undefined);
  // Loga pro starší položky bez uloženého loga – dohledá je podle názvu edice
  const pokemonSets = useSetCatalog('Pokémon');
  const logoByName = useMemo(
    () => new Map(pokemonSets.filter((s) => s.logo).map((s) => [s.name.toLowerCase(), s.logo!])),
    [pokemonSets],
  );
  const logoOf = (it: PortfolioItem) => it.setLogo ?? (it.game === 'Pokémon' ? logoByName.get(it.set.toLowerCase()) : undefined);

  if (view === 'grid') {
    return (
      <ul className="grid-cards">
        {positions.map((p, i) => {
          const s = p.stats;
          const soldOut = s.held === 0;
          const tn = tone(soldOut ? s.realized : s.profit);
          const h = p.head;
          return (
            <li key={p.key} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
              <button className={`gcard ${soldOut ? 'sold' : ''}`} onClick={() => onOpen(p)}>
                <span className="gcard-media">
                  <ProductImage game={h.game} type={h.type} image={h.image} productImage={h.productImage} setLogo={logoOf(h)} size="xl" />
                  <span className="gcard-qty">
                    <QtyBadge q={s.held} />
                  </span>
                </span>
                <span className="gcard-body">
                  <span className="gcard-title">{p.name}</span>
                  <span className="row-sub">
                    <SourceTag it={h} />
                    {h.set || h.game}
                  </span>
                  <PositionMeta p={p} />
                  <DayChange c={chg(p)} />
                  <span className="gcard-foot">
                    <span className="row-value">{money(soldOut ? s.proceeds : s.value, currency)}</span>
                    <span className={`row-delta ${tn}`}>
                      <TrendIcon dir={tn} />
                      {soldOut ? t('prodáno') : pct(s.profitPct)}
                    </span>
                  </span>
                  <span className={`gcard-profit ${tn}`}>{signedMoney(soldOut ? s.realized : s.profit, currency)}</span>
                  {s.held > 1 && (
                    <span className="unit-line">
                      {s.held} {t('×')} {money(h.currentPrice, currency)}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="rows">
      {positions.map((p, i) => {
        const s = p.stats;
        const soldOut = s.held === 0;
        const tn = tone(soldOut ? s.realized : s.profit);
        const h = p.head;
        return (
          <li key={p.key} style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
            <button className={`row-btn ${soldOut ? 'sold' : ''}`} onClick={() => onOpen(p)}>
              <span className="thumb">
                <ProductImage game={h.game} type={h.type} image={h.image} productImage={h.productImage} setLogo={logoOf(h)} />
                <QtyBadge q={s.held} />
              </span>
              <span className="row-main">
                <span className="row-title">{p.name}</span>
                <span className="row-sub">{[h.set || h.game, h.type].join(' · ')}</span>
                <span className="row-sub faint">
                  <SourceTag it={h} />
                  {soldOut
                    ? t('Prodáno {0} ks · tržba {1}', s.sold, money(s.proceeds, currency))
                    : t('Ø {0} → {1} / ks', money(p.avgCost, currency), money(h.currentPrice, currency))}
                  <DayChange c={chg(p)} />
                </span>
                <PositionMeta p={p} />
              </span>
              {/* průběh ceny za 30 dní */}
              {!soldOut && h.cmProductId && spark?.get(h.cmProductId) ? (
                <span className="row-spark" title={t('Cena za 30 dní')}>
                  <Sparkline values={spark.get(h.cmProductId)!} area={false} />
                </span>
              ) : null}
              <span className="row-side">
                <span className="row-value">{money(soldOut ? s.proceeds : s.value, currency)}</span>
                <span className={`row-delta ${tn}`}>
                  <TrendIcon dir={tn} />
                  {signedMoney(soldOut ? s.realized : s.profit, currency)}
                  <em>{soldOut ? t('prodáno') : pct(s.profitPct)}</em>
                </span>
                {s.held > 1 && (
                  <span className="unit-line">
                    {s.held} {t('×')} {money(h.currentPrice, currency)}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
});
