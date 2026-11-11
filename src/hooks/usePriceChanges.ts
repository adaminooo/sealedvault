import { useEffect, useMemo, useState } from 'react';
import type { PortfolioItem } from '../types';
import { fetchHistory } from '../lib/history';
import { priceChanges, type PriceChange } from '../lib/changes';
import { portfolioSeries, type HistoryData } from '../lib/portfolio';

const DAY = 864e5;
const isoDaysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Historie cen držených produktů za posledních 90 dní:
 *  - changes: denní / týdenní změna ceny (id produktu → %)
 *  - spark: průběh ceny za 30 dní pro mini graf u produktu (id → ceny)
 *  - trend: hodnota portfolia za 90 dní pro křivku na hlavní kartě
 */
export function usePriceChanges(items: PortfolioItem[]) {
  const [hist, setHist] = useState<HistoryData | null>(null);
  const ids = useMemo(
    () => [...new Set(items.map((i) => i.cmProductId).filter((x): x is number => !!x))].sort((a, b) => a - b).join(','),
    [items],
  );
  useEffect(() => {
    if (!ids) return;
    let alive = true;
    fetchHistory(ids.split(',').map(Number), isoDaysAgo(90))
      .then((h) => alive && setHist(h))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ids]);

  const changes = useMemo<Map<number, PriceChange>>(() => priceChanges(hist), [hist]);

  const spark = useMemo(() => {
    const from = isoDaysAgo(30);
    const out = new Map<number, number[]>();
    for (const [id, pts] of Object.entries(hist?.series ?? {})) {
      const recent = pts.filter(([d]) => d >= from).map(([, v]) => v);
      if (recent.length >= 3) out.set(Number(id), recent);
    }
    return out;
  }, [hist]);

  // hodnota portfolia po dnech (jen dny, kdy už byly nákupy) – pro křivku na hlavní kartě
  const trend = useMemo(() => {
    if (!hist) return null;
    const from = isoDaysAgo(90);
    const pts = portfolioSeries(items, hist, today()).filter((p) => p.date >= from && p.value != null);
    if (pts.length < 5) return null;
    // vyhladit: průměr po ~3 dnech (čistší křivka bez schodů z týdenních dat)
    const vals = pts.map((p) => p.value as number);
    const step = Math.max(1, Math.round(vals.length / 30));
    const out: number[] = [];
    for (let i = 0; i < vals.length; i += step) {
      const chunk = vals.slice(i, i + step);
      out.push(chunk.reduce((a, v) => a + v, 0) / chunk.length);
    }
    out[out.length - 1] = vals[vals.length - 1];
    return out;
  }, [hist, items]);

  return { changes, spark, trend };
}
