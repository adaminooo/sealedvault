import { useState } from 'react';
import { PREMIUM_PRICE, APP_FULL_NAME, mailtoUrl } from '../config';
import { TRIAL_DAYS, usePremium, type PremiumFeature } from '../lib/premium';
import { CrownIcon } from './icons';

import { t } from '../i18n';
const I = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

export const FEATURES: { id: PremiumFeature; icon: string; title: string; text: string; free: string }[] = [
  {
    id: 'analytics',
    icon: 'M3 3v18h18M7 15l4-4 3 3 6-7',
    title: 'Pokročilá analytika',
    text: t('Roční zhodnocení (XIRR), nejlepší a nejslabší kusy, výkon po sériích, likvidační hodnota a koncentrace rizika.'),
    free: 'Zdarma: celkový zisk a základní přehled',
  },
  {
    id: 'history',
    icon: 'M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
    title: 'Celá historie grafů',
    text: t('Vývoj portfolia i cen produktů za 6 měsíců, rok i od prvního nákupu.'),
    free: 'Zdarma: poslední 1 a 3 měsíce',
  },
  {
    id: 'alerts',
    icon: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
    title: 'Cenové alerty',
    text: t('Upozornění, když cena stoupne nad nebo klesne pod tvoji hranici, a když produkt z wishlistu dosáhne cílové ceny.'),
    free: 'Zdarma: bez upozornění',
  },
  {
    id: 'portfolios',
    icon: 'M3 7h18v13H3zM8 7V4h8v3',
    title: 'Více portfolií',
    text: t('Oddělené sbírky – třeba Investice, Na otevření nebo Pro brášku – s vlastní hodnotou a analýzou.'),
    free: 'Zdarma: jedno portfolio',
  },
  {
    id: 'export',
    icon: 'M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
    title: 'Exporty do CSV',
    text: t('Tabulky pro Excel / Google Sheets – pozice, nákupy, prodeje. Hodí se i na daně.'),
    free: 'Zdarma: JSON záloha dat',
  },
];

/** Okno SealedVault Premium – výhody, ceny, zkušební verze */
export function PremiumDialog({ feature }: { feature: PremiumFeature | 'general' }) {
  const { isPremium, trialUsed, daysLeft, startTrial, closePaywall } = usePremium();
  const [plan, setPlan] = useState<'yearly' | 'monthly'>('yearly');
  const saving = Math.round((1 - PREMIUM_PRICE.yearly / (PREMIUM_PRICE.monthly * 12)) * 100);
  const order = feature === 'general' ? FEATURES : [...FEATURES].sort((a, b) => (a.id === feature ? -1 : b.id === feature ? 1 : 0));

  return (
    <div className="premium">
      <div className="pm-hero">
        <span className="pm-crown"><CrownIcon size={28} /></span>
        <h2>
          {t('SealedVault')} <span>{t('Premium')}</span>
        </h2>
        <p>{t('Pro sběratele, kteří to s portfoliem myslí vážně.')}</p>
        {isPremium && <span className="pm-status">{t('Aktivní · zkušební verze, zbývá')} {daysLeft} {daysLeft === 1 ? 'den' : daysLeft < 5 ? 'dny' : t('dní')}</span>}
      </div>

      <ul className="pm-features">
        {order.map((f) => (
          <li key={f.id} className={f.id === feature ? 'hl' : ''}>
            <span className="pm-ic"><I d={f.icon} /></span>
            <div>
              <b>{t(f.title)}</b>
              <p>{t(f.text)}</p>
              <em>{t(f.free)}</em>
            </div>
          </li>
        ))}
      </ul>

      {!isPremium && (
        <>
          <div className="pm-plans" role="radiogroup" aria-label={t('Předplatné')}>
            <button role="radio" aria-checked={plan === 'yearly'} className={plan === 'yearly' ? 'active' : ''} onClick={() => setPlan('yearly')}>
              <span className="pm-badge">−{saving} %</span>
              <b>{t('Ročně')}</b>
              <strong>{PREMIUM_PRICE.yearly} {t('Kč')}</strong>
              <em>{Math.round(PREMIUM_PRICE.yearly / 12)} {t('Kč měsíčně')}</em>
            </button>
            <button role="radio" aria-checked={plan === 'monthly'} className={plan === 'monthly' ? 'active' : ''} onClick={() => setPlan('monthly')}>
              <b>{t('Měsíčně')}</b>
              <strong>{PREMIUM_PRICE.monthly} {t('Kč')}</strong>
              <em>{t('zrušíš kdykoliv')}</em>
            </button>
          </div>

          {!trialUsed ? (
            <button
              className="btn primary pm-cta"
              onClick={() => {
                startTrial();
                closePaywall();
              }}
            >
              <CrownIcon /> {t('Vyzkoušet')} {TRIAL_DAYS} {t('dní zdarma')}
            </button>
          ) : (
            <a
              className="btn primary pm-cta"
              href={mailtoUrl(`${APP_FULL_NAME} – zájem o Premium`, `Ahoj,\n\nmám zájem o Premium (${plan === 'yearly' ? 'ročně' : 'měsíčně'}). Dejte mi vědět, až půjde koupit.\n`)}
            >
              {t('Chci Premium – dejte mi vědět')}
            </a>
          )}
          <p className="hint pm-note">
            {trialUsed
              ? t('Zkušební verze skončila. Platby právě připravujeme – napiš nám a ozveme se jako prvním.')
              : t('Bez karty a bez závazku. Po skončení se appka vrátí do verze zdarma a žádná data nezmizí.')}
          </p>
        </>
      )}
      {isPremium && (
        <button className="btn pm-cta" onClick={closePaywall}>
          {t('Pokračovat')}
        </button>
      )}
    </div>
  );
}
