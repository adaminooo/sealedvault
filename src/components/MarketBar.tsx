import { useState } from 'react';
import { SOURCE_LABEL, type MarketSnapshot } from '../lib/market';
import { ChevronIcon, RefreshIcon } from './icons';

import { t, LOCALE } from '../i18n';
interface Props {
  market: MarketSnapshot | null;
  loading: boolean;
  error: string | null;
  linked: number;
  unlinked: number;
  onRefresh: () => void;
  onAutoLink: () => void;
}

const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'numeric' });
const rateFmt = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });


/**
 * Stav cen z trhu: na mobilu nenápadný řádek (rozbalí se klepnutím),
 * výrazněji jen když je potřeba zásah (chyba / nespárované položky). Na PC je stav v hlavičce.
 */
export function MarketBar({ market, loading, error, linked, unlinked, onRefresh, onAutoLink }: Props) {
  const attention = !!error || unlinked > 0;
  const [open, setOpen] = useState(false);
  const newest = market ? market.sources.map((s) => s.priceDate).sort().at(-1) : null;

  return (
    <section className={`market-bar ${attention ? 'attention' : ''} ${open ? 'open' : ''}`}>
      <div className="market-line">
        <button className="market-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className={`cm-dot ${error ? 'err' : market ? 'ok' : ''}`} aria-hidden />
          <span className="market-text">
            {loading
              ? t('Načítám ceny…')
              : error
                ? t('Ceny se nepodařilo načíst')
                : market
                  ? <>{t('Ceny')} {newest && dateFmt.format(new Date(newest))}{market.eurCzk ? <> {t('· 1 € =')} {rateFmt.format(market.eurCzk)}{t(' Kč')}</> : null}</>
                  : t('Ceny zatím nenačtené')}
          </span>
          <span className="market-chev"><ChevronIcon /></span>
        </button>
        <button className="icon-btn sm" onClick={onRefresh} disabled={loading} title={t('Načíst ceny znovu')} aria-label={t('Načíst ceny znovu')}>
          <RefreshIcon size={15} />
        </button>
      </div>

      {error && <p className="market-error">{error}</p>}
      {unlinked > 0 && (
        <div className="market-line sub">
          <span>
            {t('Bez ceny z trhu:')} <b>{unlinked}</b>
          </span>
          <button className="link-btn strong" onClick={onAutoLink}>
            {t('Spárovat automaticky')}
          </button>
        </div>
      )}

      {open && market && (
        <div className="market-details">
          <ul className="market-sources">
            {market.sources.map((s) => (
              <li key={s.game}>
                <span>{s.game}</span>
                <span>
                  {SOURCE_LABEL[s.source]} ({s.currency}) · {dateFmt.format(new Date(s.priceDate))}
                </span>
              </li>
            ))}
            {market.usdCzk && (
              <li>
                <span>{t('Kurz ČNB')}</span>
                <span>{t('1 $ =')} {rateFmt.format(market.usdCzk)}{t(' Kč')}</span>
              </li>
            )}
          </ul>
          <p className="hint">
            {t('Jen anglické verze · spárováno')} {linked} {linked === 1 ? t('položka') : linked > 1 && linked < 5 ? t('položky') : t('položek')}
          </p>
        </div>
      )}
    </section>
  );
}
