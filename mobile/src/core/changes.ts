import type { HistoryData } from './portfolio';

export interface PriceChange {
  /** změna ceny za den v % (poslední záznam vs. předchozí den) */
  d1: number | null;
  /** změna ceny za 7 dní v % */
  d7: number | null;
}

const DAY = 864e5;
const t = (d: string) => Date.parse(d + 'T12:00:00Z');

/** Bod řady nejblíž k cíli (≤ cíl), ale nejvýš `tolerance` dní starý */
function pointAtOrBefore(pts: [string, number][], target: number, tolerance: number) {
  for (let i = pts.length - 1; i >= 0; i--) {
    const at = t(pts[i][0]);
    if (at <= target) return target - at <= tolerance * DAY ? pts[i] : null;
  }
  return null;
}

/** Denní a týdenní změna ceny produktů z historie (id produktu → změna v %) */
export function priceChanges(hist: HistoryData | null): Map<number, PriceChange> {
  const out = new Map<number, PriceChange>();
  for (const [id, pts] of Object.entries(hist?.series ?? {})) {
    if (pts.length < 2) continue;
    const last = pts[pts.length - 1];
    const now = t(last[0]);
    const prev = pointAtOrBefore(pts.slice(0, -1), now - DAY, 3);
    const week = pointAtOrBefore(pts, now - 7 * DAY, 3);
    const rel = (p: [string, number] | null) => (p && p[1] > 0 ? ((last[1] - p[1]) / p[1]) * 100 : null);
    out.set(Number(id), { d1: rel(prev), d7: rel(week) });
  }
  return out;
}

/** Změna hodnoty v Kč z procentní změny ceny (hodnota je dnešní) */
export const changeAbs = (valueNow: number, pctChange: number | null) =>
  pctChange == null ? null : valueNow - valueNow / (1 + pctChange / 100);
