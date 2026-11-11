import { useCallback, useEffect, useRef, useState } from 'react';
import { cachedMarket, fetchMarket, isStale, type MarketSnapshot } from '../lib/market';

/** Ceny z Cardmarketu: nejdřív z mezipaměti, pak čerstvé ze serveru (max. jednou za 6 h) */
export function useMarket() {
  const [market, setMarket] = useState<MarketSnapshot | null>(cachedMarket);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const marketRef = useRef(market);
  marketRef.current = market;

  const refresh = useCallback(async (force = false) => {
    if (!force && !isStale(marketRef.current)) return;
    setLoading(true);
    try {
      setMarket(await fetchMarket());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(false);
  }, [refresh]);

  return { market, loading, error, refresh };
}
