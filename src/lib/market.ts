import { t, LOCALE } from '../i18n';
import type { Game, PortfolioItem, ProductType } from '../types';
import { clearData, getData } from './data';

export type MarketSource = 'cardmarket' | 'tcgplayer';
export type MarketCurrency = 'EUR' | 'USD';

export const SOURCE_LABEL: Record<MarketSource, string> = { cardmarket: 'Cardmarket', tcgplayer: 'TCGplayer' };
export const SOURCE_SHORT: Record<MarketSource, string> = { cardmarket: 'CM', tcgplayer: 'TCG' };

/** Sealed produkt z tržiště; ceny v měně zdroje (Cardmarket EUR, TCGplayer USD) */
export interface MarketProduct {
  id: number;
  game: Game;
  name: string;
  category: string;
  source: MarketSource;
  currency: MarketCurrency;
  /** Cardmarket: trend, TCGplayer: market price */
  trend: number | null;
  avg: number | null;
  low: number | null;
  /** Obrázek produktu (u TCGplayeru přímo v datech) */
  image?: string | null;
}

export interface GameSource {
  game: Game;
  source: MarketSource;
  currency: MarketCurrency;
  priceDate: string;
}

export interface MarketSnapshot {
  fetchedAt: string;
  /** Nejstarší datum ceníku ze všech zdrojů */
  priceDate: string;
  /** Kurzy ČNB, Kč za 1 €/$ */
  eurCzk: number | null;
  usdCzk: number | null;
  sources: GameSource[];
  products: MarketProduct[];
  byId: Map<number, MarketProduct>;
  /** Druhý trh přímo v datech (Riftbound na Cardmarketu) – jen pro porovnání */
  altProducts: MarketProduct[];
}

/** Cena produktu na druhém trhu (pro porovnání a ocenění) */
export interface AltQuote {
  source: MarketSource;
  currency: MarketCurrency;
  name: string;
  url: string;
  /** Hlavní cena (trend / market) v měně zdroje */
  price: number;
  low: number | null;
}

/** Jak počítat aktuální cenu z trhů */
export type Valuation = 'main' | 'avg' | 'min';

type RawGame = GameSource & {
  products: [number, string, string, number | null, number | null, number | null, (string | null)?][];
};
type RawSnapshot = { fetchedAt: string; eurCzk: number | null; usdCzk?: number | null; games: RawGame[]; alt?: RawGame[] };

const CACHE_KEY = 'tcg-portfolio:market';
/** Ceníky se mění jednou denně */
const MAX_AGE = 6 * 60 * 60 * 1000;
/** Záložní kurzy, když ČNB nejde načíst */
const FALLBACK = { EUR: 24.3, USD: 21.7 };
/** TCGplayer ID jsou na serveru posunutá, aby se nepletla s Cardmarketem */
const TCG_ID_OFFSET = 1_000_000_000;

/**
 * Cardmarket nemá jazyk jako kategorii – neanglické sealed produkty poznáme podle názvu
 * („JP Booster Box“, „Simplified Chinese …“, „Indonesian & Thai …“, „(French)“…).
 * „US Version“, „EU Version“, „International“ apod. jsou anglické a zůstávají.
 */
const NON_ENGLISH =
  /\b(JP|Japanese|Chinese|Simplified|Traditional|Korean|Thai|Indonesian|Taiwan|French|German|Italian|Spanish|Portuguese|Polish|Dutch)\b|Non-English|Asia Region/;

export function isEnglishProduct(name: string): boolean {
  return !NON_ENGLISH.test(name);
}

function hydrate(raw: RawSnapshot): MarketSnapshot {
  const products: MarketProduct[] = [];
  const sources: GameSource[] = [];
  for (const g of raw.games) {
    // starší mezipaměť neměla zdroj → byl to Cardmarket
    const source: MarketSource = g.source ?? 'cardmarket';
    const currency: MarketCurrency = g.currency ?? 'EUR';
    sources.push({ game: g.game, source, currency, priceDate: g.priceDate });
    for (const [id, name, category, trend, avg, low, image] of g.products) {
      if (!isEnglishProduct(name)) continue; // jen ENG verze
      products.push({ id, game: g.game, name, category, source, currency, trend, avg, low, image });
    }
  }
  return {
    fetchedAt: raw.fetchedAt,
    priceDate: sources.map((s) => s.priceDate).sort()[0] ?? raw.fetchedAt,
    eurCzk: raw.eurCzk,
    usdCzk: raw.usdCzk ?? null,
    sources,
    products,
    byId: new Map(products.map((p) => [p.id, p])),
    altProducts: (raw.alt ?? []).flatMap((g) =>
      g.products
        .filter(([, name]) => isEnglishProduct(name))
        .map(([id, name, category, trend, avg, low]) => ({
          id, game: g.game, name, category, trend, avg, low,
          source: g.source ?? 'cardmarket', currency: g.currency ?? 'EUR',
        })),
    ),
  };
}

export function cachedMarket(): MarketSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? hydrate(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function isStale(m: MarketSnapshot | null): boolean {
  // mezipaměť bez TCGplayeru (starší verze) je zastaralá vždy
  return !m || !m.sources.some((s) => s.source === 'tcgplayer') || !m.sources.some((s) => s.game === 'One Piece') || Date.now() - new Date(m.fetchedAt).getTime() > MAX_AGE;
}

/** Stáhne denní ceny (statický soubor, aktualizuje ho GitHub Actions) */
export async function fetchMarket(): Promise<MarketSnapshot> {
  let raw: RawSnapshot;
  try {
    clearData();
    raw = await getData<RawSnapshot>('prices.json');
  } catch {
    throw new Error(t('Ceny se nepodařilo načíst – zkontroluj připojení k internetu.'));
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(raw));
  } catch {
    /* plné úložiště – nevadí, data jsou aspoň v paměti */
  }
  return hydrate(raw);
}

/** Cena v měně zdroje: trend/market, jinak průměr, jinak nejnižší nabídka */
export function marketPrice(p: MarketProduct | undefined | null): number | null {
  if (!p) return null;
  return p.trend ?? p.avg ?? p.low ?? null;
}

function czkRate(c: MarketCurrency, m: MarketSnapshot | null): number {
  return (c === 'EUR' ? m?.eurCzk : m?.usdCzk) ?? FALLBACK[c];
}

/** Cena z tržiště (EUR/USD) → Kč (v Kč se ukládá všechno; zobrazení v € přepočítá format.money) */
export function toCzk(amount: number, from: MarketCurrency, m: MarketSnapshot | null): number {
  return Math.round(amount * czkRate(from, m)); // celé koruny
}

const fmtCache: Partial<Record<MarketCurrency, Intl.NumberFormat>> = {};
export function formatSource(amount: number, c: MarketCurrency): string {
  fmtCache[c] ??= new Intl.NumberFormat(LOCALE, { style: 'currency', currency: c });
  return fmtCache[c]!.format(amount);
}

export function productUrl(p: Pick<MarketProduct, 'id' | 'name' | 'game' | 'source'>): string {
  if (p.source === 'tcgplayer') return `https://www.tcgplayer.com/product/${p.id - TCG_ID_OFFSET}`;
  const game = p.game === 'Pokémon' ? 'Pokemon' : p.game === 'One Piece' ? 'OnePiece' : 'Riftbound';
  return `https://www.cardmarket.com/cs/${game}/Products/Search?searchString=${encodeURIComponent(p.name)}`;
}

/** Zdroj cen pro hru (podle načtených dat; výchozí Pokémon = CM, Riftbound = TCG) */
export function sourceFor(game: Game, m: MarketSnapshot | null): MarketSource {
  return m?.sources.find((s) => s.game === game)?.source ?? (game === 'Riftbound' ? 'tcgplayer' : 'cardmarket');
}

// ---------- Párování ----------

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Klíčová slova v názvu produktu pro každý typ */
const TYPE_RULES: Record<ProductType, { want: RegExp | null; avoid: RegExp }> = {
  'Booster box': { want: /booster box|booster display/, avoid: /case|18 booster|half|mini|deck|showdown/ },
  ETB: { want: /elite trainer box/, avoid: /case|pokemon center/ },
  Display: { want: /display|booster box/, avoid: /case|sleeved|build|half|deck|showdown/ },
  'Booster bundle': { want: /booster bundle|bundle/, avoid: /case|display|art bundle/ },
  UPC: { want: /ultra premium collection/, avoid: /coin|promos|case/ },
  'Premium Collection': { want: /premium collection/, avoid: /ultra premium|coin|promos|case/ },
  'Collection box': { want: /collection|box/, avoid: /elite trainer|booster box|ultra premium|case|coin|promos/ },
  Tin: { want: /\btin\b/, avoid: /empty|case|display/ },
  Blister: { want: /blister/, avoid: /case|display|pin/ },
  Booster: { want: /booster( pack)?$|booster pack/, avoid: /box|bundle|display|case|code card/ },
  Deck: { want: /deck/, avoid: /case|display|box set/ },
  Jiné: { want: null, avoid: /case/ },
};

const DEFAULT_SUFFIXES: Record<ProductType, string[]> = {
  'Booster box': ['booster box', 'booster display'],
  ETB: ['elite trainer box'],
  Display: ['booster box', 'booster display'],
  'Booster bundle': ['booster bundle'],
  UPC: ['ultra premium collection'],
  'Premium Collection': ['premium collection'],
  'Collection box': [],
  Tin: [],
  Blister: [],
  Booster: ['booster', 'booster pack'],
  Deck: ['starter deck', 'deck'],
  Jiné: [],
};

/** Typ produktu odhadnutý z názvu na tržišti */
export function inferType(p: Pick<MarketProduct, 'name' | 'game'>): ProductType {
  const n = norm(p.name);
  if (/ultra premium collection/.test(n)) return 'UPC';
  if (/premium collection/.test(n)) return 'Premium Collection';
  if (/elite trainer box/.test(n)) return 'ETB';
  if (/booster bundle/.test(n)) return 'Booster bundle';
  if (/booster box|booster display/.test(n)) return p.game === 'Riftbound' ? 'Display' : 'Booster box';
  if (/\btin\b/.test(n)) return 'Tin';
  if (/blister/.test(n)) return 'Blister';
  if (/\bdeck\b/.test(n) && !/deck box/.test(n)) return 'Deck';
  if (/collection|box/.test(n)) return 'Collection box';
  if (/booster/.test(n)) return 'Booster';
  return 'Jiné';
}

// ---------- Obrázky produktů ----------

const IMG_CACHE_KEY = 'tcg-portfolio:images';
let imgCache: Record<string, string | null> | null = null;
function readImgCache(): Record<string, string | null> {
  if (imgCache) return imgCache;
  try {
    imgCache = JSON.parse(localStorage.getItem(IMG_CACHE_KEY) ?? '{}');
  } catch {
    imgCache = {};
  }
  return imgCache!;
}

/** Stejný produkt na TCGplayeru (denní data): t = id, n = název, m = market $, l = nejnižší $, i = obrázek, a = nejednoznačné */
export interface TcgInfo {
  t: number;
  n: string;
  m?: number;
  l?: number;
  i?: string;
  a?: 1;
}
export const loadTcgInfo = () => getData<Record<string, TcgInfo>>('tcg.json');

/** Obrázek produktu: z dat tržiště (TCGplayer), jinak z denních dat párování; výsledky si pamatuje */
export async function productImageFor(p: Pick<MarketProduct, 'id' | 'name' | 'game' | 'image'>): Promise<string | null> {
  if (p.image) return p.image;
  const key = `${p.game}|${p.name}`;
  const cache = readImgCache();
  if (key in cache) return cache[key];
  const url = (await loadTcgInfo())[p.id]?.i ?? null;
  // „nenalezeno“ jen do paměti – po restartu appky se zkusí znovu (katalog se mohl rozšířit)
  cache[key] = url;
  if (url) {
    try {
      const stored = JSON.parse(localStorage.getItem(IMG_CACHE_KEY) ?? '{}');
      stored[key] = url;
      localStorage.setItem(IMG_CACHE_KEY, JSON.stringify(stored));
    } catch {
      /* nevadí */
    }
  }
  return url;
}

export interface MatchQuery {
  game: Game;
  set: string;
  type: ProductType;
  name?: string;
}

function score(p: MarketProduct, q: MatchQuery, setN: string, nameN: string): number {
  const n = norm(p.name);
  const rule = TYPE_RULES[q.type];
  let s = 0;
  if (setN) {
    if (n.startsWith(setN)) s += 30;
    else if (n.includes(setN)) s += 20;
    else return -Infinity;
  }
  if (nameN && n === nameN) s += 40;
  if (rule.want) s += rule.want.test(n) ? 25 : -15;
  if (rule.avoid.test(n)) s -= 30;
  if (setN && DEFAULT_SUFFIXES[q.type].some((suf) => n === `${setN} ${suf}`)) s += 15;
  if (marketPrice(p) == null) s -= 5;
  return s - n.length / 50; // kratší = obecnější produkt
}

/** Kandidáti pro položku seřazení podle shody */
export function findMatches(products: MarketProduct[], q: MatchQuery, limit = 8): { product: MarketProduct; score: number }[] {
  const setN = norm(q.set);
  const nameN = norm(q.name ?? '');
  if (!setN && !nameN) return [];
  return products
    .filter((p) => p.game === q.game)
    .map((product) => ({ product, score: score(product, q, setN, setN ? nameN : '') }))
    .filter((x) => x.score > -Infinity && (setN || norm(x.product.name).includes(nameN)))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Nejlepší shoda, jen když je dost jistá (edice + typ sedí) */
export function bestMatch(products: MarketProduct[], q: MatchQuery): MarketProduct | null {
  const [top] = findMatches(products, q, 1);
  return top && top.score >= 40 ? top.product : null;
}

/** Fulltext v produktech dané hry */
export function searchProducts(products: MarketProduct[], game: Game, text: string, limit = 12): MarketProduct[] {
  const words = norm(text).split(' ').filter(Boolean);
  if (!words.length) return [];
  return products
    .filter((p) => p.game === game)
    .filter((p) => {
      const n = norm(p.name);
      return words.every((w) => n.includes(w));
    })
    .sort((a, b) => a.name.length - b.name.length)
    .slice(0, limit);
}

/** Položka s napárovaným produktem a zapnutou automatickou cenou → nová aktuální cena */
export function autoPriceFor(item: PortfolioItem, m: MarketSnapshot, alt?: AltQuote | null, mode: Valuation = 'main'): number | null {
  if (!item.cmProductId || item.priceAuto === false) return null;
  const p = m.byId.get(item.cmProductId);
  const price = marketPrice(p);
  if (!p || price == null) return null;
  const main = toCzk(price, p.currency, m);
  if (mode === 'main' || !alt) return main;
  const second = toCzk(alt.price, alt.currency, m);
  return mode === 'avg' ? Math.round((main + second) / 2) : Math.min(main, second);
}

/** Riftbound: stejný produkt na Cardmarketu (z dat snapshotu) */
export function altFromSnapshot(item: Pick<PortfolioItem, 'game' | 'set' | 'type' | 'name'>, m: MarketSnapshot): AltQuote | null {
  const pool = m.altProducts.filter((p) => p.game === item.game);
  if (!pool.length) return null;
  const p = bestMatch(pool, { game: item.game, set: item.set, type: item.type, name: item.name });
  const v = marketPrice(p);
  return p && v != null ? { source: p.source, currency: p.currency, name: p.name, url: productUrl(p), price: v, low: p.low } : null;
}
