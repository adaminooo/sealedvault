import { useMemo, useState } from 'react';
import type { Currency, Game } from '../types';
import { formatSource, marketPrice, searchProducts, sourceFor, SOURCE_LABEL, toCzk, type MarketProduct, type MarketSnapshot } from '../lib/market';
import { money } from '../lib/format';
import { SearchIcon } from './icons';

import { t } from '../i18n';
interface Props {
  market: MarketSnapshot | null;
  game: Game;
  currency: Currency;
  onPick: (p: MarketProduct) => void;
}

/** Hledání sealed produktu napříč tržištěm (např. „charizard upc“, „151 bundle“) */
export function ProductSearch({ market, game, currency, onPick }: Props) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const source = SOURCE_LABEL[sourceFor(game, market)];

  // zkratky, které lidé běžně píšou
  const query = text
    .replace(/\bupc\b/gi, 'ultra premium collection')
    .replace(/\betb\b/gi, 'elite trainer box')
    .replace(/\bbb\b/gi, 'booster box');

  const list = useMemo(
    () => (market && query.trim().length >= 2 ? searchProducts(market.products, game, query, 10) : []),
    [market, game, query],
  );

  return (
    <div className="psearch">
      <label className={`psearch-input ${market ? '' : 'disabled'}`}>
        <SearchIcon />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={market ? t('Najdi produkt na {0}u – např. {1}', source, game === 'Pokémon' ? 'charizard upc' : game === 'One Piece' ? 'romance dawn box' : 'origins display') : t('Načítám katalog produktů…')}
          disabled={!market}
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>
      {open && list.length > 0 && (
        <ul className="psearch-list">
          {list.map((p) => {
            const v = marketPrice(p);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPick(p);
                    setText('');
                    setOpen(false);
                  }}
                >
                  <span className="psearch-name">{p.name}</span>
                  <span className="psearch-cat">{p.category.replace(/^(Pokémon|One Piece|Riftbound) /, '')}</span>
                  <span className="psearch-price">
                    {v != null ? (
                      <>
                        <b>{money(toCzk(v, p.currency, market), currency)}</b>
                        <small>{formatSource(v, p.currency)}</small>
                      </>
                    ) : (
                      <small>{t('bez ceny')}</small>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {open && market && query.trim().length >= 2 && list.length === 0 && <p className="psearch-none">{t('Nic nenalezeno – zkus jiná slova.')}</p>}
    </div>
  );
}
