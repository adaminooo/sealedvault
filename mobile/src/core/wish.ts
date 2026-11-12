import { marketPrice, toCzk, type MarketSnapshot } from './market';
import type { WishlistItem } from './types';

/** Dnešní cena produktu z wishlistu (Kč), pokud je spárovaný s trhem */
export function wishPrice(w: WishlistItem, market: MarketSnapshot | null): number | null {
  if (!w.cmProductId || !market) return null;
  const p = market.byId.get(w.cmProductId);
  const v = marketPrice(p);
  return p && v != null ? toCzk(v, p.currency, market) : null;
}

/** Vzdálenost od cílové ceny: −0,1 = 10 % pod cílem, 0,2 = 20 % nad cílem; null = neznámé */
export function wishDistance(w: WishlistItem, market: MarketSnapshot | null): number | null {
  const now = wishPrice(w, market);
  return now != null && w.targetPrice ? (now - w.targetPrice) / w.targetPrice : null;
}
