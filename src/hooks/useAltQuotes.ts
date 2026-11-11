import { useEffect, useMemo, useState } from 'react';
import type { PortfolioItem } from '../types';
import { altFromSnapshot, loadTcgInfo, type AltQuote, type MarketSnapshot, type TcgInfo } from '../lib/market';
import { groupPositions } from '../lib/portfolio';

/**
 * Ceny z druhého trhu pro každou pozici (klíč pozice → AltQuote):
 *  - Pokémon a One Piece: TCGplayer z denních dat (tcg.json, jen jednoznačně spárované produkty)
 *  - Riftbound: Cardmarket přímo z dat snapshotu
 */
export function useAltQuotes(items: PortfolioItem[], market: MarketSnapshot | null) {
  const [tcg, setTcg] = useState<Record<string, TcgInfo> | null>(null);
  const positions = useMemo(() => groupPositions(items).filter((p) => p.stats.held > 0), [items]);

  useEffect(() => {
    if (!positions.some((p) => p.game !== 'Riftbound' && p.head.cmProductId)) return;
    let alive = true;
    loadTcgInfo()
      .then((d) => alive && setTcg(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [positions, market]);

  return useMemo(() => {
    const out = new Map<string, AltQuote>();
    for (const p of positions) {
      let q: AltQuote | null = null;
      if (p.game === 'Riftbound') q = market ? altFromSnapshot(p.head, market) : null;
      else {
        const x = p.head.cmProductId ? tcg?.[p.head.cmProductId] : undefined;
        const v = x && !x.a ? x.m ?? x.l : undefined;
        if (x && v != null)
          q = { source: 'tcgplayer', currency: 'USD', name: x.n, url: `https://www.tcgplayer.com/product/${x.t}`, price: v, low: x.l ?? null };
      }
      if (q) out.set(p.key, q);
    }
    return out;
  }, [positions, tcg, market]);
}
