import { t } from '../i18n';
import type { PortfolioItem, WishlistItem } from '../types';
import { groupPositions } from './portfolio';
import { marketPrice, toCzk, type MarketSnapshot } from './market';

/** Aktuální cena produktu z wishlistu v Kč (z tržiště) */
export function wishPrice(w: WishlistItem, market: MarketSnapshot | null): number | null {
  if (!w.cmProductId || !market) return null;
  const p = market.byId.get(w.cmProductId);
  const v = marketPrice(p);
  return p && v != null ? toCzk(v, p.currency, market) : null;
}

export interface PriceAlert {
  /** Stabilní id (pro „už oznámeno“) */
  id: string;
  kind: 'wish' | 'above' | 'below';
  title: string;
  /** Aktuální cena / ks (Kč) */
  price: number;
  /** Hranice (Kč) */
  threshold: number;
  /** Klíč pozice nebo id položky wishlistu */
  target: string;
  image?: string;
}

/** Splněné alerty pro portfolio a wishlist */
export function evaluateAlerts(items: PortfolioItem[], wishlist: WishlistItem[], market: MarketSnapshot | null): PriceAlert[] {
  const out: PriceAlert[] = [];
  for (const p of groupPositions(items)) {
    if (p.stats.held <= 0) continue;
    const above = p.lots.find((l) => l.alertAbove)?.alertAbove;
    const below = p.lots.find((l) => l.alertBelow)?.alertBelow;
    const price = p.head.currentPrice;
    const image = p.head.productImage ?? p.head.image;
    if (above && price >= above) out.push({ id: `a:${p.key}:${above}`, kind: 'above', title: p.name, price, threshold: above, target: p.key, image });
    if (below && price <= below) out.push({ id: `b:${p.key}:${below}`, kind: 'below', title: p.name, price, threshold: below, target: p.key, image });
  }
  for (const w of wishlist) {
    const now = wishPrice(w, market);
    if (now != null && w.targetPrice && now <= w.targetPrice) {
      out.push({ id: `w:${w.id}:${w.targetPrice}`, kind: 'wish', title: w.name, price: now, threshold: w.targetPrice, target: w.id, image: w.productImage });
    }
  }
  return out;
}

// ---------- Systémové notifikace ----------

const FIRED_KEY = 'tcg-portfolio:alerts-fired';

function readFired(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export async function enableNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.requestPermission();
}

/** Pošle notifikaci k alertům, které ještě nebyly oznámeny (každý alert max. jednou) */
export async function notifyNew(alerts: PriceAlert[], fmt: (czk: number) => string) {
  const fired = readFired();
  const fresh = alerts.filter((a) => !fired[a.id]);
  if (!fresh.length) return 0;
  for (const a of fresh) fired[a.id] = new Date().toISOString();
  // aktivní alerty, které už nejsou splněné, zapomeneme – ať se ozvou znovu
  const live = new Set(alerts.map((a) => a.id));
  for (const k of Object.keys(fired)) if (!live.has(k)) delete fired[k];
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
  } catch {
    /* nevadí */
  }

  if (!notificationsSupported() || Notification.permission !== 'granted') return fresh.length;
  const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
  for (const a of fresh.slice(0, 5)) {
    const body =
      a.kind === 'wish'
        ? t('Cena klesla na {0} (cíl {1})', fmt(a.price), fmt(a.threshold))
        : a.kind === 'above'
          ? t('Cena stoupla na {0} (nad {1})', fmt(a.price), fmt(a.threshold))
          : t('Cena klesla na {0} (pod {1})', fmt(a.price), fmt(a.threshold));
    const opts: NotificationOptions = { body, icon: `${import.meta.env.BASE_URL}pwa-192.png`, badge: `${import.meta.env.BASE_URL}pwa-192.png`, tag: a.id };
    try {
      if (reg) await reg.showNotification(a.title, opts);
      else new Notification(a.title, opts);
    } catch {
      /* prohlížeč notifikaci nepovolil */
    }
  }
  return fresh.length;
}
