// Ceny sealed produktů pro appku:
//  - Pokémon: veřejné denní ceníky Cardmarketu (EUR)
//  - Riftbound: TCGplayer přes tcgcsv.com (USD, jen anglické produkty)
//  - kurzy EUR/CZK a USD/CZK z ČNB
// Používá lokální server (vite.config.ts) i serverless funkce (netlify/, api/).
// Zdroje nemají CORS a ceník Cardmarketu má ~16 MB, proto je stahujeme na serveru
// a do appky posíláme jen sealed produkty (pár set kB).

const CM_BASE = 'https://downloads.s3.cardmarket.com/productCatalog';
const TCG_BASE = 'https://tcgcsv.com/tcgplayer';
const TCG_RIFTBOUND = 89;
/** TCGplayer ID posuneme, aby se nepletla s ID Cardmarketu */
export const TCG_ID_OFFSET = 1_000_000_000;
const CNB_URL =
  'https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt';

const CACHE_MS = 6 * 60 * 60 * 1000;
let cache = null; // { at, data }

// tcgcsv.com odmítá anonymní klienty – stačí obecná identifikace appky
const HEADERS = { 'User-Agent': 'SealedPortfolio/1.0 (personal sealed TCG portfolio tracker)' };

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

async function getRates() {
  try {
    const res = await fetch(CNB_URL);
    if (!res.ok) return {};
    const lines = (await res.text()).split('\n');
    const rate = (code) => {
      const parts = lines.find((l) => l.includes(`|${code}|`))?.split('|');
      const r = Number(parts?.[4]?.replace(',', '.')) / Number(parts?.[2] ?? 1);
      return Number.isFinite(r) ? r : null;
    };
    return { eurCzk: rate('EUR'), usdCzk: rate('USD') };
  } catch {
    return {};
  }
}

const round2 = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : null);

/** Cardmarket: sealed produkty jedné hry; tvar produktu [id, název, kategorie, trend, avg, low] */
async function loadCardmarket(id, game) {
  const [list, guide] = await Promise.all([
    getJson(`${CM_BASE}/productList/products_nonsingles_${id}.json`),
    getJson(`${CM_BASE}/priceGuide/price_guide_${id}.json`),
  ]);
  const prices = new Map(guide.priceGuides.map((p) => [p.idProduct, p]));
  const products = list.products.map((p) => {
    const g = prices.get(p.idProduct);
    return [p.idProduct, p.name, p.categoryName, round2(g?.trend), round2(g?.avg), round2(g?.low)];
  });
  return { game, source: 'cardmarket', currency: 'EUR', priceDate: guide.createdAt, products };
}

const bigImage = (url) => (url ? url.replace(/_200w\.jpg$/, '_400w.jpg') : null);
/** Sealed = bez čísla karty a rarity (karty i kódové karty je mají) */
const isSealedTcg = (p) => !p.extendedData?.some((e) => e.name === 'Number' || e.name === 'Rarity');

/** TCGplayer (tcgcsv.com): sealed produkty; [id, název, edice, market, mid, low, obrázek] */
async function loadTcgplayer(categoryId, game) {
  const [groups, updated] = await Promise.all([
    getJson(`${TCG_BASE}/${categoryId}/groups`),
    fetch('https://tcgcsv.com/last-updated.txt', { headers: HEADERS }).then((r) => (r.ok ? r.text() : '')).catch(() => ''),
  ]);
  const perGroup = await Promise.all(
    groups.results.map(async (g) => {
      const [prods, prices] = await Promise.all([
        getJson(`${TCG_BASE}/${categoryId}/${g.groupId}/products`),
        getJson(`${TCG_BASE}/${categoryId}/${g.groupId}/prices`),
      ]);
      const priceById = new Map();
      for (const p of prices.results) {
        // u sealed je jen „Normal“; kdyby jich bylo víc, vezmi první s cenou
        if (!priceById.has(p.productId) || (p.subTypeName === 'Normal' && p.marketPrice != null)) priceById.set(p.productId, p);
      }
      return prods.results
        .filter(isSealedTcg)
        .map((p) => {
          const pr = priceById.get(p.productId);
          return [
            TCG_ID_OFFSET + p.productId, p.name, g.name,
            round2(pr?.marketPrice), round2(pr?.midPrice), round2(pr?.lowPrice), bigImage(p.imageUrl),
          ];
        });
    }),
  );
  return {
    game,
    source: 'tcgplayer',
    currency: 'USD',
    priceDate: updated.trim() || new Date().toISOString(),
    products: perGroup.flat(),
  };
}

// ---------- Obrázky produktů (TCGplayer) ----------
// Cardmarket obrázky veřejně nedává; TCGplayer má sealed produkty se stejnými názvy.
// Pro Pokémon nestahujeme všech ~220 edic – jen edice, jejichž název je v názvu produktu.

const TCG_CATEGORY = { 'Pokémon': 3, Riftbound: 89, 'One Piece': 68 };
const groupsCache = new Map(); // categoryId → { at, groups }
const groupProducts = new Map(); // groupId → { at, products: [{ name, image }] }

const norm = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function tcgGroups(categoryId) {
  const c = groupsCache.get(categoryId);
  if (c && Date.now() - c.at < 24 * 3600e3) return c.groups;
  const groups = (await getJson(`${TCG_BASE}/${categoryId}/groups`)).results.map((g) => ({
    id: g.groupId,
    // „ME02: Phantasmal Flames“ → „phantasmal flames“, „SV: Scarlet & Violet 151“ → „scarlet violet 151“
    key: norm(g.name.includes(':') ? g.name.split(':').slice(1).join(':') : g.name),
  }));
  groupsCache.set(categoryId, { at: Date.now(), groups });
  return groups;
}

async function tcgGroupProducts(categoryId, groupId) {
  const c = groupProducts.get(groupId);
  if (c && Date.now() - c.at < 24 * 3600e3) return c.products;
  const products = (await getJson(`${TCG_BASE}/${categoryId}/${groupId}/products`)).results
    .filter(isSealedTcg)
    .map((p) => ({ id: p.productId, groupId, rawName: p.name, name: norm(p.name), image: bigImage(p.imageUrl), url: p.url }));
  groupProducts.set(groupId, { at: Date.now(), products });
  return products;
}

const groupPrices = new Map(); // groupId → { at, prices: Map(productId → { market, mid, low }) }
async function tcgGroupPrices(categoryId, groupId) {
  const c = groupPrices.get(groupId);
  if (c && Date.now() - c.at < 6 * 3600e3) return c.prices;
  const prices = new Map();
  for (const p of (await getJson(`${TCG_BASE}/${categoryId}/${groupId}/prices`)).results) {
    if (prices.has(p.productId) && p.subTypeName !== 'Normal') continue;
    prices.set(p.productId, { market: round2(p.marketPrice), mid: round2(p.midPrice), low: round2(p.lowPrice) });
  }
  groupPrices.set(groupId, { at: Date.now(), prices });
  return prices;
}

/** Ceny jedné edice TCGplayeru (pro denní build dat) */
export function tcgGroupPricesFor(game, groupId) {
  return tcgGroupPrices(TCG_CATEGORY[game], groupId);
}

/** Podobnost názvů: podíl slov hledaného názvu, která produkt obsahuje (+ bonus za shodu) */
function similarity(wanted, candidate) {
  if (wanted === candidate) return 2;
  const w = wanted.split(' ');
  const c = new Set(candidate.split(' '));
  const hit = w.filter((x) => c.has(x)).length / w.length;
  const extra = [...c].filter((x) => !w.includes(x)).length;
  return hit - extra * 0.04;
}

/** Najde obrázek sealed produktu podle názvu; vrací URL nebo null */
export async function findProductImage(game, name) {
  return (await findTcgProduct(game, name))?.image ?? null;
}

/**
 * Cena stejného produktu na TCGplayeru (druhý trh pro Pokémon a One Piece).
 * Vrací { productId, name, url, market, mid, low } v USD, nebo null.
 */
export async function tcgQuote(game, name) {
  const p = await findTcgProduct(game, name);
  // u nejednoznačné shody cenu nedáváme – mohla by být úplně jiná varianta
  if (!p || p.ambiguous) return null;
  const pr = (await tcgGroupPrices(TCG_CATEGORY[game], p.groupId)).get(p.id);
  if (!pr || (pr.market == null && pr.low == null)) return null;
  return { productId: p.id, name: p.rawName, url: `https://www.tcgplayer.com/product/${p.id}`, image: p.image, ...pr };
}

/** Najde sealed produkt na TCGplayeru podle názvu (edice z názvu → produkty → podobnost) */
export async function findTcgProduct(game, name) {
  const categoryId = TCG_CATEGORY[game];
  if (!categoryId || !name) return null;
  const wanted = norm(name).replace(/\bpokemon center\b/, 'pokemon center');
  const groups = await tcgGroups(categoryId);
  // edice, jejichž název (nebo poslední slovo u „Scarlet & Violet 151“) je v názvu produktu
  const candidates = groups
    .filter((g) => g.key.length >= 3 && (wanted.includes(g.key) || (g.key.split(' ').length > 1 && wanted.startsWith(g.key.split(' ').at(-1) + ' '))))
    .sort((a, b) => b.key.length - a.key.length)
    .slice(0, 3);
  let best = { score: 0, product: null };
  let second = 0;
  const scan = async (list) => {
    for (const g of list) {
      for (const p of await tcgGroupProducts(categoryId, g.id)) {
        const s = similarity(wanted, p.name);
        if (s > best.score) {
          second = best.score;
          best = { score: s, product: p };
        } else if (s > second) second = s;
      }
    }
  };
  await scan(candidates);
  // Kolekce bez edice v názvu („Mega Charizard X ex Ultra-Premium Collection“) – zkus nejnovější edice
  // (tcgcsv je řadí od nejnovějších; obsah edic se drží v paměti 24 h)
  // TCGplayer je typicky dává do „Miscellaneous Cards & Products“
  if (best.score < 0.8) await scan(groups.filter((g) => g.key.startsWith('miscellaneous')));
  if (best.score < 0.8) await scan(groups.filter((g) => !candidates.includes(g) && !g.key.startsWith('miscellaneous')).slice(0, 24));
  if (best.score < 0.8) return null;
  // víc stejně dobrých kandidátů (např. „Wave 1 – Blue“ vs „Wave 2 – White“) → nejednoznačné
  return { ...best.product, ambiguous: best.score < 2 && best.score - second < 0.05 };
}

/** Vrátí { fetchedAt, eurCzk, usdCzk, games: [{ game, source, currency, priceDate, products }] } – s 6h cache */
export async function getPriceSnapshot(force = false) {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const [pokemon, onePiece, riftbound, riftboundCm, rates] = await Promise.all([
    loadCardmarket(6, 'Pokémon'),
    // One Piece: Cardmarket (EU) – neanglické verze („Non-English“, „Asia Region Legal“…) vyřadí appka
    loadCardmarket(18, 'One Piece'),
    loadTcgplayer(TCG_RIFTBOUND, 'Riftbound'),
    // druhý trh pro Riftbound (porovnání) – malý soubor
    loadCardmarket(22, 'Riftbound').catch(() => null),
    getRates(),
  ]);
  const data = {
    fetchedAt: new Date().toISOString(),
    eurCzk: rates.eurCzk ?? null,
    usdCzk: rates.usdCzk ?? null,
    games: [pokemon, onePiece, riftbound],
    alt: riftboundCm ? [riftboundCm] : [],
  };
  cache = { at: Date.now(), data };
  return data;
}
