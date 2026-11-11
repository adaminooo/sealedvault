import { useEffect, useRef, useState } from 'react';
import type { Currency } from '../types';
import type { PriceAlert } from '../lib/alerts';
import { money } from '../lib/format';
import { usePremium } from '../lib/premium';

import { t } from '../i18n';
interface Props {
  alerts: PriceAlert[];
  currency: Currency;
  onOpen: (a: PriceAlert) => void;
}

const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />
  </svg>
);

const LABEL = { wish: 'Wishlist – cílová cena', above: 'Cena nad hranicí', below: 'Cena pod hranicí' };

/** Zvoneček v hlavičce se splněnými cenovými alerty */
export function AlertsBell({ alerts, currency, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { isPremium, openPaywall } = usePremium();

  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [open]);

  return (
    <div className="bell" ref={ref}>
      <button className={`icon-btn ${alerts.length ? 'on' : ''}`} onClick={() => (isPremium ? setOpen(!open) : openPaywall('alerts'))} aria-label={t('Upozornění ({0})', alerts.length)} title={t('Cenová upozornění')}>
        <BellIcon />
        {alerts.length > 0 && <span className="dot">{alerts.length}</span>}
      </button>
      {open && (
        <div className="bell-pop">
          <div className="sort-pop-title">{t('Cenová upozornění')}</div>
          {alerts.length === 0 ? (
            <p className="hint bell-empty">
              {t('Nic nového. Alerty nastavíš v detailu produktu (cena nad / pod) nebo cílovou cenou ve Wishlistu.')}
            </p>
          ) : (
            <ul>
              {alerts.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => {
                      setOpen(false);
                      onOpen(a);
                    }}
                  >
                    {a.image ? <img src={a.image} alt="" referrerPolicy="no-referrer" /> : <span className="bell-ph" />}
                    <span className="bell-main">
                      <b>{a.title}</b>
                      <span className={`bell-kind ${a.kind}`}>{t(LABEL[a.kind])}</span>
                    </span>
                    <span className="bell-side">
                      <b>{money(a.price, currency)}</b>
                      <em>{a.kind === 'above' ? '≥' : '≤'} {money(a.threshold, currency)}</em>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
