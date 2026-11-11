// Doplnění historie cen sealed produktů z archivu TCGCSV (denní ceny TCGplayeru od 8. 2. 2024).
//
// Spuštění:  node scripts/backfill-history.mjs [od=2025-01-01]
// Výstup:    .backfill/out/*.json → nahraje se do Netlify Blobs (úložiště „price-history“):
//   t/map        { [id v appce]: tcgProductId }   (Cardmarket id, nebo TCG id + 1e9 u Riftboundu)
//   t/b/<0-63>   { [tcgProductId]: [[datum, cena v USD centech], …] }   (koš = tcgId % 64)
//
// Archiv: https://tcgcsv.com/archive/tcgplayer/prices-YYYY-MM-DD.ppmd.7z (TCGCSV FAQ: použití bez omezení)

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sevenBin from '7zip-bin';
import { findTcgProduct, getPriceSnapshot, TCG_ID_OFFSET } from '../server/cardmarket.mjs';

const FROM = process.argv[2] ?? '2025-01-01';
const WORK = join(process.cwd(), '.backfill');
const OUT = join(WORK, 'out');
const BUCKETS = 64;
const CATEGORIES = [3, 68, 89]; // Pokémon, One Piece, Riftbound
const UA = { 'User-Agent': 'SealedPortfolio/1.0 (personal sealed TCG portfolio tracker)' };
const NON_ENGLISH =
  /\b(JP|Japanese|Chinese|Simplified|Traditional|Korean|Thai|Indonesian|Taiwan|French|German|Italian|Spanish|Portuguese|Polish|Dutch)\b|Non-English|Asia Region/;

mkdirSync(OUT, { recursive: true });

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => {
  const d = new Date(s + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

// ---------- 1) Párování produktů appky na TCGplayer ----------
async function buildMap() {
  const cached = join(WORK, 'map.json');
  if (existsSync(cached)) return JSON.parse(readFileSync(cached, 'utf8'));
  const snap = await getPriceSnapshot(true);
  const map = {};
  for (const g of snap.games) {
    if (g.source === 'tcgplayer') {
      for (const p of g.products) map[p[0]] = p[0] - TCG_ID_OFFSET;
      console.log(`${g.game}: ${g.products.length} produktů (přímo TCGplayer)`);
      continue;
    }
    const list = g.products.filter((p) => (p[3] ?? p[4] ?? p[5]) != null && !NON_ENGLISH.test(`${p[1]} ${p[2]}`));
    let ok = 0;
    for (const [i, p] of list.entries()) {
      const t = await findTcgProduct(g.game, p[1]).catch(() => null);
      if (t && !t.ambiguous) {
        map[p[0]] = t.id;
        ok++;
      }
      if (i % 200 === 0) console.log(`${g.game}: ${i}/${list.length} (spárováno ${ok})`);
    }
    console.log(`${g.game}: spárováno ${ok} z ${list.length}`);
  }
  writeFileSync(cached, JSON.stringify(map));
  return map;
}

// ---------- 2) Které dny stáhnout ----------
// volitelně jen úsek do data (bez husté části), např. doplnění starších týdnů
const UNTIL = process.argv[3];

function dates(lastAvailable) {
  const out = [];
  if (UNTIL) {
    for (let d = FROM; d < UNTIL; d = addDays(d, 7)) out.push(d);
    return out;
  }
  const dense = addDays(lastAvailable, -30);
  for (let d = FROM; d < dense; d = addDays(d, 7)) out.push(d); // týdně
  for (let d = dense; d <= lastAvailable; d = addDays(d, 2)) out.push(d); // posledni měsíc ob den
  if (out.at(-1) !== lastAvailable) out.push(lastAvailable);
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Stáhne archiv dne; při 429 (moc požadavků) počká a zkusí znovu */
async function download(date) {
  const file = join(WORK, `${date}.7z`);
  if (existsSync(file)) return file;
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(`https://tcgcsv.com/archive/tcgplayer/prices-${date}.ppmd.7z`, { headers: UA });
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 30000 * (attempt + 1);
      console.log(`${date}: 429, čekám ${Math.round(wait / 1000)} s`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) return null;
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    await sleep(4000); // šetrně k TCGCSV
    return file;
  }
  return null;
}

/** Ceny jednoho dne pro hledané produkty → Map(tcgId → cena v centech) */
function readDay(archive, date, wanted) {
  const dir = join(WORK, 'x');
  rmSync(dir, { recursive: true, force: true });
  execFileSync(sevenBin.path7za, ['x', archive, `-o${dir}`, '-y', ...CATEGORIES.map((c) => `${date}/${c}/*`), '-r'], { stdio: 'ignore' });
  const prices = new Map();
  for (const c of CATEGORIES) {
    const base = join(dir, date, String(c));
    if (!existsSync(base)) continue;
    for (const g of readdirSync(base)) {
      const f = join(base, g, 'prices');
      if (!existsSync(f)) continue;
      let rows;
      try {
        rows = JSON.parse(readFileSync(f, 'utf8')).results ?? [];
      } catch {
        continue;
      }
      for (const r of rows) {
        if (!wanted.has(r.productId)) continue;
        const v = r.marketPrice ?? r.midPrice ?? r.lowPrice;
        if (v == null) continue;
        // u sealed je „Normal“ – ten má přednost
        if (prices.has(r.productId) && r.subTypeName !== 'Normal') continue;
        prices.set(r.productId, Math.round(v * 100));
      }
    }
  }
  rmSync(dir, { recursive: true, force: true });
  return prices;
}

// ---------- hlavní běh ----------
const map = await buildMap();
const wanted = new Set(Object.values(map));
console.log(`Produktů k doplnění: ${wanted.size}`);

// poslední dostupný archiv (dnes nebo včera)
let last = iso(new Date());
for (let i = 0; i < 4; i++) {
  const r = await fetch(`https://tcgcsv.com/archive/tcgplayer/prices-${last}.ppmd.7z`, { method: 'HEAD', headers: UA });
  if (r.status === 429) {
    console.log('429 – čekám minutu');
    await sleep(60000);
    i--;
    continue;
  }
  if (r.ok) break;
  last = addDays(last, -1);
}

const series = new Map(); // tcgId → [[date, cents]]
// navázání na předchozí běh: načti hotové koše a přeskoč dny, které už v nich jsou
const done = new Set();
for (let b = 0; b < BUCKETS; b++) {
  const f = join(OUT, `b-${b}.json`);
  if (!existsSync(f)) continue;
  for (const [id, pts] of Object.entries(JSON.parse(readFileSync(f, 'utf8')))) {
    series.set(Number(id), pts);
    for (const [d] of pts) done.add(d);
  }
}
const list = dates(last);
console.log(`Dnů ke stažení: ${list.length} (${list[0]} … ${list.at(-1)}), hotovo dříve: ${done.size}`);
for (const [i, date] of list.entries()) {
  if (done.has(date)) continue;
  const archive = await download(date);
  if (!archive) {
    console.log(`${date}: archiv chybí`);
    continue;
  }
  const day = readDay(archive, date, wanted);
  for (const [id, cents] of day) (series.get(id) ?? series.set(id, []).get(id)).push([date, cents]);
  rmSync(archive, { force: true });
  // průběžně uložit, ať jde při přerušení navázat
  if (i % 5 === 0) writeBuckets();
  console.log(`${i + 1}/${list.length} ${date}: ${day.size} cen`);
}

// ---------- 3) Zápis košů ----------
function writeBuckets() {
  const buckets = Array.from({ length: BUCKETS }, () => ({}));
  for (const [id, pts] of series) buckets[id % BUCKETS][id] = [...pts].sort((a, b) => a[0].localeCompare(b[0]));
  buckets.forEach((b, i) => writeFileSync(join(OUT, `b-${i}.json`), JSON.stringify(b)));
}
writeBuckets();
// do mapy jen produkty, ke kterým historie opravdu je
const usedMap = Object.fromEntries(Object.entries(map).filter(([, t]) => series.has(t)));
writeFileSync(join(OUT, 'map.json'), JSON.stringify({ until: last, from: list[0], map: usedMap }));
console.log(`Hotovo: ${series.size} produktů s historií, mapa ${Object.keys(usedMap).length} položek → ${OUT}`);
