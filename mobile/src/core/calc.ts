import type { PortfolioItem } from './types';

/** Prodané kusy z dávky */
export const soldQty = (it: PortfolioItem) => (it.sales ?? []).reduce((a, s) => a + s.quantity, 0);
/** Kusy, které stále držíš */
export const heldQty = (it: PortfolioItem) => Math.max(0, it.quantity - soldQty(it));
/** Pořizovací cena za kus vč. rozpočítaných poplatků */
export const unitCost = (it: PortfolioItem) => it.buyPrice + (it.fees || 0) / Math.max(1, it.quantity);

export interface ItemStats {
  /** Kusy v držení */
  held: number;
  /** Pořizovací cena držených kusů (vč. poplatků) */
  cost: number;
  /** Aktuální hodnota držených kusů */
  value: number;
  /** Nerealizovaný zisk (držené kusy) */
  profit: number;
  /** Nerealizovaný zisk v % (null, když investice = 0) */
  profitPct: number | null;
  /** Realizovaný zisk z prodejů */
  realized: number;
  /** Tržby z prodejů po poplatcích */
  proceeds: number;
  /** Pořizovací cena prodaných kusů */
  soldCost: number;
  sold: number;
}

export function itemStats(item: PortfolioItem): ItemStats {
  const uc = unitCost(item);
  const sold = soldQty(item);
  const held = Math.max(0, item.quantity - sold);
  const cost = held * uc;
  const value = held * item.currentPrice;
  const profit = value - cost;
  let proceeds = 0;
  for (const s of item.sales ?? []) proceeds += s.quantity * s.price - (s.fees || 0);
  const soldCost = sold * uc;
  return {
    held,
    cost,
    value,
    profit,
    profitPct: cost > 0 ? (profit / cost) * 100 : null,
    realized: proceeds - soldCost,
    proceeds,
    soldCost,
    sold,
  };
}

export function totalStats(items: PortfolioItem[]): ItemStats & { count: number } {
  const t = { held: 0, cost: 0, value: 0, realized: 0, proceeds: 0, soldCost: 0, sold: 0 };
  for (const it of items) {
    const s = itemStats(it);
    t.held += s.held;
    t.cost += s.cost;
    t.value += s.value;
    t.realized += s.realized;
    t.proceeds += s.proceeds;
    t.soldCost += s.soldCost;
    t.sold += s.sold;
  }
  const profit = t.value - t.cost;
  return { ...t, profit, profitPct: t.cost > 0 ? (profit / t.cost) * 100 : null, count: t.held };
}
