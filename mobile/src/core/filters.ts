import type { Game, PortfolioItem, ProductType } from './types';
import { heldQty, itemStats, type ItemStats } from './calc';
import type { Position } from './portfolio';

export const SORT_FIELDS = {
  profit: 'Profit',
  pct: 'Profit v %',
  value: 'Hodnota',
  change: 'Změna za den',
  cost: 'Investice',
  date: 'Datum nákupu',
  name: 'Název',
} as const;

export type SortField = keyof typeof SORT_FIELDS;
export type SortDir = 'asc' | 'desc';
export type SortKey = `${SortField}-${SortDir}`;

/** Popisky směru podle typu pole */
export function dirLabels(field: SortField): Record<SortDir, string> {
  if (field === 'name') return { asc: 'A → Z', desc: 'Z → A' };
  if (field === 'date') return { desc: 'Nejnovější', asc: 'Nejstarší' };
  return { desc: 'Nejvyšší', asc: 'Nejnižší' };
}

export function parseSort(key: string): { field: SortField; dir: SortDir } {
  const [field, dir] = key.split('-') as [SortField, SortDir];
  return {
    field: field in SORT_FIELDS ? field : 'profit',
    dir: dir === 'asc' ? 'asc' : 'desc',
  };
}

export interface Filters {
  search: string;
  game: Game | 'all';
  set: string | 'all';
  type: ProductType | 'all';
  result: 'all' | 'profit' | 'loss';
  /** Stav: vše / bez vad (Perfektní nebo nic) / s vadou / s poznámkou */
  cond: 'all' | 'clean' | 'damaged' | 'noted';
  /** Držené kusy / prodané / vše */
  holding: 'held' | 'sold' | 'all';
  /** Série edic (např. „Mega Evolution“, „Scarlet & Violet“) */
  series: string | 'all';
  sort: SortKey;
}

export const DEFAULT_FILTERS: Filters = {
  search: '',
  game: 'all',
  set: 'all',
  type: 'all',
  result: 'all',
  cond: 'all',
  holding: 'held',
  series: 'all',
  sort: 'profit-desc',
};

export function isFiltered(f: Filters): boolean {
  return (
    f.search.trim() !== '' || f.game !== 'all' || f.set !== 'all' || f.type !== 'all' || f.result !== 'all' || f.cond !== 'all' || f.holding !== 'held' || f.series !== 'all'
  );
}

const hasDefect = (it: PortfolioItem) => (it.condition ?? []).some((c) => c !== 'Perfektní');

function sortValue(field: SortField, it: PortfolioItem, s: ItemStats): number | string {
  switch (field) {
    case 'profit': return s.profit;
    case 'pct': return s.profitPct ?? 0;
    case 'value': return s.value;
    case 'change': return 0; // řadí se jen u pozic (sortPositions)
    case 'cost': return s.cost;
    case 'date': return it.buyDate;
    case 'name': return it.name;
  }
}

/** Seřadí pozice (seskupené dávky) podle stejného klíče jako položky */
export function sortPositions(positions: Position[], key: SortKey, changeOf?: (p: Position) => number | null): Position[] {
  const { field, dir } = parseSort(key);
  const sign = dir === 'asc' ? 1 : -1;
  const val = (p: Position): number | string => {
    switch (field) {
      case 'profit': return p.stats.held ? p.stats.profit : p.stats.realized;
      case 'pct': return p.stats.profitPct ?? 0;
      case 'value': return p.stats.value;
      // podle změny hodnoty za den v Kč (bez dat = 0)
      case 'change': return changeOf?.(p) ?? 0;
      case 'cost': return p.stats.cost;
      case 'date': return p.lots[p.lots.length - 1].buyDate;
      case 'name': return p.name;
    }
  };
  return [...positions].sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    return (typeof va === 'string' ? va.localeCompare(vb as string, 'cs') : va - (vb as number)) * sign;
  });
}

/** Série položky – Pokémon podle katalogu edic, Riftbound jako vlastní série */
export type SeriesOf = (it: PortfolioItem) => string;

export function applyFilters(items: PortfolioItem[], f: Filters, seriesOf?: SeriesOf): PortfolioItem[] {
  if (f.series !== 'all' && seriesOf) items = items.filter((it) => seriesOf(it) === f.series);
  const q = f.search.trim().toLowerCase();
  const rows = items
    .filter((it) => f.game === 'all' || it.game === f.game)
    .filter((it) => f.set === 'all' || it.set === f.set)
    .filter((it) => f.type === 'all' || it.type === f.type)
    .filter((it) => !q || `${it.name} ${it.set} ${it.note} ${(it.condition ?? []).join(' ')}`.toLowerCase().includes(q))
    .filter((it) =>
      f.holding === 'all' ? true : f.holding === 'held' ? heldQty(it) > 0 : (it.sales ?? []).length > 0,
    )
    .filter((it) => {
      switch (f.cond) {
        case 'clean': return !hasDefect(it);
        case 'damaged': return hasDefect(it);
        case 'noted': return !!it.note?.trim();
        default: return true;
      }
    })
    .map((it) => ({ it, s: itemStats(it) }))
    .filter(({ s }) => f.result === 'all' || (f.result === 'profit' ? s.profit > 0 : s.profit < 0));

  const { field, dir } = parseSort(f.sort);
  const sign = dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const va = sortValue(field, a.it, a.s);
    const vb = sortValue(field, b.it, b.s);
    const c = typeof va === 'string' ? va.localeCompare(vb as string, 'cs') : va - (vb as number);
    return c * sign;
  });
  return rows.map((r) => r.it);
}
