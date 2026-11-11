/** Základní údaje o aplikaci – na jednom místě */
export const APP_NAME = 'SealedVault';
export const APP_FULL_NAME = 'SealedVault TCG';
export const APP_VERSION = '1.2.2';

/** Adresa podpory (zobrazí se v Nastavení → Podpora) */
export const SUPPORT_EMAIL = 'sealedvault.support@gmail.com';

/**
 * Veřejná adresa appky (GitHub Pages). Odtud bere data i PC verze běžící na localhostu
 * a míří sem odkazy na sdílené portfolio.
 */
export const PUBLIC_URL = 'https://adaminooo.github.io/sealedvault/';

/**
 * Účty a synchronizace (Supabase). Oba údaje jsou veřejné – určené pro prohlížeč;
 * data chrání pravidla v databázi (supabase/schema.sql). Prázdné = appka funguje jen lokálně.
 */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

/** Orientační ceny Premium (Kč) – platby zatím nejsou spuštěné */
export const PREMIUM_PRICE = { monthly: 79, yearly: 690 };

/** Technické údaje do e-mailu podpoře – pomůžou při řešení chyb */
export function diagnostics(extra: Record<string, string | number> = {}): string {
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  const lines = {
    Aplikace: `${APP_FULL_NAME} ${APP_VERSION}`,
    Adresa: location.origin,
    Režim: standalone ? 'nainstalovaná aplikace' : 'prohlížeč',
    Obrazovka: `${screen.width}×${screen.height} @${devicePixelRatio}x`,
    Jazyk: navigator.language,
    Prohlížeč: navigator.userAgent,
    ...extra,
  };
  return Object.entries(lines)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

export function mailtoUrl(subject: string, body: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
