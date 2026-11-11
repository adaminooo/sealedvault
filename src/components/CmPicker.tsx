import { useMemo, useState } from 'react';
import type { Currency } from '../types';
import {
  findMatches,
  formatSource,
  marketPrice,
  productUrl,
  searchProducts,
  sourceFor,
  SOURCE_LABEL,
  toCzk,
  type MarketProduct,
  type MarketSnapshot,
  type MatchQuery,
} from '../lib/market';
import { money } from '../lib/format';

import { t } from '../i18n';
interface Props {
  market: MarketSnapshot | null;
  marketError: string | null;
  query: MatchQuery;
  product: MarketProduct | null;
  /** Produkt vybraný automaticky (ne ručně) */
  isAuto: boolean;
  onPick: (p: MarketProduct | null) => void;
  priceAuto: boolean;
  onPriceAuto: (v: boolean) => void;
  currency: Currency;
}

/** Výběr produktu na tržišti (Pokémon: Cardmarket, Riftbound: TCGplayer) */
export function CmPicker({ market, marketError, query, product, isAuto, onPick, priceAuto, onPriceAuto, currency }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const source = SOURCE_LABEL[sourceFor(query.game, market)];
  const priceLabel = sourceFor(query.game, market) === 'tcgplayer' ? 'market' : 'trend';

  const list = useMemo(() => {
    if (!market || !open) return [];
    return text.trim()
      ? searchProducts(market.products, query.game, text)
      : findMatches(market.products, query, 8).map((x) => x.product);
  }, [market, open, text, query]);

  if (!market) {
    return (
      <div className="cm-box muted-box">
        <strong>{source}</strong>
        <span>{marketError ?? t('Ceny se načítají…')}</span>
      </div>
    );
  }

  const local = (p: MarketProduct) => {
    const v = marketPrice(p);
    return v == null ? null : toCzk(v, p.currency, market);
  };
  const priceLine = (p: MarketProduct) => {
    const v = marketPrice(p);
    if (v == null) return 'bez ceny';
    const native = formatSource(v, p.currency);
    return currency === 'EUR' && p.currency === 'EUR' ? native : `${native} ≈ ${money(local(p)!, currency)}`;
  };
  const price = product ? marketPrice(product) : null;

  return (
    <div className="cm-box">
      <div className="cm-head">
        <strong>{source}</strong>
        <span className="cm-tag">{t('jen ENG')}</span>
        {product && isAuto && <span className="cm-tag">{t('nalezeno automaticky')}</span>}
        <span className="spacer" />
        <button type="button" className="link-btn" onClick={() => setOpen(!open)}>
          {open ? t('Hotovo') : product ? t('Změnit') : t('Vybrat produkt')}
        </button>
      </div>

      {product ? (
        <div className="cm-product">
          <div className="cm-product-main">
            <span className="cm-name">{product.name}</span>
            <a href={productUrl(product)} target="_blank" rel="noreferrer" className="cm-link">
              {t('otevřít na')} {SOURCE_LABEL[product.source]} ↗
            </a>
          </div>
          <div className="cm-price">
            {price != null ? (
              <>
                <b>{money(local(product)!, currency)}</b>
                <span>
                  {priceLabel} {formatSource(price, product.currency)}
                </span>
              </>
            ) : (
              <span>{t('bez ceny')}</span>
            )}
          </div>
        </div>
      ) : (
        !open && <p className="cm-empty">{query.set ? t('Nenašel jsem jistou shodu – vyber produkt ručně.') : t('Vyber edici a typ, produkt najdu sám.')}</p>
      )}

      {product && (
        <label className="switch-row">
          <input type="checkbox" checked={priceAuto} onChange={(e) => onPriceAuto(e.target.checked)} />
          <span>{t('Aktuální cenu brát z')} {SOURCE_LABEL[product.source]}{t('u (aktualizuje se sama)')}</span>
        </label>
      )}

      {open && (
        <div className="cm-search">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('Hledat na {0}u, např. {1}', source, query.game === 'Pokémon' ? 'Surging Sparks ETB' : 'Origins Booster Display')}
            autoComplete="off"
          />
          <ul>
            {list.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={p.id === product?.id ? 'active' : ''}
                  onClick={() => {
                    onPick(p);
                    setOpen(false);
                    setText('');
                  }}
                >
                  <span className="cm-name">{p.name}</span>
                  <span className="cm-cat">{p.category.replace(/^(Pokémon|One Piece|Riftbound) /, '')}</span>
                  <span className="cm-p">{priceLine(p)}</span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="cm-none">{t('Nic nenalezeno.')}</li>}
          </ul>
          {product && (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                onPick(null);
                setOpen(false);
              }}
            >
              {t('Nepárovat (cenu zadám ručně)')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
