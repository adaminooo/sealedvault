import { useEffect, useMemo, useState } from 'react';
import type { PortfolioItem } from '../types';
import { fetchHistory } from '../lib/history';
import { priceChanges, type PriceChange } from '../lib/changes';
import type { HistoryData } from '../lib/portfolio';
import { heldQty } from '../lib/calc';
import { rateLookup } from '../components/PositionDetail';

const DAY = 864e5;
const isoDaysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

/**
 * Historie cen držených produktů za posledních 90 dní:
 *  - changes: denní / týdenní změna ceny (id produktu → %)
 *  - spark: průběh ceny za 30 dní pro mini graf u produktu (id → ceny)
 *  - trend: hodnota portfolia za 90 dní pro křivku na hlavní kartě
 */
export function usePriceChanges(items: PortfolioItem[], trendItems: PortfolioItem[] = items) {
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

  // hodnota TOHO, CO TEĎ DRŽÍŠ, po dnech za posledních 90 dní (nezávisle na datu nákupu)
  //  – tak graf funguje i u položek přidaných dnes; vývoj od nákupů je v Analýze
  const trend = useMemo(() => {
    if (!hist || !trendItems.length) return null;
    const held = trendItems.filter((it) => heldQty(it) > 0);
    if (!held.length) return null;
    const rate = rateLookup(hist.rates);
    const days: string[] = [];
    for (let i = 90; i >= 1; i--) days.push(isoDaysAgo(i));
    // ceny po dnech (poslední známá; před prvním záznamem první známá)
    const priced = held.map((it) => {
      const pts = it.cmProductId ? hist.series[String(it.cmProductId)] ?? [] : [];
      return { it, pts, usd: !!it.cmProductId && it.cmProductId >= 1e9 };
    });
    if (!priced.some((x) => x.pts.length >= 2)) return null;
    const idx = priced.map(() => 0);
    const vals: number[] = [];
    for (const d of days) {
      let v = 0;
      priced.forEach((x, k) => {
        const q = heldQty(x.it);
        if (!x.pts.length) {
          v += q * x.it.currentPrice;
          return;
        }
        while (idx[k] + 1 < x.pts.length && x.pts[idx[k] + 1][0] <= d) idx[k]++;
        const native = x.pts[idx[k]][1];
        const r = rate(d, x.usd ? 1 : 0);
        v += q * (r ? native * r : x.it.currentPrice);
      });
      vals.push(v);
    }
    // dnešek = aktuální ceny
    vals.push(held.reduce((a, it) => a + heldQty(it) * it.currentPrice, 0));
    // vyhladit na ~30 bodů
    const step = Math.max(1, Math.round(vals.length / 30));
    const out: number[] = [];
    for (let i = 0; i < vals.length; i += step) {
      const chunk = vals.slice(i, i + step);
      out.push(chunk.reduce((a, x) => a + x, 0) / chunk.length);
    }
    out[out.length - 1] = vals[vals.length - 1];
    return out;
  }, [hist, trendItems]);

  return { changes, spark, trend };
}
