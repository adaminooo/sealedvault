import type { Game } from '../types';
import { getData } from './data';

export interface SetInfo {
  id: string;
  name: string;
  game: Game;
  series?: string;
  /** YYYY-MM-DD */
  releaseDate?: string;
  logo?: string;
}

/** Riftbound nemá veřejné API – seznam edic je zabudovaný (doplň při nové edici) */
export const RIFTBOUND_SETS: SetInfo[] = [
  { id: 'rb-legacy', name: 'Legacy', game: 'Riftbound', releaseDate: '2026-11' },
  { id: 'rb-radiance', name: 'Radiance', game: 'Riftbound', releaseDate: '2026-10-23' },
  { id: 'rb-vendetta', name: 'Vendetta', game: 'Riftbound', releaseDate: '2026-07-31' },
  { id: 'rb-unleashed', name: 'Unleashed', game: 'Riftbound', releaseDate: '2026-05-08' },
  { id: 'rb-spiritforged', name: 'Spiritforged', game: 'Riftbound', releaseDate: '2026-02-13' },
  { id: 'rb-proving-grounds', name: 'Proving Grounds', game: 'Riftbound', releaseDate: '2025-10-31' },
  { id: 'rb-origins', name: 'Origins', game: 'Riftbound', releaseDate: '2025-10-31' },
];

/** Záloha pro první spuštění bez internetu – po načtení z API se nahradí úplným seznamem s logy */
const POKEMON_FALLBACK: SetInfo[] = [
  'Delta Reign', '30th Celebration', 'Pitch Black', 'Chaos Rising', 'Perfect Order', 'Ascended Heroes',
  'Phantasmal Flames', 'Mega Evolution', 'Black Bolt', 'White Flare', 'Destined Rivals', 'Journey Together',
  'Prismatic Evolutions', 'Surging Sparks', 'Stellar Crown', 'Shrouded Fable', 'Twilight Masquerade',
  'Temporal Forces', 'Paldean Fates', 'Paradox Rift', '151', 'Obsidian Flames', 'Paldea Evolved', 'Scarlet & Violet',
  'Crown Zenith', 'Silver Tempest', 'Lost Origin', 'Pokémon GO', 'Astral Radiance', 'Brilliant Stars', 'Fusion Strike',
  'Celebrations', 'Evolving Skies', 'Chilling Reign', 'Battle Styles', 'Shining Fates', 'Vivid Voltage', 'Champion\'s Path',
].map((name) => ({ id: `pk-${name}`, name, game: 'Pokémon' as const }));

const API = 'https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=250&select=id,name,series,releaseDate,images';
const CACHE_KEY = 'tcg-portfolio:pokemon-sets';
const MAX_AGE = 3 * 24 * 60 * 60 * 1000;

interface ApiSet {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
  images?: { logo?: string; symbol?: string };
}

function readCache(): { at: number; sets: SetInfo[] } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---------- One Piece (katalog z našeho serveru, odvozený z TCGplayeru) ----------

const OP_CACHE_KEY = 'tcg-portfolio:onepiece-sets';
/** Záloha bez internetu – hlavní anglické edice */
const ONE_PIECE_FALLBACK: SetInfo[] = [
  'The Dominance of God', "The World's Strongest Warriors", 'Carrying on His Will', 'Emperors in the New World',
  'Two Legends', 'Royal Blood', 'Legacy of the Master', 'Wings of the Captain', 'Awakening of the New Era',
  'Kingdoms of Intrigue', 'Pillars of Strength', 'Paramount War', 'Romance Dawn', 'Memorial Collection',
].map((name) => ({ id: `op-${name}`, name, game: 'One Piece' as const }));

export function cachedOnePieceSets(): SetInfo[] {
  try {
    const raw = localStorage.getItem(OP_CACHE_KEY);
    return raw ? JSON.parse(raw).sets : ONE_PIECE_FALLBACK;
  } catch {
    return ONE_PIECE_FALLBACK;
  }
}

export async function loadOnePieceSets(): Promise<SetInfo[]> {
  try {
    const raw = localStorage.getItem(OP_CACHE_KEY);
    const c = raw ? JSON.parse(raw) : null;
    if (c && Date.now() - c.at < MAX_AGE) return c.sets;
  } catch {
    /* nevadí */
  }
  try {
    const sets = (await getData<{ sets: SetInfo[] }>('sets-onepiece.json')).sets;
    if (!sets?.length) throw new Error('empty');
    try {
      localStorage.setItem(OP_CACHE_KEY, JSON.stringify({ at: Date.now(), sets }));
    } catch {
      /* nevadí */
    }
    return sets;
  } catch {
    return cachedOnePieceSets();
  }
}

export function cachedPokemonSets(): SetInfo[] {
  return readCache()?.sets ?? POKEMON_FALLBACK;
}

/** Stáhne seznam Pokémon edic (s logy); výsledek drží v localStorage pár dní */
export async function loadPokemonSets(): Promise<SetInfo[]> {
  const cache = readCache();
  if (cache && Date.now() - cache.at < MAX_AGE) return cache.sets;
  try {
    let sets: SetInfo[];
    try {
      // denní data – zvládnou výpadek pokemontcg.io (poslední verze / záloha z TCGplayeru)
      sets = (await getData<{ sets: SetInfo[] }>('sets-pokemon.json')).sets;
      if (!sets?.length) throw new Error('empty');
    } catch {
      const res = await fetch(API);
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { data: ApiSet[] };
      sets = json.data.map((s) => ({
        id: s.id,
        name: s.name,
        game: 'Pokémon' as const,
        series: s.series,
        releaseDate: s.releaseDate?.replace(/\//g, '-'),
        logo: s.images?.logo,
      }));
    }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), sets }));
    } catch {
      /* plné úložiště – nevadí */
    }
    return sets;
  } catch {
    return cache?.sets ?? POKEMON_FALLBACK;
  }
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function searchSets(sets: SetInfo[], query: string, limit = 8): SetInfo[] {
  const q = norm(query.trim());
  if (!q) return sets.slice(0, limit);
  const starts: SetInfo[] = [];
  const contains: SetInfo[] = [];
  for (const s of sets) {
    const n = norm(s.name);
    if (n.startsWith(q)) starts.push(s);
    else if (n.includes(q) || norm(s.series ?? '').includes(q) || s.id.toLowerCase() === q) contains.push(s);
  }
  return [...starts, ...contains].slice(0, limit);
}
