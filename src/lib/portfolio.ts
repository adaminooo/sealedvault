import type { Game, PortfolioItem, Sale } from '../types';
import { heldQty, itemStats, totalStats, unitCost, type ItemStats } from './calc';
import { newId } from './format';
import type { MarketSnapshot } from './market';

// ---------- Pozice (stejný produkt z více nákupních dávek) ----------

export interface Position {
  key: string;
  name: string;
  game: Game;
  /** Nákupní dávky, od nejstarší */
  lots: PortfolioItem[];
  /** Reprezentativní dávka (obrázek, edice, typ…) */
  head: PortfolioItem;
  stats: ItemStats & { count: number };
  /** Průměrná pořizovací cena za drženy kus */
  avgCost: number;
}

export const positionKey = (it: PortfolioItem) =>
  it.cmProductId ? `p:${it.cmProductId}` : `n:${it.game}|${it.name.trim().toLowerCase()}`;

const byDate = (a: PortfolioItem, b: PortfolioItem) =>
  (a.buyDate || '').localeCompare(b.buyDate || '') || a.createdAt.localeCompare(b.createdAt);

export function groupPositions(items: PortfolioItem[]): Position[] {
  const map = new Map<string, PortfolioItem[]>();
  for (const it of items) {
    const k = positionKey(it);
    (map.get(k) ?? map.set(k, []).get(k)!).push(it);
  }
  return [...map.entries()].map(([key, lots]) => {
    lots.sort(byDate);
    const stats = totalStats(lots);
    const head = [...lots].reverse().find((l) => l.productImage || l.image) ?? lots[lots.length - 1];
    return {
      key,
      name: head.name,
      game: head.game,
      lots,
      head,
      stats,
      avgCost: stats.held > 0 ? stats.cost / stats.held : lots.reduce((a, l) => a + unitCost(l), 0) / lots.length,
    };
  });
}

// ---------- Prodej (FIFO – nejdřív nejstarší dávky) ----------

export interface SaleInput {
  date: string;
  quantity: number;
  /** cena za kus v Kč */
  price: number;
  /** poplatky celkem v Kč */
  fees: number;
  note?: string;
}

/** Rozdělí prodej mezi dávky od nejstarší; vrací upravené dávky + realizovaný zisk */
export function allocateSale(lots: PortfolioItem[], sale: SaleInput): { updated: PortfolioItem[]; realized: number } {
  let left = sale.quantity;
  const total = sale.quantity;
  const updated: PortfolioItem[] = [];
  let realized = 0;
  for (const lot of [...lots].sort(byDate)) {
    if (left <= 0) break;
    const take = Math.min(heldQty(lot), left);
    if (take <= 0) continue;
    left -= take;
    const fees = Math.round(((sale.fees || 0) * take) / total * 100) / 100;
    const s: Sale = { id: newId(), date: sale.date, quantity: take, price: sale.price, fees, note: sale.note };
    realized += take * sale.price - fees - take * unitCost(lot);
    updated.push({ ...lot, sales: [...(lot.sales ?? []), s], updatedAt: new Date().toISOString() });
  }
  return { updated, realized };
}

// ---------- Likvidační hodnota ----------

export interface LiquidationSettings {
  /** Poplatek tržiště v % z ceny */
  feePct: number;
  /** Poštovné / balné na jeden prodaný produkt (Kč) */
  shippingPerPosition: number;
  /** Ocenění: trend (běžná cena) nebo nejnižší nabídka (rychlý prodej) */
  basis: 'trend' | 'low';
}

export const DEFAULT_LIQUIDATION: LiquidationSettings = { feePct: 5, shippingPerPosition: 0, basis: 'trend' };

/** Kolik bys dostal, kdybys dnes prodal vše, co držíš (v Kč) */
export function liquidationValue(items: PortfolioItem[], s: LiquidationSettings, market: MarketSnapshot | null) {
  let gross = 0;
  let fees = 0;
  let shipping = 0;
  for (const p of groupPositions(items)) {
    if (p.stats.held <= 0) continue;
    for (const lot of p.lots) {
      const held = heldQty(lot);
      if (!held) continue;
      let unit = lot.currentPrice;
      if (s.basis === 'low' && market && lot.cmProductId) {
        const mp = market.byId.get(lot.cmProductId);
        const rate = mp?.currency === 'USD' ? market.usdCzk : market.eurCzk;
        if (mp?.low != null && rate) unit = Math.min(unit, mp.low * rate);
      }
      gross += held * unit;
    }
    shipping += s.shippingPerPosition;
  }
  gross = Math.round(gross);
  fees = Math.round((gross * s.feePct) / 100);
  return { gross, fees, shipping, net: Math.max(0, gross - fees - shipping) };
}

// ---------- Koncentrace ----------

export type ConcentrationBy = 'product' | 'set' | 'type' | 'game';

export function concentration(items: PortfolioItem[], by: ConcentrationBy) {
  const groups = new Map<string, number>();
  if (by === 'product') {
    for (const p of groupPositions(items)) if (p.stats.value > 0) groups.set(p.name, p.stats.value);
  } else {
    for (const it of items) {
      const v = itemStats(it).value;
      if (v <= 0) continue;
      const k = by === 'set' ? it.set || 'Bez edice' : by === 'type' ? it.type : it.game;
      groups.set(k, (groups.get(k) ?? 0) + v);
    }
  }
  const total = [...groups.values()].reduce((a, b) => a + b, 0);
  const rows = [...groups.entries()]
    .map(([label, value]) => ({ label, value, share: total > 0 ? value / total : 0 }))
    .sort((a, b) => b.value - a.value);
  // Herfindahl–Hirschman index (0–10 000): součet čtverců podílů v %
  const hhi = Math.round(rows.reduce((a, r) => a + (r.share * 100) ** 2, 0));
  const level: 'low' | 'mid' | 'high' = hhi < 1500 ? 'low' : hhi < 2500 ? 'mid' : 'high';
  return { rows, total, hhi, level, top3: rows.slice(0, 3).reduce((a, r) => a + r.share, 0) };
}

// ---------- Historie portfolia ----------

export interface HistoryData {
  recordedSince: string | null;
  /** id produktu → [[datum, cena v měně zdroje]] */
  series: Record<string, [string, number][]>;
  /** datum → [EUR/CZK, USD/CZK] */
  rates: Record<string, [number, number | null]>;
  /** Začátek vlastního denního záznamu (starší body jsou doplněné z archivu TCGplayeru) */
  ownSince?: string | null;
  /** id produktu → poslední den doplněný z archivu TCGplayeru */
  estimated?: Record<string, string>;
}

export interface PortfolioPoint {
  date: string;
  /** Pořizovací cena držených kusů (Kč) */
  invested: number;
  /** Tržní hodnota (Kč) – jen od začátku záznamu historie */
  value: number | null;
  /** Kurz EUR/CZK v daný den */
  eur: number | null;
}

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const heldAt = (it: PortfolioItem, date: string) =>
  !it.buyDate || it.buyDate <= date
    ? Math.max(0, it.quantity - (it.sales ?? []).filter((s) => s.date <= date).reduce((a, s) => a + s.quantity, 0))
    : 0;

/** Denní body: investováno (od prvního nákupu) a hodnota (od začátku záznamu cen, dnešek vždy) */
export function portfolioSeries(items: PortfolioItem[], h: HistoryData | null, today: string): PortfolioPoint[] {
  if (!items.length) return [];
  const first = items.map((i) => i.buyDate || today).sort()[0];
  // ceny: carry-forward posledního známého dne
  const priceMaps = new Map<number, Map<string, number>>();
  for (const [id, pts] of Object.entries(h?.series ?? {})) priceMaps.set(Number(id), new Map(pts));
  const last = new Map<number, number>();
  let lastEur: number | null = null;
  let lastUsd: number | null = null;
  const out: PortfolioPoint[] = [];

  for (let d = first; d <= today; d = addDays(d, 1)) {
    const r = h?.rates[d];
    if (r) {
      lastEur = r[0];
      lastUsd = r[1] ?? lastUsd;
    }
    for (const [id, m] of priceMaps) {
      const v = m.get(d);
      if (v != null) last.set(id, v);
    }
    const recording = !!h?.recordedSince && d >= h.recordedSince;
    let invested = 0;
    let value = 0;
    for (const it of items) {
      const q = heldAt(it, d);
      if (!q) continue;
      invested += q * unitCost(it);
      if (d === today) value += q * it.currentPrice;
      else if (recording) {
        const native = it.cmProductId ? last.get(it.cmProductId) : undefined;
        const rate = it.cmProductId && it.cmProductId >= 1e9 ? lastUsd : lastEur;
        value += q * (native != null && rate ? native * rate : it.currentPrice);
      }
    }
    out.push({ date: d, invested, value: d === today || recording ? value : null, eur: lastEur });
  }
  return out;
}
