import { startTransition, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PlusIcon } from './icons';
import { t } from '../i18n';

export type Tab = 'portfolio' | 'analytics' | 'wishlist';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'portfolio', label: 'Portfolio', icon: 'M21 8 12 3 3 8l9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8' },
  { id: 'analytics', label: 'Analýza', icon: 'M3 3v18h18M7 15l4-4 3 3 6-7' },
  {
    id: 'wishlist',
    label: 'Wishlist',
    icon: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  },
];

interface Props {
  tab: Tab;
  wishCount: number;
  onTab: (t: Tab) => void;
  onAdd: () => void;
}

/** Záložky v hlavičce na PC – stejný styl jako lišta na mobilu (sklo, klouzavé zvýraznění, odznak na ikoně) */
export function HeaderTabs({ tab: appTab, wishCount, onTab }: Omit<Props, 'onAdd'>) {
  const navRef = useRef<HTMLElement>(null);
  const [tab, setTab] = useState(appTab);
  useEffect(() => setTab(appTab), [appTab]);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const btn = navRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`);
      if (btn) setInd({ x: btn.offsetLeft, w: btn.offsetWidth });
    };
    place();
    // písmo se může dočíst později – přeměřit
    document.fonts?.ready.then(place).catch(() => {});
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [tab]);
  const go = (id: Tab) => {
    if (id === tab) return;
    setTab(id);
    requestAnimationFrame(() => setTimeout(() => startTransition(() => onTab(id)), 16));
  };
  return (
    <nav className="main-tabs glass" aria-label={t('Sekce')} ref={navRef}>
      {ind && <span className="nav-indicator" style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} aria-hidden />}
      {TABS.map((x) => (
        <button key={x.id} data-tab={x.id} className={tab === x.id ? 'active' : ''} aria-current={tab === x.id ? 'page' : undefined} onClick={() => go(x.id)}>
          <span className="nav-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={x.icon} />
            </svg>
            {x.id === 'wishlist' && wishCount > 0 && <i className={`nav-badge ${wishCount > 9 ? 'wide' : ''}`}>{wishCount}</i>}
          </span>
          {t(x.label)}
        </button>
      ))}
    </nav>
  );
}

/**
 * Spodní lišta na mobilu (skleněná): záložky s klouzavým zvýrazněním + tlačítko Přidat.
 * Zvýraznění se posouvá jen přes transform (GPU) – plynulé i když se obsah ještě načítá.
 */
export function Dock({ tab: appTab, wishCount, onTab, onAdd }: Props) {
  const navRef = useRef<HTMLElement>(null);
  // lišta se přepne hned (vlastní stav), obsah appky dorazí s nízkou prioritou
  const [tab, setTab] = useState(appTab);
  useEffect(() => setTab(appTab), [appTab]);
  const go = (id: Tab) => {
    if (id === tab) return;
    setTab(id);
    // nejdřív nechat prohlížeč vykreslit posun zvýraznění, teprve potom přepočítat obsah
    requestAnimationFrame(() => setTimeout(() => startTransition(() => onTab(id)), 16));
  };
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const nav = navRef.current;
      const btn = nav?.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`);
      if (!nav || !btn) return;
      setInd({ x: btn.offsetLeft, w: btn.offsetWidth });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [tab]);

  return (
    <div className="dock">
      <nav className="bottom-nav glass" aria-label={t('Sekce')} ref={navRef}>
        {ind && <span className="nav-indicator" style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} aria-hidden />}
        {TABS.map((x) => (
          <button
            key={x.id}
            data-tab={x.id}
            className={tab === x.id ? 'active' : ''}
            aria-current={tab === x.id ? 'page' : undefined}
            onClick={() => go(x.id)}
          >
            <span className="nav-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={x.icon} />
              </svg>
              {x.id === 'wishlist' && wishCount > 0 && <i className={`nav-badge ${wishCount > 9 ? 'wide' : ''}`}>{wishCount}</i>}
            </span>
            <span className="nav-label">{t(x.label)}</span>
          </button>
        ))}
      </nav>
      <button className="dock-add glass" onClick={onAdd} aria-label={t('Přidat položku')}>
        <PlusIcon />
      </button>
    </div>
  );
}
