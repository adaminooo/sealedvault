import type { SetInfo } from './catalog';
import { LANG } from './i18n';
import type { ProductType } from './types';

/** Přijme „1 299,50“ i „1299.5“; prázdné/nesmysl = NaN */
export function parseNum(s: string): number {
  let t = s.replace(/[\s ]/g, '');
  // čárka i tečka zároveň („1,299.50“ / „1.299,50“): desetinný je ten poslední oddělovač, druhý odděluje tisíce
  if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else t = t.replace(',', '.');
  if (!t) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Číslo do pole formuláře bez zbytečných nul (česky s čárkou, anglicky s tečkou) */
export const numStr = (n: number | undefined) => (n === undefined || n === 0 ? '' : String(Math.round(n * 100) / 100).replace('.', LANG === 'en' ? '.' : ','));

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Zkratky, které lidé běžně píšou do hledání */
export const expandQuery = (s: string) =>
  s
    .replace(/\bupc\b/gi, 'ultra premium collection')
    .replace(/\betb\b/gi, 'elite trainer box')
    .replace(/\bbb\b/gi, 'booster box');

/** Edice z názvu produktu (nejdelší název edice z katalogu, který je v názvu) */
export function setFromName(name: string, catalog: SetInfo[]): SetInfo | undefined {
  const lower = name.toLowerCase();
  return catalog.filter((c) => !c.id.startsWith('own-') && lower.includes(c.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0];
}

/** Plné názvy typů pro automatický název ručně zadaného produktu */
export const TYPE_NAMES: Record<ProductType, string> = {
  'Booster box': 'Booster Box',
  ETB: 'Elite Trainer Box',
  Display: 'Booster Display',
  'Booster bundle': 'Booster Bundle',
  UPC: 'Ultra-Premium Collection',
  'Premium Collection': 'Premium Collection',
  'Collection box': 'Collection',
  Tin: 'Tin',
  Blister: 'Blister',
  Booster: 'Booster',
  Deck: 'Starter Deck',
  Jiné: '',
};

