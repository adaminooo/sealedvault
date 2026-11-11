import { TargetIcon } from './icons';
import { useState } from 'react';
import { GAMES, type Currency, type Game, type WishlistItem } from '../types';
import { inferType, marketPrice, productImageFor, toCzk, type MarketProduct, type MarketSnapshot } from '../lib/market';
import { fromDisplay, money, toDisplay } from '../lib/format';
import { ProductSearch } from './ProductSearch';
import { ProductImage } from './ProductImage';
import { wishPrice } from '../lib/alerts';

import { t } from '../i18n';
interface Props {
  wishlist: WishlistItem[];
  market: MarketSnapshot | null;
  currency: Currency;
  onAdd: (w: Omit<WishlistItem, 'id' | 'createdAt'>) => Promise<unknown>;
  onUpdate: (w: WishlistItem) => Promise<unknown>;
  onRemove: (id: string) => Promise<unknown>;
  onBuy: (w: WishlistItem) => void;
}

const parseNum = (s: string) => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function WishlistView({ wishlist, market, currency, onAdd, onUpdate, onRemove, onBuy }: Props) {
  const [game, setGame] = useState<Game>('Pokémon');
  const cur = currency === 'CZK' ? t('Kč') : '€';

  async function add(p: MarketProduct) {
    if (wishlist.some((w) => w.cmProductId === p.id)) return;
    const img = await productImageFor(p).catch(() => null);
    const czk = marketPrice(p) != null ? toCzk(marketPrice(p)!, p.currency, market) : undefined;
    await onAdd({
      name: p.name,
      game: p.game,
      set: '',
      type: inferType(p),
      cmProductId: p.id,
      productImage: img ?? undefined,
      // výchozí cíl: o 10 % levněji než dnes
      targetPrice: czk ? Math.round(czk * 0.9) : undefined,
    });
  }

  const sorted = [...wishlist].sort((a, b) => {
    const da = dist(a);
    const db = dist(b);
    return (da ?? 1e9) - (db ?? 1e9);
  });
  function dist(w: WishlistItem) {
    const now = wishPrice(w, market);
    return now != null && w.targetPrice ? (now - w.targetPrice) / w.targetPrice : null;
  }
  const hits = wishlist.filter((w) => (dist(w) ?? 1) <= 0).length;

  return (
    <div className="wishlist">
      <section className="card wl-add">
        <header className="card-head">
          <div>
            <h3>{t('Wishlist')}</h3>
            <p className="hint">
              {t('Produkty, které chceš koupit. Nastav cílovou cenu – až na ni trh klesne, dostaneš upozornění.')}
            </p>
          </div>
          <div className="segmented sm">
            {GAMES.map((g) => (
              <button key={g} className={g === game ? 'active' : ''} onClick={() => setGame(g)}>{g}</button>
            ))}
          </div>
        </header>
        <ProductSearch market={market} game={game} currency={currency} onPick={add} />
        {hits > 0 && <p className="wl-hits h-icon pos"><TargetIcon size={15} />{hits} {hits === 1 ? t('produkt je') : t('produkty jsou')} {t('na cílové ceně nebo pod ní')}</p>}
      </section>

      {wishlist.length === 0 ? (
        <p className="empty">{t('Zatím prázdný – vyhledej produkt nahoře a přidej ho.')}</p>
      ) : (
        <ul className="wl-grid">
          {sorted.map((w) => {
            const now = wishPrice(w, market);
            const d = dist(w);
            const hit = d != null && d <= 0;
            return (
              <li key={w.id} className={`wl-card ${hit ? 'hit' : ''}`}>
                <div className="wl-media">
                  <ProductImage game={w.game} type={w.type} productImage={w.productImage} size="xl" />
                  {hit && <span className="wl-badge">{t('Na cílové ceně')}</span>}
                </div>
                <div className="wl-body">
                  <b className="gcard-title">{w.name}</b>
                  <span className="row-sub">{w.game} · {w.type}</span>
                  <div className="wl-prices">
                    <div>
                      <span>{t('Teď')}</span>
                      <b>{now != null ? money(now, currency) : '—'}</b>
                    </div>
                    <label>
                      <span>{t('Cíl')}</span>
                      <input
                        inputMode="decimal"
                        defaultValue={w.targetPrice ? String(Math.round(toDisplay(w.targetPrice, currency) * 100) / 100).replace('.', ',') : ''}
                        placeholder={cur}
                        onBlur={(e) => {
                          const v = parseNum(e.target.value);
                          const target = v != null ? fromDisplay(v, currency) : undefined;
                          if (target !== w.targetPrice) onUpdate({ ...w, targetPrice: target });
                        }}
                        aria-label={t('Cílová cena')}
                      />
                    </label>
                  </div>
                  {d != null && (
                    <div className="wl-dist">
                      <span className="wl-track"><i style={{ width: `${Math.max(4, Math.min(100, 100 - d * 200))}%` }} className={hit ? 'hit' : ''} /></span>
                      <em className={hit ? 'pos' : ''}>{hit ? t('{0} % pod cílem', Math.round(-d * 100)) : t('ještě {0} % nad cílem', Math.round(d * 100))}</em>
                    </div>
                  )}
                  <div className="wl-actions">
                    <button className="btn sm primary" onClick={() => onBuy(w)}>{t('Koupit')}</button>
                    <button className="btn sm ghost" onClick={() => onRemove(w.id)}>{t('Odebrat')}</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
