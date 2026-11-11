import { useEffect, useState } from 'react';
import { readShare, type SharedPortfolio } from '../lib/share';
import { plural } from '../lib/format';
import { displayMoney, pct, tone } from '../lib/format';
import { Logo, TrendIcon } from './icons';

import { t, LOCALE } from '../i18n';
const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'numeric', year: 'numeric' });

/** Veřejná stránka sdíleného portfolia (odkaz s #s=…) – jen ke čtení */
export function SharedView({ code }: { code: string }) {
  const [data, setData] = useState<SharedPortfolio | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    readShare(code)
      .then(setData)
      .catch(() => setError(t('Odkaz je poškozený nebo neúplný – zkus ho zkopírovat znovu celý.')));
  }, [code]);

  useEffect(() => {
    if (data) document.title = `${data.title} · SealedVault`;
  }, [data]);

  // částky jsou ve sdílení uložené v Kč; při € přepočet kurzem z okamžiku sdílení
  const fmt = (czk: number) =>
    data?.currency === 'EUR' && data.eurCzk ? displayMoney(czk / data.eurCzk, 'EUR') : displayMoney(Math.round(czk), 'CZK');

  return (
    <div className="app shared">
      <div className="bg-fx" aria-hidden>
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
        <span className="horizon" />
      </div>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href={import.meta.env.BASE_URL}>
            <Logo size={34} />
            <div>
              <h1>{t('Sealed')}<span className="brand-accent">{t('Vault')}</span></h1>
              <span>{t('Sdílené portfolio')}</span>
            </div>
          </a>
        </div>
      </header>

      <main className="shared-main">
        {error ? (
          <div className="empty-state">
            <h2>{t('Odkaz nefunguje')}</h2>
            <p>{error}</p>
            <a className="btn primary" href={import.meta.env.BASE_URL}>{t('Otevřít SealedVault')}</a>
          </div>
        ) : !data ? (
          <div className="skel skel-hero" />
        ) : (
          <>
            <section className="hero shared-hero">
              <span className="eyebrow">{data.title}</span>
              {data.totals.value != null && <div className="hero-value">{fmt(data.totals.value)}</div>}
              <div className="hero-change">
                {data.totals.profitPct != null && (
                  <span className={`pill ${tone(data.totals.profitPct)}`}>
                    <TrendIcon dir={tone(data.totals.profitPct)} />
                    {pct(data.totals.profitPct)}
                  </span>
                )}
                <span className="muted">
                  {plural(data.totals.positions ?? data.items.length, ['produkt', 'produkty', 'produktů'])}
                  {data.totals.pieces != null && t(' · {0} ks', data.totals.pieces)}
                  {data.updatedAt && t(' · stav k {0}', dateFmt.format(new Date(data.updatedAt)))}
                </span>
              </div>
            </section>

            <ul className="grid-cards shared-grid">
              {data.items.map((it, i) => (
                <li key={i} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                  <div className="gcard">
                    <span className="gcard-media">
                      {it.image ? (
                        <span className="avatar xl product"><img src={it.image} alt="" loading="lazy" referrerPolicy="no-referrer" /></span>
                      ) : (
                        <span className="avatar xl shared-ph">{it.type}</span>
                      )}
                      {it.profitPct != null && (
                        <span className={`pill sm ${tone(it.profitPct)} gcard-pill`}>
                          <TrendIcon dir={tone(it.profitPct)} />
                          {pct(it.profitPct)}
                        </span>
                      )}
                      {it.quantity != null && (
                        <span className="gcard-qty">
                          <span className={`qty-badge ${it.quantity > 1 ? 'multi' : ''}`}>{it.quantity}{t('×')}</span>
                        </span>
                      )}
                    </span>
                    <span className="gcard-body">
                      <span className="gcard-title">{it.name}</span>
                      <span className="row-sub">{[it.game, it.set || it.type].filter(Boolean).join(' · ')}</span>
                      {it.value != null && (
                        <span className="gcard-foot">
                          <span className="row-value">{fmt(it.value)}</span>
                        </span>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <section className="shared-cta">
              <Logo size={40} />
              <div>
                <b>{t('Sleduj i svoje sealed')}</b>
                <span>{t('Pokémon, One Piece a Riftbound – ceny z Cardmarketu a TCGplayeru, zdarma.')}</span>
              </div>
              <a className="btn primary" href={import.meta.env.BASE_URL}>{t('Vyzkoušet SealedVault')}</a>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
