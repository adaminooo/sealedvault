import { useState } from 'react';
import { GAMES, type ProductType } from '../types';
import { DEFAULT_FILTERS, isFiltered, type Filters } from '../lib/filters';
import { SortMenu } from './SortMenu';
import type { ListView } from './ItemList';
import { SearchIcon, SlidersIcon } from './icons';

import { t } from '../i18n';
interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  sets: string[];
  /** Série, které se v portfoliu vyskytují */
  seriesOptions: string[];
  /** Typy, které se v portfoliu vyskytují */
  typeOptions: ProductType[];
  shown: number;
  total: number;
  view: ListView;
  onView: (v: ListView) => void;
  onExport: () => void;
}

const COND_LABEL: Record<Filters['cond'], string> = { all: 'Jakýkoli', clean: 'Bez vad', damaged: 'S vadou', noted: 'S poznámkou' };

export function Toolbar({ filters, onChange, sets, seriesOptions, typeOptions, shown, total, view, onView, onExport }: Props) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });
  const [open, setOpen] = useState(false);
  const extra =
    (filters.set !== 'all' ? 1 : 0) + (filters.type !== 'all' ? 1 : 0) + (filters.cond !== 'all' ? 1 : 0) + (filters.series !== 'all' ? 1 : 0);

  const chip = (label: string, active: boolean, onClick: () => void, key = label) => (
    <button key={key} className={`chip ${active ? 'active' : ''}`} onClick={onClick}>
      {t(label)}
    </button>
  );

  // aktivní filtry jako odstranitelné štítky
  const active: { label: string; clear: () => void }[] = [];
  if (filters.search.trim()) active.push({ label: `„${filters.search.trim()}“`, clear: () => set('search', '') });
  if (filters.series !== 'all') active.push({ label: `${t('Série')}: ${filters.series}`, clear: () => set('series', 'all') });
  if (filters.set !== 'all') active.push({ label: `${t('Edice')}: ${filters.set}`, clear: () => set('set', 'all') });
  if (filters.type !== 'all') active.push({ label: `${t('Typ')}: ${filters.type}`, clear: () => set('type', 'all') });
  if (filters.cond !== 'all') active.push({ label: `${t('Stav')}: ${t(COND_LABEL[filters.cond])}`, clear: () => set('cond', 'all') });

  return (
    <section className="toolbar">
      <div className="list-head">
        <h3>
          {t('Položky')} <span className="count">{isFiltered(filters) ? `${shown} / ${total}` : total}</span>
        </h3>
        <div className="list-tools">
          <button className="icon-btn" onClick={onExport} title={t('Exportovat zobrazené do CSV')} aria-label={t('Exportovat do CSV')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M12 18v-6m0 6-3-3m3 3 3-3" />
            </svg>
          </button>
          <div className="view-toggle" role="group" aria-label={t('Zobrazení')}>
            <button className={view === 'list' ? 'active' : ''} onClick={() => onView('list')} aria-label={t('Seznam')} title={t('Seznam')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
              </svg>
            </button>
            <button className={view === 'grid' ? 'active' : ''} onClick={() => onView('grid')} aria-label={t('Mřížka')} title={t('Mřížka s obrázky')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
                <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
              </svg>
            </button>
          </div>
          <SortMenu value={filters.sort} onChange={(v) => set('sort', v)} />
        </div>
      </div>

      <div className="search-row">
        <label className="search">
          <SearchIcon />
          <input type="search" placeholder={t('Hledat…')} value={filters.search} onChange={(e) => set('search', e.target.value)} />
        </label>
        <button className={`icon-btn lg ${open || extra ? 'on' : ''}`} onClick={() => setOpen(!open)} aria-label={t('Další filtry')} aria-expanded={open}>
          <SlidersIcon />
          {extra > 0 && <span className="dot">{extra}</span>}
        </button>
      </div>

      <div className="chips">
        {chip('Vše', filters.game === 'all' && filters.result === 'all', () => onChange({ ...filters, game: 'all', result: 'all' }))}
        {GAMES.map((g) => chip(g, filters.game === g, () => onChange({ ...filters, game: filters.game === g ? 'all' : g, series: 'all' })))}
        <span className="chip-sep" />
        {chip('V zisku', filters.result === 'profit', () => set('result', filters.result === 'profit' ? 'all' : 'profit'))}
        {chip('Ve ztrátě', filters.result === 'loss', () => set('result', filters.result === 'loss' ? 'all' : 'loss'))}
        <span className="chip-sep" />
        {chip('Prodané', filters.holding === 'sold', () => set('holding', filters.holding === 'sold' ? 'held' : 'sold'))}
        <button className={`chip chip-filters ${open || extra ? 'on' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
          <SlidersIcon /> {t('Filtry')}{extra > 0 && ` (${extra})`}
        </button>
      </div>

      {open && (
        <div className="filter-panel">
          <div className="fgroup">
            <span>{t('Značka')}</span>
            <div className="fchips">
              {chip('Vše', filters.game === 'all', () => onChange({ ...filters, game: 'all', series: 'all' }), 'g-all')}
              {GAMES.map((g) => chip(g, filters.game === g, () => onChange({ ...filters, game: g, series: 'all' }), `g-${g}`))}
            </div>
          </div>
          {seriesOptions.length > 1 && (
            <div className="fgroup">
              <span>{t('Série')}</span>
              <div className="fchips">
                {chip('Vše', filters.series === 'all', () => set('series', 'all'), 's-all')}
                {seriesOptions.map((s) => chip(s, filters.series === s, () => set('series', filters.series === s ? 'all' : s), `s-${s}`))}
              </div>
            </div>
          )}
          <div className="fgroup">
            <span>{t('Typ produktu')}</span>
            <div className="fchips">
              {chip('Vše', filters.type === 'all', () => set('type', 'all'), 't-all')}
              {typeOptions.map((t) => chip(t, filters.type === t, () => set('type', filters.type === t ? 'all' : t), `t-${t}`))}
            </div>
          </div>
          <div className="fgroup">
            <span>{t('Stav')}</span>
            <div className="fchips">
              {(Object.keys(COND_LABEL) as Filters['cond'][]).map((c) => chip(COND_LABEL[c], filters.cond === c, () => set('cond', c), `c-${c}`))}
            </div>
          </div>
          <label className="fgroup">
            <span>{t('Edice')}</span>
            <select value={filters.set} onChange={(e) => set('set', e.target.value)}>
              <option value="all">{t('Všechny edice')}</option>
              {sets.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>
      )}

      {active.length > 0 && (
        <div className="active-filters">
          {active.map((a) => (
            <button key={a.label} className="af-chip" onClick={a.clear} title={t('Zrušit filtr')}>
              {a.label} <span aria-hidden>{t('×')}</span>
            </button>
          ))}
          <button className="link-btn" onClick={() => onChange({ ...DEFAULT_FILTERS, sort: filters.sort })}>{t('Zrušit vše')}</button>
        </div>
      )}
    </section>
  );
}
