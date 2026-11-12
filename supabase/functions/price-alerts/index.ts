// SealedVault – denní cenové alerty (push notifikace do telefonu).
// Spouští ji jednou denně pg_cron (supabase/mobile.sql) po aktualizaci cen.
// Projde portfolia a wishlisty uživatelů s povolenými notifikacemi, porovná s dnešními cenami
// a pošle notifikaci přes Expo Push. Stejné pravidlo jako alerty na webu (src/lib/alerts.ts):
//  - položka: alert „nad“ / „pod“ cenou (alertAbove / alertBelow)
//  - wishlist: cena klesla na cílovou cenu nebo pod ni
// Každý alert jde jen jednou; když přestane platit, zapomene se (může se ozvat znovu).
// Bezpečné i při cizím volání: běží nejvýš jednou za 6 hodin a nic nevrací.
import { createClient } from 'npm:@supabase/supabase-js@2';

const PRICES_URL = 'https://adaminooo.github.io/sealedvault/data/prices.json';
const MIN_GAP_MS = 6 * 60 * 60 * 1000;

type Tuple = [number, string, string, number | null, number | null, number | null, (string | null)?];
type Raw = { eurCzk: number | null; usdCzk?: number | null; games: { currency?: 'EUR' | 'USD'; products: Tuple[] }[] };
type Item = {
  id: string; name: string; quantity: number; sales?: { quantity: number }[]; currentPrice: number;
  cmProductId?: number; priceAuto?: boolean; alertAbove?: number; alertBelow?: number;
};
type Wish = { id: string; name: string; cmProductId?: number; targetPrice?: number };
type Alert = { id: string; kind: 'above' | 'below' | 'wish'; title: string; price: number; threshold: number; target: string };

const TEXT = {
  cs: { above: 'Cena stoupla na {0} (nad {1})', below: 'Cena klesla na {0} (pod {1})', wish: 'Cena klesla na {0} (cíl {1})', more: 'a {0} dalších' },
  en: { above: 'Price rose to {0} (above {1})', below: 'Price fell to {0} (below {1})', wish: 'Price dropped to {0} (target {1})', more: 'and {0} more' },
};
const fill = (s: string, ...a: string[]) => s.replace(/\{(\d)\}/g, (_, i) => a[Number(i)] ?? '');
const kc = (n: number, lang: string) => new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(n);

/** Klíč pozice – stejný jako v appce (src/lib/portfolio.ts positionKey) */
const positionKey = (it: Item & { game?: string }) => (it.cmProductId ? `p:${it.cmProductId}` : `n:${it.game}|${it.name.trim().toLowerCase()}`);
const held = (it: Item) => Math.max(0, it.quantity - (it.sales ?? []).reduce((a, s) => a + s.quantity, 0));

Deno.serve(async () => {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // nejvýš jednou za 6 h
  const { data: run } = await db.from('alert_runs').select('started_at').eq('id', 1).maybeSingle();
  if (run && Date.now() - Date.parse(run.started_at) < MIN_GAP_MS) return new Response('skip');
  await db.from('alert_runs').upsert({ id: 1, started_at: new Date().toISOString() });

  // dnešní ceny (Kč za kus)
  const raw: Raw = await (await fetch(PRICES_URL, { cache: 'no-store' })).json();
  const price = new Map<number, number>();
  for (const g of raw.games) {
    const rate = (g.currency === 'USD' ? raw.usdCzk : raw.eurCzk) ?? (g.currency === 'USD' ? 21.7 : 24.3);
    for (const [id, , , trend, avg, low] of g.products) {
      const v = trend ?? avg ?? low;
      if (v != null) price.set(id, Math.round(v * rate));
    }
  }

  // uživatelé s povolenými notifikacemi
  const { data: tokens } = await db.from('push_tokens').select('token,user_id,lang');
  const byUser = new Map<string, { token: string; lang: string }[]>();
  for (const t of tokens ?? []) (byUser.get(t.user_id) ?? byUser.set(t.user_id, []).get(t.user_id)!).push(t);

  const messages: unknown[] = [];
  let sentAlerts = 0;
  for (const [uid, devices] of byUser) {
    const { data: rows } = await db.from('user_data').select('kind,data').eq('user_id', uid).eq('deleted', false).in('kind', ['item', 'wish']);
    const items = (rows ?? []).filter((r) => r.kind === 'item' && r.data).map((r) => r.data as Item & { game?: string });
    const wishes = (rows ?? []).filter((r) => r.kind === 'wish' && r.data).map((r) => r.data as Wish);

    const alerts: Alert[] = [];
    // pozice (víc nákupů stejného produktu = jedna pozice)
    const positions = new Map<string, (Item & { game?: string })[]>();
    for (const it of items) (positions.get(positionKey(it)) ?? positions.set(positionKey(it), []).get(positionKey(it))!).push(it);
    for (const [key, lots] of positions) {
      if (!lots.some((l) => held(l) > 0)) continue;
      const head = lots[lots.length - 1];
      const now = head.cmProductId && head.priceAuto !== false ? (price.get(head.cmProductId) ?? head.currentPrice) : head.currentPrice;
      const above = lots.find((l) => l.alertAbove)?.alertAbove;
      const below = lots.find((l) => l.alertBelow)?.alertBelow;
      if (above && now >= above) alerts.push({ id: `a:${key}:${above}`, kind: 'above', title: head.name, price: now, threshold: above, target: key });
      if (below && now <= below) alerts.push({ id: `b:${key}:${below}`, kind: 'below', title: head.name, price: now, threshold: below, target: key });
    }
    for (const w of wishes) {
      const now = w.cmProductId ? price.get(w.cmProductId) : undefined;
      if (now != null && w.targetPrice && now <= w.targetPrice) alerts.push({ id: `w:${w.id}:${w.targetPrice}`, kind: 'wish', title: w.name, price: now, threshold: w.targetPrice, target: w.id });
    }

    const { data: log } = await db.from('alert_log').select('alert_id').eq('user_id', uid);
    const sent = new Set((log ?? []).map((l) => l.alert_id));
    const live = new Set(alerts.map((a) => a.id));
    const fresh = alerts.filter((a) => !sent.has(a.id));
    // alerty, které už neplatí → zapomenout (příště se mohou ozvat znovu)
    const stale = [...sent].filter((id) => !live.has(id));
    if (stale.length) await db.from('alert_log').delete().eq('user_id', uid).in('alert_id', stale);
    if (!fresh.length) continue;
    await db.from('alert_log').upsert(fresh.map((a) => ({ user_id: uid, alert_id: a.id })));
    sentAlerts += fresh.length;

    for (const d of devices) {
      const T = d.lang === 'en' ? TEXT.en : TEXT.cs;
      for (const a of fresh.slice(0, 3)) {
        messages.push({
          to: d.token,
          sound: 'default',
          title: a.title,
          body: fill(T[a.kind], kc(a.price, d.lang), kc(a.threshold, d.lang)),
          data: a.kind === 'wish' ? { url: '/wishlist' } : { url: `/product/${encodeURIComponent(a.target)}` },
        });
      }
      if (fresh.length > 3) messages.push({ to: d.token, title: 'SealedVault', body: fill(T.more, String(fresh.length - 3)), data: { url: '/' } });
    }
  }

  // Expo Push API: max. 100 zpráv na požadavek
  for (let i = 0; i < messages.length; i += 100) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
    // neplatné tokeny (odinstalovaná appka) smazat
    const out = await res.json().catch(() => null);
    const tickets: { status: string; details?: { error?: string } }[] = out?.data ?? [];
    const dead = tickets
      .map((t, k) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' ? (messages[i + k] as { to: string }).to : null))
      .filter((x): x is string => !!x);
    if (dead.length) await db.from('push_tokens').delete().in('token', dead);
  }

  return new Response(JSON.stringify({ users: byUser.size, alerts: sentAlerts, messages: messages.length }), { headers: { 'Content-Type': 'application/json' } });
});
