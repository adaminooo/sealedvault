import { EN } from './en';

/**
 * Jazyk appky. Texty v kódu jsou česky a slouží zároveň jako klíč – t('Přidat') → „Add“ v angličtině.
 * Proměnné části: t('Prodáno {0} ks', n) → „Sold {0} pcs“ s dosazeným číslem.
 * Jazyk se přepíná v Nastavení (uloží se a appka se načte znovu).
 */
export type Lang = 'cs' | 'en';

const KEY = 'tcg-portfolio:lang';

function readLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'cs';
  } catch {
    return 'cs';
  }
}

export const LANG: Lang = readLang();
/** Formát čísel a dat podle jazyka */
export const LOCALE = LANG === 'en' ? 'en-GB' : 'cs-CZ';

export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* nevadí */
  }
  location.reload();
}

const fill = (s: string, args: unknown[]) => (args.length ? s.replace(/\{(\d+)\}/g, (m, i) => (i < args.length ? String(args[i]) : m)) : s);

// klíče slovníku jsou s obyčejnými mezerami (texty v appce mají před jednotkami pevné mezery)
const norm = (s: string) => s.replace(/ /g, ' ');
const DICT: Record<string, string> = LANG === 'en' ? Object.fromEntries(Object.entries(EN).map(([k, v]) => [norm(k), v])) : {};

/** Přeloží text (klíč = český text); neznámý text vrátí beze změny */
export function t(cs: string, ...args: unknown[]): string {
  if (LANG === 'cs') return fill(cs, args);
  const key = norm(cs);
  const hit = DICT[key] ?? DICT[key.trim()];
  // zachovat mezery na okrajích (fragmenty textu kolem čísel)
  const out = hit == null ? cs : DICT[key] != null ? hit : cs.match(/^\s*/)![0] + hit + cs.match(/\s*$/)![0];
  return fill(out, args);
}

if (typeof document !== 'undefined') document.documentElement.lang = LANG;
