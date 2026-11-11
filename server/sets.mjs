// Katalog Pokémon edic (název, série, datum, logo) pro appku.
// 1) pokemontcg.io (má loga) → uloží se do Netlify Blobs jako poslední funkční verze
// 2) při výpadku: poslední uložená verze
// 3) jinak: odvození ze seznamu edic TCGplayeru (tcgcsv.com) – bez log, ale se sériemi

import { getStore } from '@netlify/blobs';

const API = 'https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=250&select=id,name,series,releaseDate,images';
const HEADERS = { 'User-Agent': 'SealedPortfolio/1.0 (personal sealed TCG portfolio tracker)' };

// prefix kódu edice na TCGplayeru → série
const SERIES = [
  [/^ME\d*|^ME:/i, 'Mega Evolution'],
  [/^SV\d*|^SV:|^SVP/i, 'Scarlet & Violet'],
  [/^SWSH|^SWSH:/i, 'Sword & Shield'],
  [/^SM\d*|^SM /i, 'Sun & Moon'],
  [/^XY/i, 'XY'],
  [/^BW/i, 'Black & White'],
];

let mem = null; // { at, sets }

const blobs = () => {
  try {
    return getStore({ name: 'catalog', consistency: 'eventual' });
  } catch {
    return null; // lokálně bez Netlify
  }
};

async function fromPokemonTcg() {
  const res = await fetch(API, { headers: HEADERS });
  if (!res.ok) throw new Error(`pokemontcg ${res.status}`);
  const json = await res.json();
  return json.data.map((s) => ({
    id: s.id,
    name: s.name,
    game: 'Pokémon',
    series: s.series,
    releaseDate: s.releaseDate?.replace(/\//g, '-'),
    logo: s.images?.logo,
  }));
}

async function fromTcgplayer() {
  const res = await fetch('https://tcgcsv.com/tcgplayer/3/groups', { headers: HEADERS });
  if (!res.ok) throw new Error(`tcgcsv ${res.status}`);
  const { results } = await res.json();
  return results
    .filter((g) => !/promo|trainer kit|mcdonald|prize pack|energies|deck|code card|world championship/i.test(g.name))
    .map((g) => {
      const [code, ...rest] = g.name.split(':');
      const name = (rest.length ? rest.join(':') : g.name).trim();
      const series = SERIES.find(([re]) => re.test(code.trim()) || re.test(g.abbreviation ?? ''))?.[1];
      return { id: `tcg-${g.groupId}`, name, game: 'Pokémon', series, releaseDate: g.publishedOn?.slice(0, 10) };
    })
    // „Scarlet & Violet 151“ se v appce i na Cardmarketu jmenuje jen „151“
    .flatMap((s) => (/^Scarlet & Violet 151$/i.test(s.name) ? [s, { ...s, id: `${s.id}-151`, name: '151' }] : [s]));
}

// ---------- One Piece (z TCGplayeru) ----------

const OP_SERIES = [
  [/^OP-?\d/i, 'Booster'],
  [/^EB-?\d/i, 'Extra Booster'],
  [/^PRB-?\d/i, 'Premium Booster'],
  [/^ST-?\d/i, 'Starter Deck'],
];
let opMem = null;

/** Edice One Piece: „OP18 The Dominance of God“, „EB05 Heroines Edition Vol. 2“… */
export async function getOnePieceSets() {
  if (opMem && Date.now() - opMem.at < 12 * 3600e3) return opMem.sets;
  const res = await fetch('https://tcgcsv.com/tcgplayer/68/groups', { headers: HEADERS });
  if (!res.ok) throw new Error(`tcgcsv ${res.status}`);
  const { results } = await res.json();
  const sets = results
    .filter((g) => !/release event|promo|pre-release|tournament|judge|championship|winner|demo|regional|store|treasure cup|\bevent\b/i.test(g.name))
    .map((g) => {
      const code = (g.abbreviation ?? '').trim();
      // „Extra Booster: One Piece Heroines Edition Vol. 2“ → „Heroines Edition Vol. 2“, „ST-31: Starter Deck 31 …“ → beze změny
      let name = g.name.replace(/^Extra Booster:\s*(One Piece\s*)?/i, '').replace(/^Premium Booster[:\s-]*/i, (m) => m).trim();
      name = name.replace(/^ST-\d+:\s*/i, '');
      return {
        id: `op-${g.groupId}`,
        name,
        game: 'One Piece',
        series: OP_SERIES.find(([re]) => re.test(code))?.[1] ?? 'Ostatní',
        code,
        releaseDate: g.publishedOn?.slice(0, 10),
      };
    })
    .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
  opMem = { at: Date.now(), sets };
  return sets;
}

export async function getPokemonSets() {
  if (mem && Date.now() - mem.at < 12 * 3600e3) return mem.sets;
  const store = blobs();
  try {
    const sets = await fromPokemonTcg();
    await store?.setJSON('pokemon-sets', { at: Date.now(), sets }).catch(() => {});
    mem = { at: Date.now(), sets };
    return sets;
  } catch {
    const saved = await store?.get('pokemon-sets', { type: 'json' }).catch(() => null);
    if (saved?.sets?.length) {
      mem = { at: Date.now() - 11 * 3600e3, sets: saved.sets }; // zkusit znovu za hodinu
      return saved.sets;
    }
    const sets = await fromTcgplayer();
    mem = { at: Date.now() - 11 * 3600e3, sets };
    return sets;
  }
}
