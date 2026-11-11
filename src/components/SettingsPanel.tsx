import { useState } from 'react';
import type { Currency, PortfolioItem, WishlistItem } from '../types';
import { enableNotifications, notificationsSupported } from '../lib/alerts';
import { SOURCE_LABEL, type MarketSnapshot, type Valuation } from '../lib/market';
import { APP_FULL_NAME, APP_VERSION, SUPPORT_EMAIL, diagnostics, mailtoUrl } from '../config';
import { DataPanel } from './DataPanel';
import { plural } from '../lib/format';
import { CrownIcon, Logo } from './icons';
import { TRIAL_DAYS, usePremium } from '../lib/premium';
import { MAIN_ID, type Portfolio } from '../lib/portfolios';
import { PremiumTag } from './PremiumLock';

import { t, LOCALE, LANG, setLang } from '../i18n';
interface Props {
  items: PortfolioItem[];
  currency: Currency;
  onCurrency: (c: Currency) => void;
  market: MarketSnapshot | null;
  marketLoading: boolean;
  marketError: string | null;
  unlinked: number;
  onRefresh: () => void;
  onAutoLink: () => void;
  wishlist: WishlistItem[];
  valuation: Valuation;
  onValuation: (v: Valuation) => void;
  onImport: (items: PortfolioItem[], mode: 'merge' | 'replace', wishlist: WishlistItem[]) => Promise<void>;
  portfolios: Portfolio[];
  counts: Record<string, number>;
  onRenamePortfolio: (id: string, name: string) => void;
  onDeletePortfolio: (id: string) => void;
}

/** Stav Premium + přepnutí do verze zdarma */
function PremiumSection() {
  const { isPremium, trialUsed, daysLeft, openPaywall, endTrial } = usePremium();
  return (
    <section className="set-group pm-set">
      <header>
        <CrownIcon />
        <h3>{t('SealedVault Premium')}</h3>
      </header>
      <div className="set-row">
        <div>
          <b>{isPremium ? t('Aktivní – zkušební verze, zbývá {0}', plural(daysLeft, ['den', 'dny', 'dní'])) : trialUsed ? t('Verze zdarma') : t('Verze zdarma')}</b>
          <span>
            {isPremium
              ? t('Máš odemčenou pokročilou analytiku, celou historii grafů, alerty, více portfolií a CSV exporty.')
              : trialUsed
                ? t('Zkušební verze skončila. Tvoje data zůstala – zamčené funkce odemkne Premium.')
                : t('Vyzkoušej Premium {0} dní zdarma, bez karty.', TRIAL_DAYS)}
          </span>
        </div>
        <button className="btn sm primary" onClick={() => openPaywall()}>
          {isPremium ? t('Detail') : trialUsed ? t('Premium') : t('Vyzkoušet')}
        </button>
      </div>
      {isPremium && (
        <button className="link-btn" onClick={() => confirm(t('Ukončit zkušební verzi a přepnout na verzi zdarma? Znovu ji spustit nepůjde.')) && endTrial()}>
          {t('Ukončit zkušební verzi')}
        </button>
      )}
    </section>
  );
}

/** Správa portfolií (Premium) */
function PortfoliosSection({ portfolios, counts, onRename, onDelete }: { portfolios: Portfolio[]; counts: Record<string, number>; onRename: (id: string, name: string) => void; onDelete: (id: string) => void }) {
  const { isPremium, openPaywall } = usePremium();
  return (
    <section className="set-group">
      <header>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 7h18v13H3zM8 7V4h8v3" />
        </svg>
        <h3>{t('Portfolia')}</h3>
        {!isPremium && <PremiumTag />}
      </header>
      <ul className="pf-manage">
        {portfolios.map((p) => (
          <li key={p.id}>
            <input
              defaultValue={p.name}
              maxLength={30}
              disabled={!isPremium}
              aria-label={t('Název portfolia')}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== p.name) onRename(p.id, v);
                else e.target.value = p.name;
              }}
            />
            <span className="hint">{plural(counts[p.id] ?? 0, ['položka', 'položky', 'položek'])}</span>
            {p.id !== MAIN_ID && isPremium && (
              <button
                className="btn sm ghost danger-text"
                onClick={() => confirm(t('Smazat portfolio „{0}“? Jeho položky se přesunou do Hlavního.', p.name)) && onDelete(p.id)}
              >
                {t('Smazat')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {!isPremium && (
        <button className="btn sm" onClick={() => openPaywall('portfolios')}>
          <CrownIcon size={14} /> {t('Více portfolií s Premium')}
        </button>
      )}
    </section>
  );
}

/** Systémové notifikace pro cenové alerty */
function NotificationsRow() {
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(notificationsSupported() ? Notification.permission : 'unsupported');
  return (
    <div className="set-row">
      <div>
        <b>{t('Notifikace v systému')}</b>
        <span>
          {perm === 'granted'
            ? t('Zapnuto – při splnění alertu dostaneš oznámení (když je appka otevřená nebo na pozadí).')
            : perm === 'denied'
              ? t('Zablokováno v nastavení prohlížeče / telefonu.')
              : perm === 'unsupported'
                ? t('Tento prohlížeč notifikace nepodporuje (na iPhonu fungují v appce přidané na plochu, iOS 16.4+).')
                : t('Alerty uvidíš vždy ve zvonečku. Můžeš povolit i oznámení systému.')}
        </span>
      </div>
      {perm === 'default' && (
        <button className="btn sm" onClick={async () => setPerm(await enableNotifications())}>
          {t('Povolit')}
        </button>
      )}
    </div>
  );
}

const rateFmt = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'numeric', year: 'numeric' });

const Icon = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

export function SettingsPanel(p: Props) {
  const [copied, setCopied] = useState(false);
  const diag = () => diagnostics({ Položek: p.items.length, 'Ceny z': p.market ? dateFmt.format(new Date(p.market.priceDate)) : 'nenačteno' });

  return (
    <div className="settings">
      <PremiumSection />

      {/* Měna */}
      <section className="set-group">
        <header>
          <Icon d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          <h3>{t('Měna')}</h3>
        </header>
        <div className="set-row">
          <div>
            <b>{t('Zobrazovat ceny v')}</b>
            <span>
              {t('Ukládá se v Kč, € se přepočítává kurzem ČNB')}
              {p.market?.eurCzk ? t(' (1 € = {0} Kč)', rateFmt.format(p.market.eurCzk)) : ''}.
            </span>
          </div>
          <div className="segmented">
            <button className={p.currency === 'CZK' ? 'active' : ''} onClick={() => p.onCurrency('CZK')}>{t('Kč')}</button>
            <button className={p.currency === 'EUR' ? 'active' : ''} onClick={() => p.onCurrency('EUR')}>€</button>
          </div>
        </div>
      </section>

      {/* Jazyk */}
      <section className="set-group">
        <header>
          <Icon d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
          <h3>Jazyk · Language</h3>
        </header>
        <div className="set-row">
          <div>
            <b>{t('Jazyk appky')}</b>
            <span>{t('Čeština / English')}</span>
          </div>
          <div className="segmented">
            <button className={LANG === 'cs' ? 'active' : ''} onClick={() => LANG !== 'cs' && setLang('cs')}>Čeština</button>
            <button className={LANG === 'en' ? 'active' : ''} onClick={() => LANG !== 'en' && setLang('en')}>English</button>
          </div>
        </div>
      </section>

      {/* Upozornění */}
      <section className="set-group">
        <header>
          <Icon d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />
          <h3>{t('Cenová upozornění')}</h3>
        </header>
        <NotificationsRow />
      </section>

      {/* Ceny z trhu */}
      <section className="set-group">
        <header>
          <Icon d="M3 3v18h18M7 15l4-4 3 3 5-6" />
          <h3>{t('Ceny z trhu')}</h3>
        </header>
        {p.market ? (
          <ul className="set-list-rows">
            {p.market.sources.map((s) => (
              <li key={s.game}>
                <b>{s.game}</b>
                <span>
                  {SOURCE_LABEL[s.source]} · {s.currency} · {dateFmt.format(new Date(s.priceDate))}
                </span>
              </li>
            ))}
            <li>
              <b>{t('Kurzy ČNB')}</b>
              <span>
                1 € = {p.market.eurCzk ? rateFmt.format(p.market.eurCzk) : '?'} {t('Kč · 1 $ =')} {p.market.usdCzk ? rateFmt.format(p.market.usdCzk) : '?'} {t('Kč')}
              </span>
            </li>
          </ul>
        ) : (
          <p className="hint">{p.marketError ?? t('Ceny se načítají…')}</p>
        )}
        <div className="row start">
          <button className="btn sm" onClick={p.onRefresh} disabled={p.marketLoading}>
            {p.marketLoading ? t('Načítám…') : t('Obnovit ceny')}
          </button>
          {p.unlinked > 0 && (
            <button className="btn sm" onClick={p.onAutoLink}>
              {t('Spárovat automaticky (')}{p.unlinked})
            </button>
          )}
        </div>
        <p className="hint">{t('Jen anglické verze. Pokémon a One Piece z Cardmarketu (EU), Riftbound z TCGplayeru (USA).')}</p>
        <div className="set-row">
          <div>
            <b>{t('Ocenění produktů')}</b>
            <span>
              {p.valuation === 'main'
                ? t('Cena z hlavního trhu (výše).')
                : p.valuation === 'avg'
                  ? t('Průměr hlavního trhu a druhého trhu (TCGplayer / Cardmarket), kde je k dispozici.')
                  : t('Nižší z obou trhů – konzervativní odhad hodnoty.')}
            </span>
          </div>
          <div className="segmented sm">
            <button className={p.valuation === 'main' ? 'active' : ''} onClick={() => p.onValuation('main')}>{t('Hlavní')}</button>
            <button className={p.valuation === 'avg' ? 'active' : ''} onClick={() => p.onValuation('avg')}>{t('Průměr')}</button>
            <button className={p.valuation === 'min' ? 'active' : ''} onClick={() => p.onValuation('min')}>{t('Nižší')}</button>
          </div>
        </div>
      </section>

      <PortfoliosSection portfolios={p.portfolios} counts={p.counts} onRename={p.onRenamePortfolio} onDelete={p.onDeletePortfolio} />

      {/* Záloha */}
      <section className="set-group">
        <header>
          <Icon d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          <h3>{t('Záloha a obnova')}</h3>
        </header>
        <DataPanel items={p.items} wishlist={p.wishlist} onImport={p.onImport} />
      </section>

      {/* Podpora */}
      <section className="set-group support">
        <header>
          <Icon d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm18 2-10 7L2 6" />
          <h3>{t('Podpora')}</h3>
        </header>
        <p className="hint">{t('Máš dotaz, nápad nebo něco nefunguje? Napiš nám – do e-mailu se automaticky přidají technické údaje, které pomůžou s řešením.')}</p>
        <div className="support-actions">
          <a
            className="btn primary"
            href={mailtoUrl(`${APP_FULL_NAME} – dotaz`, `Ahoj,\n\n\n\n---\n${diag()}`)}
          >
            <Icon d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
            {t('Napsat podpoře')}
          </a>
          <a
            className="btn"
            href={mailtoUrl(
              `${APP_FULL_NAME} – nahlášení chyby`,
              `Co se stalo:\n\n\nCo jsem čekal(a):\n\n\nJak chybu zopakovat (kroky):\n1.\n2.\n\n---\n${diag()}`,
            )}
          >
            <Icon d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            {t('Nahlásit chybu')}
          </a>
        </div>
        <button
          className="support-mail"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(SUPPORT_EMAIL);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              /* schránka nedostupná */
            }
          }}
          title={t('Zkopírovat adresu')}
        >
          {SUPPORT_EMAIL}
          <span>{copied ? t('Zkopírováno ✓') : t('Kopírovat')}</span>
        </button>
      </section>

      {/* O aplikaci */}
      <section className="set-group about">
        <div className="about-head">
          <Logo size={44} />
          <div>
            <b>{APP_FULL_NAME}</b>
            <span>{t('Verze')} {APP_VERSION}</span>
          </div>
        </div>
        <p className="hint">
          {t('Tvoje data zůstávají jen v tomto zařízení. Ceny: Cardmarket, TCGplayer (přes tcgcsv.com), starší historie cen z archivu TCGCSV, kurzy ČNB. Loga edic: pokemontcg.io. SealedVault není spojen s The Pokémon Company ani Riot Games.')}
        </p>
      </section>
    </div>
  );
}
