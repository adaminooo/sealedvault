import type { Currency } from '../types';
import type { Position } from './portfolio';
import { PUBLIC_URL } from '../config';

export interface ShareOptions {
  title: string;
  values: boolean;
  profit: boolean;
  quantities: boolean;
}

export interface SharedPortfolio {
  title: string;
  currency: Currency;
  eurCzk: number | null;
  options: { values: boolean; profit: boolean; quantities: boolean };
  totals: { value: number | null; profitPct: number | null; positions: number | null; pieces: number | null };
  items: { name: string; game: string; set: string; type: string; image: string | null; quantity: number | null; value: number | null; profitPct: number | null }[];
  updatedAt?: string;
}

/**
 * Sdílení bez serveru: snímek portfolia je zabalený (zkomprimovaný) přímo v odkazu za „#s=“.
 * Odkaz ukazuje stav z okamžiku vytvoření; data z něj nikde neukládáme.
 */
const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const PUBLIC_BASE = isLocal ? PUBLIC_URL : `${location.origin}${import.meta.env.BASE_URL}`;

/** Sestaví veřejný snímek – jen držené pozice, bez nákupních cen, poznámek a vlastních fotek */
export function buildPayload(positions: Position[], o: ShareOptions, currency: Currency, eurCzk: number | null): SharedPortfolio {
  const held = positions.filter((p) => p.stats.held > 0).sort((a, b) => b.stats.value - a.stats.value);
  const value = held.reduce((a, p) => a + p.stats.value, 0);
  const cost = held.reduce((a, p) => a + p.stats.cost, 0);
  const r = (n: number) => Math.round(n);
  return {
    title: o.title.trim().slice(0, 80) || 'Moje sbírka',
    currency,
    eurCzk,
    options: { values: o.values, profit: o.profit, quantities: o.quantities },
    totals: {
      value: o.values ? r(value) : null,
      profitPct: o.profit && cost > 0 ? Math.round(((value - cost) / cost) * 1000) / 10 : null,
      positions: held.length,
      pieces: o.quantities ? held.reduce((a, p) => a + p.stats.held, 0) : null,
    },
    items: held.slice(0, 200).map((p) => ({
      name: p.name,
      game: p.game,
      set: p.head.set,
      type: p.head.type,
      // jen veřejné obrázky produktů (ne vlastní fotky)
      image: p.head.productImage ?? null,
      quantity: o.quantities ? p.stats.held : null,
      value: o.values ? r(p.stats.value) : null,
      profitPct: o.profit && p.stats.profitPct != null ? Math.round(p.stats.profitPct * 10) / 10 : null,
    })),
    updatedAt: new Date().toISOString(),
  };
}

// ---------- kódování do odkazu ----------
const TCG_IMG = /^https:\/\/tcgplayer-cdn\.tcgplayer\.com\/product\/(\d+)_\d+w\.jpg$/;

function toB64Url(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(s: string) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** Vytvoří odkaz se zabaleným snímkem portfolia */
export async function createShareLink(payload: SharedPortfolio): Promise<string> {
  // obrázky z TCGplayeru zkrátit na id (odkaz je kratší)
  const slim = { ...payload, items: payload.items.map((i) => ({ ...i, image: i.image?.replace(TCG_IMG, 't:$1') ?? null })) };
  const json = new TextEncoder().encode(JSON.stringify(slim));
  const packed = await pipe(json, new CompressionStream('deflate-raw'));
  return `${PUBLIC_BASE}#s=${toB64Url(packed)}`;
}

/** Přečte snímek z části odkazu za „#s=“ */
export async function readShare(code: string): Promise<SharedPortfolio> {
  const json = await pipe(fromB64Url(code), new DecompressionStream('deflate-raw'));
  const data = JSON.parse(new TextDecoder().decode(json)) as SharedPortfolio;
  data.items = (data.items ?? []).map((i) => ({
    ...i,
    image: i.image?.startsWith('t:') ? `https://tcgplayer-cdn.tcgplayer.com/product/${i.image.slice(2)}_400w.jpg` : i.image && /^https:\/\//.test(i.image) ? i.image : null,
  }));
  return data;
}
