import { heldQty } from './calc';
import type { HistoryData } from './portfolio';
import type { PortfolioItem } from './types';

/** Kurz ČNB ke dni (poslední známý ≤ den); which 0 = EUR, 1 = USD */
export function rateLookup(rates: HistoryData['rates']) {
  const days = Object.keys(rates).sort();
  return (d: string, which: 0 | 1): number | null => {
    let lo = 0;
    let hi = days.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (days[mid] <= d) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found >= 0 ? (rates[days[found]][which] ?? null) : null;
  };
}

const DAY = 864e5;
export const isoDaysAgo = (n: number, now = Date.now()) => new Date(now - n * DAY).toISOString().slice(0, 10);

/**
 * Hodnota TOHO, CO TEĎ DRŽÍŠ, po dnech za posledních `days` dní (nezávisle na datu nákupu),
 * vyhlazená na ~30 bodů; poslední bod = dnešní ceny. Stejný výpočet jako křivka na webu.
 */
export function holdingsTrend(hist: HistoryData | null, items: PortfolioItem[], days = 90, now = Date.now()): number[] | null {
  if (!hist || !items.length) return null;
  const held = items.filter((it) => heldQty(it) > 0);
  if (!held.length) return null;
  const rate = rateLookup(hist.rates);
  const dates: string[] = [];
  for (let i = days; i >= 1; i--) dates.push(isoDaysAgo(i, now));
  const priced = held.map((it) => ({
    it,
    pts: it.cmProductId ? (hist.series[String(it.cmProductId)] ?? []) : [],
    usd: !!it.cmProductId && it.cmProductId >= 1e9,
  }));
  if (!priced.some((x) => x.pts.length >= 2)) return null;
  const idx = priced.map(() => 0);
  const vals: number[] = [];
  for (const d of dates) {
    let v = 0;
    priced.forEach((x, k) => {
      const q = heldQty(x.it);
      if (!x.pts.length) {
        v += q * x.it.currentPrice;
        return;
      }
      while (idx[k] + 1 < x.pts.length && x.pts[idx[k] + 1][0] <= d) idx[k]++;
      const r = rate(d, x.usd ? 1 : 0);
      v += q * (r ? x.pts[idx[k]][1] * r : x.it.currentPrice);
    });
    vals.push(v);
  }
  vals.push(held.reduce((a, it) => a + heldQty(it) * it.currentPrice, 0));
  const step = Math.max(1, Math.round(vals.length / 30));
  const out: number[] = [];
  for (let i = 0; i < vals.length; i += step) {
    const chunk = vals.slice(i, i + step);
    out.push(chunk.reduce((a, x) => a + x, 0) / chunk.length);
  }
  out[out.length - 1] = vals[vals.length - 1];
  return out;
}

/** Cenová řada produktu v Kč (body [datum, Kč]) – pro graf v detailu */
export function seriesInCzk(hist: HistoryData | null, productId: number | undefined): [string, number][] {
  if (!hist || !productId) return [];
  const rate = rateLookup(hist.rates);
  const usd = productId >= 1e9;
  return (hist.series[String(productId)] ?? []).flatMap(([d, v]) => {
    const r = rate(d, usd ? 1 : 0);
    return r ? [[d, Math.round(v * r)] as [string, number]] : [];
  });
}
