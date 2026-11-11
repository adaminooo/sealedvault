// Denní data pro appku (běží v GitHub Actions, appka pak čte jen statické soubory).
//
//   node scripts/build-data.mjs [--out dist/data] [--no-record]
//
// Vstupy v repozitáři (data-src/):
//   own/YYYY-MM-DD.json   vlastní denní záznam cen { eur, usd, p: { id: cena v centech } }  ← skript přidává denně
//   tcg-history/          starší historie z archivu TCGCSV (scripts/backfill-history.mjs): map.json + b-0…63.json
// Výstup (--out):
//   prices.json           ceny sealed produktů (Cardmarket / TCGplayer) + kurzy
//   tcg.json              druhý trh pro Pokémon a One Piece (TCGplayer): { id: { t, n, m, l, i } }
//   rates.json            kurzy ČNB { datum: [EUR, USD] }
//   h/0…63.json           historie cen { s: { id: [[datum, cena]] }, e: { id: poslední den z archivu } }
//   h/meta.json           { ownSince, start, buckets }
//   sets-pokemon.json, sets-onepiece.json   katalogy edic

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findTcgProduct, getPriceSnapshot, tcgGroupPricesFor, TCG_ID_OFFSET } from '../server/cardmarket.mjs';
import { getOnePieceSets, getPokemonSets } from '../server/sets.mjs';
import { pragueDate, ratesSince } from '../server/history.mjs';

const args = process.argv.slice(2);
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'dist/data';
const RECORD = !args.includes('--no-record');
const SRC = 'data-src';
const OWN = join(SRC, 'own');
const TCG = join(SRC, 'tcg-history');
const BUCKETS = 64;
const START = '2024-02-08';
/** Předchozí zveřejněná data (záloha, když zdroj zrovna nejde) */
const REMOTE = process.env.DATA_REMOTE ?? '';
const NON_ENGLISH =
  /\b(JP|Japanese|Chinese|Simplified|Traditional|Korean|Thai|Indonesian|Taiwan|French|German|Italian|Spanish|Portuguese|Polish|Dutch)\b|Non-English|Asia Region/;

const write = (file, data) => {
  const p = join(OUT, file);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, JSON.stringify(data));
};
const readJson = (p, fallback) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
};
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

mkdirSync(OUT, { recursive: true });
mkdirSync(OWN, { recursive: true });

// ---------- 1) Ceny ----------
const snap = await getPriceSnapshot(true);
write('prices.json', snap);
log('ceny', snap.games.map((g) => `${g.game}: ${g.products.length}`).join(', '));

// ---------- 2) Dnešní záznam (jednou denně) ----------
const today = pragueDate();
const ownFile = join(OWN, `${today}.json`);
if (RECORD && !existsSync(ownFile)) {
  const p = {};
  for (const g of snap.games) {
    for (const x of g.products) {
      const v = x[3] ?? x[4] ?? x[5];
      if (v != null && !NON_ENGLISH.test(`${x[1]} ${x[2]}`)) p[x[0]] = Math.round(v * 100);
    }
  }
  writeFileSync(ownFile, JSON.stringify({ eur: snap.eurCzk, usd: snap.usdCzk, p }));
  log('záznam dne', today, Object.keys(p).length, 'cen');
}

// ---------- 3) Kurzy ČNB ----------
const rates = await ratesSince(START.slice(0, 4) + '-01-01');
write('rates.json', rates);
const rateKeys = Object.keys(rates).sort();
const rateAt = (date) => {
  let lo = 0;
  let hi = rateKeys.length - 1;
  let hit = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rateKeys[mid] <= date) {
      hit = rateKeys[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return hit ? rates[hit] : null;
};

// ---------- 4) Druhý trh (TCGplayer) pro Pokémon a One Piece + obrázky ----------
const tcg = {};
for (const g of snap.games.filter((x) => x.source === 'cardmarket')) {
  const list = g.products.filter((p) => (p[3] ?? p[4] ?? p[5]) != null && !NON_ENGLISH.test(`${p[1]} ${p[2]}`));
  for (const p of list) {
    const t = await findTcgProduct(g.game, p[1]).catch(() => null);
    if (!t) continue;
    tcg[p[0]] = { t: t.id, g: t.groupId, n: t.rawName, i: t.image ?? undefined, a: t.ambiguous ? 1 : undefined, game: g.game };
  }
  log('párování', g.game, Object.values(tcg).filter((x) => x.game === g.game).length, 'z', list.length);
}
// ceny jen u jednoznačných shod
for (const [id, x] of Object.entries(tcg)) {
  if (!x.a) {
    const pr = await tcgGroupPricesFor(x.game, x.g).catch(() => null);
    const q = pr?.get(x.t);
    if (q) {
      x.m = q.market ?? undefined;
      x.l = q.low ?? undefined;
    }
  }
  delete x.g;
  delete x.game;
  tcg[id] = x;
}
write('tcg.json', tcg);

// ---------- 5) Historie cen ----------
/** vlastní denní záznam */
const own = new Map(); // id → [[date, price]]
const ownDays = existsSync(OWN) ? readdirSync(OWN).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort() : [];
for (const f of ownDays) {
  const date = f.slice(0, 10);
  const day = readJson(join(OWN, f), null);
  if (!day) continue;
  for (const [id, cents] of Object.entries(day.p)) {
    const n = Number(id);
    (own.get(n) ?? own.set(n, []).get(n)).push([date, cents / 100]);
  }
}
const ownSince = ownDays[0]?.slice(0, 10) ?? null;

/** starší historie z archivu TCGplayeru (USD) → měna produktu, srovnaná na úroveň vlastního záznamu */
const map = readJson(join(TCG, 'map.json'), { map: {} }).map ?? {};
const tcgBuckets = new Map();
const tcgSeries = (t) => {
  const b = t % BUCKETS;
  if (!tcgBuckets.has(b)) tcgBuckets.set(b, readJson(join(TCG, `b-${b}.json`), {}));
  return tcgBuckets.get(b)[t] ?? null;
};

const out = Array.from({ length: BUCKETS }, () => ({ s: {}, e: {} }));
const ids = new Set([...own.keys(), ...Object.keys(map).map(Number)]);
for (const id of ids) {
  const mine = own.get(id) ?? [];
  let series = mine;
  const t = map[id];
  const pts = t != null ? tcgSeries(t) : null;
  if (pts?.length) {
    const usd = id >= TCG_ID_OFFSET;
    const conv = (date, cents) => {
      const v = cents / 100;
      if (usd) return v;
      const r = rateAt(date);
      return r && r[1] ? (v * r[1]) / r[0] : null;
    };
    const ownFirst = mine[0]?.[0] ?? '9999';
    let anchor = 1;
    if (mine.length) {
      const near = [...pts].reverse().find(([d]) => d <= ownFirst);
      const nearV = near && conv(near[0], near[1]);
      const gap = near ? (Date.parse(ownFirst) - Date.parse(near[0])) / 864e5 : Infinity;
      if (nearV && gap <= 21) anchor = Math.min(2.5, Math.max(0.4, mine[0][1] / nearV));
    }
    const back = [];
    for (const [d, cents] of pts) {
      if (d < START || d >= ownFirst) continue;
      const v = conv(d, cents);
      if (v != null) back.push([d, Math.round(v * anchor * 100) / 100]);
    }
    if (back.length) {
      series = [...back, ...mine];
      out[id % BUCKETS].e[id] = back.at(-1)[0];
    }
  }
  if (series.length) out[id % BUCKETS].s[id] = series;
}
out.forEach((b, i) => write(`h/${i}.json`, b));
write('h/meta.json', { ownSince, start: START, buckets: BUCKETS, updated: new Date().toISOString() });
log('historie', ids.size, 'produktů, vlastní záznam od', ownSince);

// ---------- 6) Katalogy edic ----------
let pokemonSets = await getPokemonSets().catch(() => []);
if (!pokemonSets.some((s) => s.logo) && REMOTE) {
  // pokemontcg.io nejde → ponech poslední verzi s logy
  const prev = await fetch(`${REMOTE}/sets-pokemon.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (prev?.sets?.some((s) => s.logo)) pokemonSets = prev.sets;
}
write('sets-pokemon.json', { sets: pokemonSets });
write('sets-onepiece.json', { sets: await getOnePieceSets().catch(() => []) });
log('hotovo →', OUT);
