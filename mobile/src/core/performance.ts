import type { PortfolioItem } from './types';
import { heldQty, totalStats, unitCost } from './calc';
import { groupPositions, type PortfolioPoint, type Position } from './portfolio';

export interface CashFlow {
  date: string;
  /** záporné = výdaj (nákup), kladné = příjem (prodej, dnešní hodnota) */
  amount: number;
}

const DAY = 864e5;
const t = (d: string) => new Date(d + 'T12:00:00Z').getTime();
const today = () => new Date().toISOString().slice(0, 10);

/**
 * XIRR – roční zhodnocení zohledňující, kdy peníze přišly a odešly.
 * Vrací např. 0.18 = +18 % ročně, nebo null (málo dat / méně než 30 dní).
 */
export function xirr(flows: CashFlow[]): number | null {
  const f = flows.filter((x) => x.amount !== 0 && x.date);
  if (f.length < 2 || !f.some((x) => x.amount < 0) || !f.some((x) => x.amount > 0)) return null;
  const t0 = Math.min(...f.map((x) => t(x.date)));
  const span = (Math.max(...f.map((x) => t(x.date))) - t0) / DAY;
  if (span < 30) return null; // na krátké období je roční číslo zavádějící
  const npv = (r: number) => f.reduce((a, x) => a + x.amount / Math.pow(1 + r, (t(x.date) - t0) / DAY / 365), 0);
  let lo = -0.99;
  let hi = 10;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Peněžní toky dávek: nákupy, prodeje a dnešní hodnota držených kusů */
export function cashFlows(lots: PortfolioItem[]): CashFlow[] {
  const out: CashFlow[] = [];
  let terminal = 0;
  for (const l of lots) {
    out.push({ date: l.buyDate || today(), amount: -(l.quantity * unitCost(l)) });
    for (const s of l.sales ?? []) out.push({ date: s.date, amount: s.quantity * s.price - (s.fees || 0) });
    terminal += heldQty(l) * l.currentPrice;
  }
  if (terminal > 0) out.push({ date: today(), amount: terminal });
  return out;
}

/** Průměrná doba držení (dny), vážená pořizovací cenou držených kusů */
export function avgHoldingDays(items: PortfolioItem[]): number | null {
  let w = 0;
  let sum = 0;
  const now = Date.now();
  for (const it of items) {
    const held = heldQty(it);
    if (!held || !it.buyDate) continue;
    const cost = held * unitCost(it);
    sum += cost * Math.max(0, (now - t(it.buyDate)) / DAY);
    w += cost;
  }
  return w > 0 ? Math.round(sum / w) : null;
}

export interface PositionPerf {
  position: Position;
  annual: number | null;
  /** změna ceny / ks za období (v %), null = málo historie */
  change7: number | null;
  change30: number | null;
}

/** Změna ceny za n dní z historie (ceny v měně zdroje; poměr nezávisí na měně) */
function changeOver(series: [string, number][] | undefined, days: number): number | null {
  if (!series?.length) return null;
  const last = series[series.length - 1];
  const target = new Date(t(last[0]) - days * DAY).toISOString().slice(0, 10);
  const past = [...series].reverse().find(([d]) => d <= target);
  return past && past[1] > 0 ? ((last[1] - past[1]) / past[1]) * 100 : null;
}

export function positionPerformance(items: PortfolioItem[], series: Record<string, [string, number][]> | undefined): PositionPerf[] {
  return groupPositions(items)
    .filter((p) => p.stats.held > 0)
    .map((p) => {
      const s = p.head.cmProductId ? series?.[String(p.head.cmProductId)] : undefined;
      return { position: p, annual: xirr(cashFlows(p.lots)), change7: changeOver(s, 7), change30: changeOver(s, 30) };
    });
}

/** Změna hodnoty portfolia za n dní (Kč), jen když existuje záznam z té doby */
export function portfolioChange(points: PortfolioPoint[], days: number): { abs: number; pct: number } | null {
  const last = points[points.length - 1];
  if (!last?.value) return null;
  const target = new Date(t(last.date) - days * DAY).toISOString().slice(0, 10);
  const past = [...points].reverse().find((p) => p.date <= target && p.value != null);
  if (!past?.value) return null;
  // očistit o nákupy/prodeje v mezidobí: porovnat zisk (hodnota − investováno)
  const gainNow = last.value - last.invested;
  const gainThen = past.value - past.invested;
  return { abs: gainNow - gainThen, pct: past.value > 0 ? ((gainNow - gainThen) / past.value) * 100 : 0 };
}

/** Výkon po skupinách (série / edice / typ / hra) */
export function groupPerformance(items: PortfolioItem[], keyOf: (it: PortfolioItem) => string) {
  const groups = new Map<string, PortfolioItem[]>();
  for (const it of items) {
    const k = keyOf(it);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(it);
  }
  return [...groups.entries()]
    .map(([label, lots]) => {
      const s = totalStats(lots);
      return { label, cost: s.cost, value: s.value, profit: s.profit + s.realized, pct: s.profitPct, annual: xirr(cashFlows(lots)), held: s.held };
    })
    .filter((g) => g.held > 0 || g.profit !== 0)
    .sort((a, b) => b.value - a.value);
}
