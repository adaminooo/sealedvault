import { useCallback, useMemo } from 'react';

import { changeAbs, priceChanges } from '@/core/changes';
import { applyFilters, DEFAULT_FILTERS, sortPositions, type Filters } from '@/core/filters';
import { groupPositions, type Position } from '@/core/portfolio';
import { ALL_ID, DEFAULT_PORTFOLIOS, portfolioOf } from '@/core/portfolios';
import { holdingsTrend, isoDaysAgo } from '@/core/trend';
import { items as itemsStore, useCollection } from '@/db/store';

import { useHistory } from './queries';
import { useStoredState } from './use-stored-state';

/** Seznam portfolií (synchronizuje se s účtem) a vybrané portfolio */
export function usePortfolios() {
  const [pf, setPf] = useStoredState('portfolios', DEFAULT_PORTFOLIOS);
  const [active, setActive] = useStoredState<string>('activePortfolio', ALL_ID);
  const valid = active === ALL_ID || pf.list.some((p) => p.id === active) ? active : ALL_ID;
  return { list: pf.list, setList: (list: typeof pf.list) => setPf({ ...pf, list }), active: valid, setActive };
}

export function useFilters() {
  return useStoredState<Filters>('filters', DEFAULT_FILTERS);
}

/**
 * Data hlavní obrazovky: položky vybraného portfolia po filtrech, pozice seřazené,
 * denní změny a křivka hodnoty za 90 dní (z historie cen).
 */
export function usePortfolioView(search = '') {
  const all = useCollection(itemsStore);
  const { active } = usePortfolios();
  const [filters] = useFilters();

  const pItems = useMemo(() => (active === ALL_ID ? all : all.filter((it) => portfolioOf(it) === active)), [all, active]);
  // base = po filtrech (hlavní karta), visible = navíc po vyhledávání (seznam)
  const base = useMemo(() => applyFilters(pItems, filters), [pItems, filters]);
  const visible = useMemo(() => (search.trim() ? applyFilters(base, { ...filters, search }) : base), [base, filters, search]);

  const ids = useMemo(() => pItems.flatMap((i) => (i.cmProductId ? [i.cmProductId] : [])), [pItems]);
  const hist = useHistory(ids, isoDaysAgo(90)).data ?? null;
  const changes = useMemo(() => priceChanges(hist), [hist]);

  const spark = useMemo(() => {
    const from = isoDaysAgo(30);
    const out = new Map<number, number[]>();
    for (const [id, pts] of Object.entries(hist?.series ?? {})) {
      const recent = pts.filter(([d]) => d >= from).map(([, v]) => v);
      if (recent.length >= 3) out.set(Number(id), recent);
    }
    return out;
  }, [hist]);

  const trend = useMemo(() => holdingsTrend(hist, base), [hist, base]);

  const dayChangeOf = useCallback(
    (p: Position) => (p.stats.held && p.head.cmProductId ? changeAbs(p.stats.value, changes.get(p.head.cmProductId)?.d1 ?? null) : null),
    [changes],
  );
  const grouped = useMemo(() => groupPositions(visible), [visible]);
  const positions = useMemo(() => sortPositions(grouped, filters.sort, dayChangeOf), [grouped, filters.sort, dayChangeOf]);

  const dayChange = useMemo(() => {
    let abs = 0;
    let value = 0;
    let known = false;
    for (const p of groupPositions(base)) {
      value += p.stats.value;
      const c = dayChangeOf(p);
      if (c != null) {
        abs += c;
        known = true;
      }
    }
    return known ? { abs, pct: value - abs > 0 ? (abs / (value - abs)) * 100 : 0 } : null;
  }, [base, dayChangeOf]);

  return { all, pItems, base, visible, positions, changes, spark, trend, dayChange };
}
