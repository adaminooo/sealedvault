import { useEffect, useRef, useState } from 'react';
import { dirLabels, parseSort, SORT_FIELDS, type SortDir, type SortField, type SortKey } from '../lib/filters';

import { t } from '../i18n';
interface Props {
  value: SortKey;
  onChange: (v: SortKey) => void;
}

const ArrowIcon = ({ dir }: { dir: SortDir }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
    style={{ transform: dir === 'asc' ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m5 12 5 5 9-10" />
  </svg>
);

/** Řazení: tlačítko s aktuálním polem + rychlé otočení směru, menu s výběrem pole a směru */
export function SortMenu({ value, onChange }: Props) {
  const { field, dir } = parseSort(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const labels = dirLabels(field);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const set = (f: SortField, d: SortDir) => onChange(`${f}-${d}`);
  /** Pro název je přirozený směr A→Z, pro ostatní od nejvyššího */
  const naturalDir = (f: SortField): SortDir => (f === 'name' ? 'asc' : 'desc');

  return (
    <div className="sort-menu" ref={ref}>
      <div className="sort-trigger">
        <button className="sort-main" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
          <span className="sort-cap">{t('Řadit')}</span>
          <span className="sort-val">{t(SORT_FIELDS[field])}</span>
        </button>
        <button
          className="sort-dir"
          onClick={() => set(field, dir === 'asc' ? 'desc' : 'asc')}
          title={t('Směr: {0}', t(labels[dir]))}
          aria-label={t('Otočit směr řazení (teď {0})', t(labels[dir]))}
        >
          <ArrowIcon dir={dir} />
        </button>
      </div>

      {open && (
        <div className="sort-pop" role="menu">
          <div className="sort-pop-title">{t('Řadit podle')}</div>
          <ul>
            {(Object.keys(SORT_FIELDS) as SortField[]).map((f) => (
              <li key={f}>
                <button
                  role="menuitemradio"
                  aria-checked={f === field}
                  className={f === field ? 'active' : ''}
                  onClick={() => {
                    set(f, f === field ? dir : naturalDir(f));
                    setOpen(false);
                  }}
                >
                  <span>{t(SORT_FIELDS[f])}</span>
                  {f === field && <CheckIcon />}
                </button>
              </li>
            ))}
          </ul>
          <div className="sort-pop-title">{t('Směr')}</div>
          <div className="sort-dirs">
            {(['desc', 'asc'] as SortDir[]).map((d) => (
              <button key={d} className={d === dir ? 'active' : ''} onClick={() => { set(field, d); setOpen(false); }}>
                <ArrowIcon dir={d} />
                {t(labels[d])}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
