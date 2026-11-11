// Denní historie cen sealed produktů (Netlify Blobs) + historické kurzy ČNB.
//
// Úložiště „price-history“, jeden blob na měsíc: m/YYYY-MM →
//   { ids: [idProduct…], days: { 'YYYY-MM-DD': { eur, usd, p: [cena v centech | null, … zarovnané s ids] } } }
// Ceny jsou v měně zdroje (Cardmarket EUR, TCGplayer USD – id ≥ 1e9).
// Zápis dělá naplánovaná funkce (denně) a pro jistotu i /api/prices při čerstvém stažení ceníku.

import { getStore } from '@netlify/blobs';

const STORE = 'price-history';
const store = () => getStore({ name: STORE, consistency: 'strong' });

/** Dnešní datum v Praze (YYYY-MM-DD) */
export function pragueDate(d = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(d);
}

/** Uloží dnešní ceny ze snapshotu (getPriceSnapshot); vrací true, když se zapisovalo */
export async function recordDay(snapshot) {
  const date = pragueDate();
  const key = `m/${date.slice(0, 7)}`;
  const s = store();
  const month = (await s.get(key, { type: 'json' })) ?? { ids: [], days: {} };
  if (month.days[date]) return false;

  const index = new Map(month.ids.map((id, i) => [id, i]));
  const prices = [];
  for (const g of snapshot.games) {
    for (const p of g.products) {
      const price = p[3] ?? p[4] ?? p[5];
      if (price == null) continue;
      let i = index.get(p[0]);
      if (i === undefined) {
        i = month.ids.length;
        month.ids.push(p[0]);
        index.set(p[0], i);
      }
      prices[i] = Math.round(price * 100);
    }
  }
  month.days[date] = { eur: snapshot.eurCzk, usd: snapshot.usdCzk, p: Array.from(prices, (v) => v ?? null) };
  await s.setJSON(key, month);
  return true;
}

function monthsBetween(from, to) {
  const out = [];
  let [y, m] = from.slice(0, 7).split('-').map(Number);
  const [ty, tm] = to.slice(0, 7).split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

// ---------- Kurzy ČNB (roční soubory) ----------

const ratesCache = new Map(); // rok → { at, rates }

async function cnbYear(year) {
  const c = ratesCache.get(year);
  const current = year === new Date().getFullYear();
  if (c && (!current || Date.now() - c.at < 6 * 3600e3)) return c.rates;
  const url = `https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/rok.txt?rok=${year}`;
  const res = await fetch(url);
  const rates = {};
  if (res.ok) {
    let cols = null;
    for (const line of (await res.text()).split('\n')) {
      const parts = line.trim().split('|');
      if (parts[0] === 'Datum') {
        cols = { eur: parts.indexOf('1 EUR'), usd: parts.indexOf('1 USD') };
        continue;
      }
      if (!cols || parts.length < 3) continue;
      const [d, m, y] = parts[0].split('.');
      const num = (i) => (i > 0 ? Number(parts[i]?.replace(',', '.')) : NaN);
      const eur = num(cols.eur);
      const usd = num(cols.usd);
      if (y && Number.isFinite(eur)) rates[`${y}-${m}-${d}`] = [eur, Number.isFinite(usd) ? usd : null];
    }
  }
  ratesCache.set(year, { at: Date.now(), rates });
  return rates;
}

export async function ratesSince(from) {
  const years = [];
  for (let y = Number(from.slice(0, 4)); y <= new Date().getFullYear(); y++) years.push(y);
  const all = await Promise.all(years.map(cnbYear));
  return Object.assign({}, ...all);
}

// ---------- Starší historie z archivu TCGplayeru (scripts/backfill-history.mjs) ----------

const BUCKETS = 64;
let tcgMapCache = null; // { at, data: { until, from, map } }

async function tcgMap(s) {
  if (tcgMapCache && Date.now() - tcgMapCache.at < 6 * 3600e3) return tcgMapCache.data;
  const data = (await s.get('t/map', { type: 'json' }).catch(() => null)) ?? { map: {} };
  tcgMapCache = { at: Date.now(), data };
  return data;
}

/** Vyhledání kurzu k datu (poslední známý den ≤ datum – víkendy a svátky) */
function rateLookup(rates) {
  const keys = Object.keys(rates).sort();
  return (date) => {
    let lo = 0;
    let hi = keys.length - 1;
    let hit = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (keys[mid] <= date) {
        hit = keys[mid];
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return hit ? rates[hit] : null;
  };
}

/**
 * Doplní řady o ceny z TCGplayeru před začátkem vlastního záznamu.
 * U Cardmarket produktů (EUR) se USD přepočte kurzem ČNB daného dne a srovná na úroveň Cardmarketu
 * poměrem cen v den, kdy začal vlastní záznam (aby graf neskočil). Vrací { id: datum konce odhadu }.
 */
async function mergeTcgHistory(s, ids, start, today, series, rates) {
  const { map = {}, until } = await tcgMap(s);
  const todo = ids.map((id) => [id, map[id]]).filter(([, t]) => t != null);
  if (!todo.length) return {};
  const bucketIds = [...new Set(todo.map(([, t]) => t % BUCKETS))];
  const buckets = new Map(
    await Promise.all(bucketIds.map(async (b) => [b, (await s.get(`t/b/${b}`, { type: 'json' }).catch(() => null)) ?? {}])),
  );
  const rateAt = rateLookup(rates);
  const estimated = {};
  for (const [id, t] of todo) {
    const pts = buckets.get(t % BUCKETS)?.[t];
    if (!pts?.length) continue;
    const own = series[id];
    const ownFirst = own[0]?.[0] ?? today;
    const usd = id >= 1e9; // Riftbound je přímo z TCGplayeru (USD)
    // USD → měna řady
    const conv = (date, cents) => {
      const v = cents / 100;
      if (usd) return v;
      const r = rateAt(date);
      return r && r[1] ? (v * r[1]) / r[0] : null;
    };
    // srovnání úrovně: poslední cena TCGplayeru do 21 dní před začátkem vlastního záznamu
    let anchor = 1;
    if (own.length) {
      const near = [...pts].reverse().find(([d]) => d <= ownFirst);
      const nearV = near && conv(near[0], near[1]);
      const gap = near ? (Date.parse(ownFirst) - Date.parse(near[0])) / 864e5 : Infinity;
      if (nearV && gap <= 21) anchor = Math.min(2.5, Math.max(0.4, own[0][1] / nearV));
    }
    const back = [];
    for (const [d, cents] of pts) {
      if (d < start || d >= ownFirst) continue;
      const v = conv(d, cents);
      if (v != null) back.push([d, Math.round(v * anchor * 100) / 100]);
    }
    if (back.length) {
      series[id] = [...back, ...own];
      estimated[id] = back.at(-1)[0];
    }
  }
  return { estimated, until };
}

/**
 * Historie pro zadané produkty od data `from`.
 * Vrací { recordedSince, series: { id: [[date, price], …] }, rates: { date: [eur, usd] },
 *         estimated: { id: poslední den doplněný z TCGplayeru }, ownSince: začátek vlastního záznamu }
 */
export async function getHistory(ids, from) {
  const today = pragueDate();
  const start = from && from < today ? from : today;
  const wanted = new Set(ids);
  const series = Object.fromEntries(ids.map((id) => [id, []]));
  let recordedSince = null;

  const s = store();
  const months = await Promise.all(
    monthsBetween(start, today).map((m) => s.get(`m/${m}`, { type: 'json' }).catch(() => null)),
  );
  for (const month of months) {
    if (!month) continue;
    const pos = month.ids.map((id, i) => (wanted.has(id) ? [id, i] : null)).filter(Boolean);
    for (const date of Object.keys(month.days).sort()) {
      if (date < start) continue;
      recordedSince ??= date;
      const p = month.days[date].p;
      for (const [id, i] of pos) {
        const v = p[i];
        if (v != null) series[id].push([date, v / 100]);
      }
    }
  }
  const rates = await ratesSince(start).catch(() => ({}));
  const ownSince = recordedSince;
  const { estimated = {} } = await mergeTcgHistory(s, ids, start, today, series, rates).catch(() => ({}));
  for (const pts of Object.values(series)) if (pts[0] && (!recordedSince || pts[0][0] < recordedSince)) recordedSince = pts[0][0];
  return { recordedSince, ownSince, series, rates, estimated };
}
