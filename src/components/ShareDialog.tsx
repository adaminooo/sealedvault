import { useState } from 'react';
import type { Currency } from '../types';
import type { Position } from '../lib/portfolio';
import { buildPayload, createShareLink, type ShareOptions } from '../lib/share';
import { usePersistentState } from '../hooks/usePersistentState';

import { t } from '../i18n';
interface Props {
  positions: Position[];
  currency: Currency;
  eurCzk: number | null;
}

const Toggle = ({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) => (
  <label className="toggle-row">
    <span>
      <b>{label}</b>
      <em>{hint}</em>
    </span>
    <input type="checkbox" className="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
  </label>
);

/** Sdílení portfolia odkazem – uživatel vybere, co ukázat; snímek je zabalený přímo v odkazu */
export function ShareDialog({ positions, currency, eurCzk }: Props) {
  const [opts, setOpts] = usePersistentState<ShareOptions>('shareOptions', { title: 'Moje sbírka', values: true, profit: true, quantities: true });
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // změna nastavení = starý odkaz už neodpovídá
  const update = (o: ShareOptions) => {
    setOpts(o);
    setLink(null);
  };

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      setLink(await createShareLink(buildPayload(positions, opts, currency, eurCzk)));
      setMsg({ kind: 'ok', text: t('Odkaz je připravený.') });
    } catch (e) {
      setMsg({ kind: 'error', text: t('Nepodařilo se: {0}', e instanceof Error ? e.message : e) });
    } finally {
      setBusy(false);
    }
  }

  async function copyOrShare() {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: opts.title, url: link });
        return;
      } catch {
        /* zrušeno → zkopíruj */
      }
    }
    await navigator.clipboard?.writeText(link).catch(() => {});
    setMsg({ kind: 'ok', text: t('Odkaz zkopírován.') });
  }

  return (
    <div className="share">
      <p className="hint">
        {t('Vytvoř odkaz na svou sbírku. Ukáže se jen to, co držíš, a jen to, co zapneš níže. Nákupní ceny, poznámky ani vlastní fotky se nikdy nesdílí.')}
      </p>
      <label className="field">
        <span>{t('Název')}</span>
        <input value={opts.title} maxLength={80} onChange={(e) => update({ ...opts, title: e.target.value })} />
      </label>
      <div className="toggles">
        <Toggle on={opts.values} onChange={(v) => update({ ...opts, values: v })} label={t('Hodnoty')} hint={t('celková hodnota a hodnota produktů')} />
        <Toggle on={opts.profit} onChange={(v) => update({ ...opts, profit: v })} label={t('Zhodnocení v %')} hint={t('o kolik produkty vyrostly (bez částek nákupu)')} />
        <Toggle on={opts.quantities} onChange={(v) => update({ ...opts, quantities: v })} label={t('Počty kusů')} hint={t('kolik kusů od produktu máš')} />
      </div>

      {link && (
        <div className="share-link">
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <button className="btn sm" onClick={copyOrShare}>{t('Sdílet')}</button>
          <a className="btn sm ghost" href={link} target="_blank" rel="noreferrer">{t('Otevřít')}</a>
        </div>
      )}
      {msg && <p className={`banner ${msg.kind}`}>{msg.text}</p>}

      <div className="form-actions">
        <span className="spacer" />
        <button className="btn primary" onClick={create} disabled={busy}>
          {busy ? t('Připravuji…') : link ? t('Vytvořit znovu') : t('Vytvořit odkaz')}
        </button>
      </div>
      <p className="hint">
        {t('Odkaz ukazuje stav portfolia z okamžiku vytvoření a data nikam neukládáme. Po změnách v portfoliu vytvoř nový odkaz.')}
      </p>
    </div>
  );
}
