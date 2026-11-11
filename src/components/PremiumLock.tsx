import type { ReactNode } from 'react';
import { usePremium, type PremiumFeature } from '../lib/premium';
import { CrownIcon } from './icons';

import { t } from '../i18n';
interface Props {
  feature: PremiumFeature;
  title: string;
  text: string;
  children: ReactNode;
}

/** Obsah jen pro Premium: ve verzi zdarma je rozmazaný s výzvou k odemčení */
export function PremiumLock({ feature, title, text, children }: Props) {
  const { isPremium, openPaywall } = usePremium();
  if (isPremium) return <>{children}</>;
  return (
    <div className="pm-lock">
      <div className="pm-lock-content" aria-hidden inert>
        {children}
      </div>
      <div className="pm-lock-card">
        <span className="pm-crown sm"><CrownIcon /></span>
        <b>{title}</b>
        <p>{text}</p>
        <button className="btn primary sm" onClick={() => openPaywall(feature)}>
          {t('Odemknout Premium')}
        </button>
      </div>
    </div>
  );
}

/** Malý štítek Premium vedle zamčeného ovládání */
export function PremiumTag() {
  return (
    <span className="pm-tag" aria-label={t('Premium')}>
      <CrownIcon size={11} />
    </span>
  );
}
