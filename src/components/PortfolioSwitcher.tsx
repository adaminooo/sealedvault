import { useState } from 'react';
import { usePremium } from '../lib/premium';
import { ALL_ID, type Portfolio } from '../lib/portfolios';
import { CrownIcon, PlusIcon } from './icons';

import { t } from '../i18n';
interface Props {
  portfolios: Portfolio[];
  active: string;
  counts: Record<string, number>;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
}

/** Přepínač portfolií (Premium) – „Vše“, jednotlivá portfolia, nové */
export function PortfolioSwitcher({ portfolios, active, counts, onSelect, onCreate }: Props) {
  const { isPremium, openPaywall } = usePremium();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const multi = portfolios.length > 1;

  const submit = () => {
    const n = name.trim().slice(0, 30);
    if (n) onCreate(n);
    setName('');
    setAdding(false);
  };

  const select = (id: string) => (isPremium ? onSelect(id) : openPaywall('portfolios'));

  return (
    <div className="pf-switch" role="tablist" aria-label={t('Portfolia')}>
      {multi && (
        <button role="tab" aria-selected={active === ALL_ID} className={active === ALL_ID ? 'active' : ''} onClick={() => onSelect(ALL_ID)}>
          {t('Vše')}
        </button>
      )}
      {portfolios.map((p) => (
        <button
          key={p.id}
          role="tab"
          aria-selected={active === p.id || (!multi && active === ALL_ID)}
          className={active === p.id || (!multi && active === ALL_ID) ? 'active' : ''}
          onClick={() => (multi ? select(p.id) : undefined)}
        >
          {t(p.name)}
          <span className="pf-count">{counts[p.id] ?? 0}</span>
        </button>
      ))}
      {adding ? (
        <form
          className="pf-new"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input autoFocus value={name} maxLength={30} placeholder={t('Název portfolia')} onChange={(e) => setName(e.target.value)} onBlur={submit} />
        </form>
      ) : (
        <button className="pf-add" onClick={() => (isPremium ? setAdding(true) : openPaywall('portfolios'))}>
          <PlusIcon /> {multi ? t('Nové') : t('Další portfolio')}
          {!isPremium && <CrownIcon size={12} />}
        </button>
      )}
    </div>
  );
}
