import { t } from '../i18n';
import { GAMES, PRODUCT_TYPES, type Game, type PortfolioItem, type ProductType, type Sale, type WishlistItem } from '../types';
import { newId } from './format';

const COLUMNS: (keyof PortfolioItem)[] = [
  'id', 'name', 'game', 'set', 'type', 'quantity', 'buyPrice', 'buyDate', 'fees', 'currentPrice', 'note', 'condition', 'sales', 'alertAbove', 'alertBelow', 'image', 'setLogo', 'productImage', 'cmProductId', 'cmName', 'priceAuto', 'priceUpdatedAt', 'portfolioId', 'createdAt', 'updatedAt',
];

const CSV_HEADERS: Record<keyof PortfolioItem, string> = {
  id: 'id',
  name: 'nazev',
  game: 'hra',
  set: 'edice',
  type: 'typ',
  quantity: 'pocet',
  buyPrice: 'nakupni_cena_ks',
  buyDate: 'datum_nakupu',
  fees: 'postovne_poplatky',
  currentPrice: 'aktualni_cena_ks',
  note: 'poznamka',
  condition: 'stav',
  sales: 'prodeje_json',
  photos: 'fotky',
  alertAbove: 'alert_nad',
  alertBelow: 'alert_pod',
  image: 'obrazek',
  setLogo: 'logo_edice',
  productImage: 'obrazek_produktu',
  cmProductId: 'cardmarket_id',
  cmName: 'cardmarket_nazev',
  priceAuto: 'cena_z_cardmarketu',
  priceUpdatedAt: 'cena_aktualizovana',
  portfolioId: 'portfolio',
  createdAt: 'vytvoreno',
  updatedAt: 'upraveno',
};

// ---------- Export ----------

export function toJson(items: PortfolioItem[], wishlist: WishlistItem[] = []): string {
  return JSON.stringify({ app: 'sealedvault', version: 2, exportedAt: new Date().toISOString(), items, wishlist }, null, 2);
}

/** Wishlist ze zálohy (jen JSON) */
export function parseWishlist(text: string): WishlistItem[] {
  try {
    const data = JSON.parse(text);
    const arr = Array.isArray(data?.wishlist) ? data.wishlist : [];
    return arr
      .filter((w: Record<string, unknown>) => typeof w?.name === 'string' && w.name)
      .map((w: Record<string, unknown>) => ({
        id: String(w.id || newId()),
        name: String(w.name),
        game: (GAMES as readonly string[]).includes(String(w.game)) ? (w.game as Game) : 'Pokémon',
        set: String(w.set ?? ''),
        type: (PRODUCT_TYPES as readonly string[]).includes(String(w.type)) ? (w.type as ProductType) : 'Jiné',
        cmProductId: num(w.cmProductId) > 0 ? Math.round(num(w.cmProductId)) : undefined,
        productImage: safeImage(w.productImage),
        targetPrice: num(w.targetPrice) > 0 ? num(w.targetPrice) : undefined,
        note: w.note ? String(w.note) : undefined,
        createdAt: String(w.createdAt || new Date().toISOString()),
      }));
  } catch {
    return [];
  }
}

/** CSV přehled pozic (seskupené dávky) – „co vidíš, to exportuješ“ */
export function positionsToCsv(
  rows: { name: string; game: string; set: string; type: string; held: number; avgCost: number; price: number; value: number; profit: number; profitPct: number | null; realized: number; lots: number }[],
): string {
  const head = ['nazev', 'hra', 'edice', 'typ', 'drzeno_ks', 'prumerna_nakupni_ks', 'aktualni_cena_ks', 'hodnota', 'nerealizovany_zisk', 'zisk_procenta', 'realizovany_zisk', 'pocet_davek'];
  const fmt = (n: number | null) => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','));
  const lines = rows.map((r) =>
    [r.name, r.game, r.set, r.type, r.held, fmt(r.avgCost), fmt(r.price), fmt(r.value), fmt(r.profit), fmt(r.profitPct), fmt(r.realized), r.lots]
      .map((v) => csvCell(typeof v === 'number' ? String(v) : v))
      .join(';'),
  );
  return '﻿' + [head.join(';'), ...lines].join('\r\n');
}

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV se středníkem a čárkou v desetinných číslech – otevře se rovnou v českém Excelu.
 * Vlastní fotky (data URL) se do CSV nedávají, jsou příliš velké; plnou zálohu dělá JSON.
 */
export function toCsv(items: PortfolioItem[]): string {
  const head = COLUMNS.map((c) => CSV_HEADERS[c]).join(';');
  const lines = items.map((it) =>
    COLUMNS.map((c) => {
      const raw = c === 'image' && it.image?.startsWith('data:') ? '' : it[c];
      const v = c === 'sales' ? (it.sales?.length ? JSON.stringify(it.sales) : '') : Array.isArray(raw) ? raw.join(' | ') : raw;
      return csvCell(typeof v === 'number' ? String(v).replace('.', ',') : v);
    }).join(';'),
  );
  return '﻿' + [head, ...lines].join('\r\n');
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function backupFilename(ext: string): string {
  return `sealed-portfolio-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

// ---------- Import ----------

function parseCsvRows(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const num = (v: unknown, fallback = 0): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v !== 'string' || v.trim() === '') return fallback;
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};

/** Prodeje: pole (JSON záloha) nebo JSON text (CSV) */
function parseSales(v: unknown): Sale[] | undefined {
  let arr: unknown = v;
  if (typeof v === 'string' && v.trim()) {
    try {
      arr = JSON.parse(v);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(arr)) return undefined;
  const out = arr
    .map((s: Record<string, unknown>) => ({
      id: String(s.id || newId()),
      date: String(s.date ?? ''),
      quantity: Math.max(0, Math.round(num(s.quantity))),
      price: num(s.price),
      fees: num(s.fees),
      note: s.note ? String(s.note) : undefined,
    }))
    .filter((s) => s.quantity > 0);
  return out.length ? out : undefined;
}

/** Stav: pole štítků (JSON) nebo „A | B“ (CSV) */
function parseCondition(v: unknown): string[] | undefined {
  const arr = Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split('|') : [];
  const out = arr.map((s) => s.trim()).filter(Boolean);
  return out.length ? out : undefined;
}

/** Povolí jen obrázky jako data:image/… nebo http(s) odkaz */
function safeImage(v: unknown): string | undefined {
  const s = typeof v === 'string' ? v.trim() : '';
  return /^data:image\//.test(s) || /^https?:\/\//i.test(s) ? s : undefined;
}

/** Ošetří a doplní záznam z importu; vrací null u nepoužitelných řádků */
function normalize(raw: Record<string, unknown>): PortfolioItem | null {
  const name = String(raw.name ?? '').trim();
  if (!name) return null;
  const game = (GAMES as readonly string[]).includes(String(raw.game)) ? (raw.game as Game) : 'Pokémon';
  const type = (PRODUCT_TYPES as readonly string[]).includes(String(raw.type)) ? (raw.type as ProductType) : 'Jiné';
  const now = new Date().toISOString();
  const buyPrice = num(raw.buyPrice);
  return {
    id: String(raw.id || newId()),
    name,
    game,
    set: String(raw.set ?? ''),
    type,
    quantity: Math.max(1, Math.round(num(raw.quantity, 1))),
    buyPrice,
    buyDate: String(raw.buyDate ?? ''),
    fees: num(raw.fees),
    currentPrice: num(raw.currentPrice, buyPrice),
    note: String(raw.note ?? ''),
    condition: parseCondition(raw.condition),
    sales: parseSales(raw.sales),
    photos: Array.isArray(raw.photos) ? (raw.photos as unknown[]).map(safeImage).filter((x): x is string => !!x).slice(0, 12) : undefined,
    alertAbove: num(raw.alertAbove) > 0 ? num(raw.alertAbove) : undefined,
    alertBelow: num(raw.alertBelow) > 0 ? num(raw.alertBelow) : undefined,
    image: safeImage(raw.image),
    setLogo: safeImage(raw.setLogo),
    productImage: safeImage(raw.productImage),
    cmProductId: num(raw.cmProductId) > 0 ? Math.round(num(raw.cmProductId)) : undefined,
    cmName: raw.cmName ? String(raw.cmName) : undefined,
    priceAuto: raw.priceAuto === true || raw.priceAuto === 'true' ? true : raw.priceAuto === false || raw.priceAuto === 'false' ? false : undefined,
    priceUpdatedAt: raw.priceUpdatedAt ? String(raw.priceUpdatedAt) : undefined,
    portfolioId: raw.portfolioId && /^[a-z0-9]{1,20}$/i.test(String(raw.portfolioId)) && raw.portfolioId !== 'main' ? String(raw.portfolioId) : undefined,
    createdAt: String(raw.createdAt || now),
    updatedAt: String(raw.updatedAt || now),
  };
}

export function parseBackup(filename: string, text: string): PortfolioItem[] {
  let raws: Record<string, unknown>[];
  if (filename.toLowerCase().endsWith('.json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : data?.items;
    if (!Array.isArray(arr)) throw new Error(t('JSON neobsahuje seznam položek.'));
    raws = arr;
  } else {
    const rows = parseCsvRows(text);
    if (rows.length < 1) throw new Error(t('CSV je prázdné.'));
    const headerToKey = new Map<string, keyof PortfolioItem>();
    for (const k of COLUMNS) {
      headerToKey.set(CSV_HEADERS[k], k);
      headerToKey.set(k.toLowerCase(), k);
    }
    const keys = rows[0].map((h) => headerToKey.get(h.trim().toLowerCase()));
    if (!keys.includes('name')) throw new Error(t('V CSV chybí sloupec „nazev“.'));
    raws = rows.slice(1).map((r) => {
      const o: Record<string, unknown> = {};
      keys.forEach((k, i) => k && (o[k] = r[i]));
      return o;
    });
  }
  const items = raws.map(normalize).filter((x): x is PortfolioItem => x !== null);
  if (items.length === 0) throw new Error(t('Soubor neobsahuje žádné platné položky.'));
  return items;
}
