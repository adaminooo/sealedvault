import { LANG, LOCALE, t } from '../i18n';
import type { Currency } from '../types';

const fmt = (currency: Currency, digits: number) =>
  new Intl.NumberFormat(LOCALE, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits });

const formatters = {
  CZK: { whole: fmt('CZK', 0), cents: fmt('CZK', 2) },
  EUR: { whole: fmt('EUR', 2), cents: fmt('EUR', 2) },
};

// ---------- Měna ----------
// Všechny částky se UKLÁDAJÍ v Kč. Přepínač Kč/€ mění jen zobrazení a zadávání:
// při € se částky přepočítají kurzem ČNB (načítá se spolu s cenami z trhu).

/** Záložní kurz, než se načte kurz ČNB */
let eurCzk = 24.3;
export function setEurRate(rate: number | null | undefined) {
  if (rate && Number.isFinite(rate) && rate > 0) eurCzk = rate;
}
export function getEurRate(): number {
  return eurCzk;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Uložená částka (Kč) → částka v měně zobrazení */
export function toDisplay(czk: number, currency: Currency): number {
  return currency === 'EUR' ? czk / eurCzk : czk;
}

/** Částka zadaná v měně zobrazení → uložená částka (Kč) */
export function fromDisplay(value: number, currency: Currency): number {
  return currency === 'EUR' ? round2(value * eurCzk) : value;
}

/**
 * Naformátuje uloženou částku (Kč) v měně zobrazení.
 * Koruny bez haléřů, pokud je částka celá; jinak 2 desetinná místa. Eura vždy na 2 místa.
 */
export function money(czk: number, currency: Currency): string {
  const value = toDisplay(czk, currency);
  const f = formatters[currency];
  return Math.abs(value - Math.round(value)) < 0.005 ? f.whole.format(value) : f.cents.format(value);
}

/** Formát částky, která UŽ je v měně zobrazení (grafy) – bez přepočtu */
export function displayMoney(value: number, currency: Currency, compact = false): string {
  if (compact) {
    // osy a tooltipy grafů: bez haléřů/centů, velká čísla zkráceně (12,5 tis. Kč)
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      maximumFractionDigits: Math.abs(value) >= 10000 ? 1 : 0,
      ...(Math.abs(value) >= 10000 ? { notation: 'compact' as const } : {}),
    }).format(value);
  }
  const f = formatters[currency];
  return Math.abs(value - Math.round(value)) < 0.005 && currency === 'CZK' ? f.whole.format(value) : f.cents.format(value);
}

export function signedMoney(value: number, currency: Currency): string {
  const s = money(Math.abs(value), currency);
  if (value > 0) return `+${s}`;
  if (value < 0) return `−${s}`;
  return s;
}

const pctFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1, minimumFractionDigits: 1 });

// česky 12,5 % (s pevnou mezerou), anglicky 12.5%
const PCT = LANG === 'en' ? '%' : '\u00a0%';

export function pct(value: number | null): string {
  if (value === null) return '—';
  const s = pctFmt.format(Math.abs(value)) + PCT;
  if (value > 0) return `+${s}`;
  if (value < 0) return `−${s}`;
  return s;
}

/** Český tvar podle počtu: plural(1, ['položka','položky','položek']) → „1 položka“ */
export function plural(n: number, forms: [string, string, string]): string {
  // v angličtině: 1 → jednotné číslo, jinak množné (překlad tvarů je ve slovníku)
  const f = t(n === 1 ? forms[0] : n >= 2 && n <= 4 ? forms[1] : forms[2]);
  return `${n.toLocaleString(LOCALE)} ${f}`;
}

export function date(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(LOCALE);
}

/** CSS třída podle znaménka */
export function tone(value: number): 'pos' | 'neg' | 'neutral' {
  if (value > 0.004) return 'pos';
  if (value < -0.004) return 'neg';
  return 'neutral';
}

export function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
