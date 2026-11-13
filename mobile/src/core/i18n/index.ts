import { EN } from './en';
import { EN_MOBILE } from './en-mobile';

/**
 * Jazyk appky – stejný princip jako web: texty v kódu jsou česky a slouží jako klíč,
 * t('Přidat') → „Add“ v angličtině; t('Prodáno {0} ks', n) dosadí proměnné.
 * Jazyk se ukládá do lokálního úložiště; bez uložené volby se řídí jazykem telefonu.
 */
export type Lang = 'cs' | 'en';

const KEY = 'tcg-portfolio:lang';

function deviceLang(): Lang {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    return /^(cs|sk)\b/i.test(loc) ? 'cs' : 'en';
  } catch {
    return 'cs';
  }
}

function readLang(): Lang {
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    if (v === 'en' || v === 'cs') return v;
  } catch {
    /* úložiště nedostupné (testy) */
  }
  return deviceLang();
}

export const LANG: Lang = readLang();
/** Formát čísel a dat podle jazyka */
export const LOCALE = LANG === 'en' ? 'en-GB' : 'cs-CZ';

/** Uloží jazyk; projeví se po restartu appky (volající ji restartuje přes reloadAppAsync) */
export function saveLang(l: Lang) {
  try {
    globalThis.localStorage?.setItem(KEY, l);
  } catch {
    /* nevadí */
  }
}

const fill = (s: string, args: unknown[]) => (args.length ? s.replace(/\{(\d+)\}/g, (m, i) => (i < args.length ? String(args[i]) : m)) : s);

// klíče slovníku jsou s obyčejnými mezerami (texty v appce mají před jednotkami pevné mezery)
const norm = (s: string) => s.replace(/ /g, ' ');
const DICT: Record<string, string> = LANG === 'en' ? Object.fromEntries(Object.entries({ ...EN, ...EN_MOBILE }).map(([k, v]) => [norm(k), v])) : {};

/** Přeloží text (klíč = český text); neznámý text vrátí beze změny */
export function t(cs: string, ...args: unknown[]): string {
  if (LANG === 'cs') return fill(cs, args);
  const key = norm(cs);
  const hit = DICT[key] ?? DICT[key.trim()];
  const out = hit == null ? cs : DICT[key] != null ? hit : cs.match(/^\s*/)![0] + hit + cs.match(/\s*$/)![0];
  return fill(out, args);
}
