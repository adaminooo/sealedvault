import { useEffect, useMemo, useState } from 'react';
import type { PortfolioItem } from '../types';
import { fetchHistory } from '../lib/history';
import { priceChanges, type PriceChange } from '../lib/changes';
import type { HistoryData } from '../lib/portfolio';

/** Denní / týdenní změna cen držených produktů (z historie posledních 14 dní) */
export function usePriceChanges(items: PortfolioItem[]): Map<number, PriceChange> {
  const [hist, setHist] = useState<HistoryData | null>(null);
  const ids = useMemo(
    () => [...new Set(items.map((i) => i.cmProductId).filter((x): x is number => !!x))].sort((a, b) => a - b).join(','),
    [items],
  );
  useEffect(() => {
    if (!ids) return;
    let alive = true;
    const from = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
    fetchHistory(ids.split(',').map(Number), from)
      .then((h) => alive && setHist(h))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ids]);
  return useMemo(() => priceChanges(hist), [hist]);
}
