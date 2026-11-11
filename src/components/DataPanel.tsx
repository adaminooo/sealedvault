import { useRef, useState } from 'react';
import type { PortfolioItem, WishlistItem } from '../types';
import { usePremium } from '../lib/premium';
import { plural } from '../lib/format';
import { PremiumTag } from './PremiumLock';
import { backupFilename, download, parseBackup, parseWishlist, toCsv, toJson } from '../lib/backup';

import { t } from '../i18n';
interface Props {
  items: PortfolioItem[];
  wishlist: WishlistItem[];
  onImport: (items: PortfolioItem[], mode: 'merge' | 'replace', wishlist: WishlistItem[]) => Promise<void>;
}

export function DataPanel({ items, wishlist, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { isPremium, openPaywall } = usePremium();
  const [pending, setPending] = useState<PortfolioItem[] | null>(null);
  const [pendingWish, setPendingWish] = useState<WishlistItem[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function handleFile(file: File) {
    setMsg(null);
    try {
      const text = await file.text();
      const parsed = parseBackup(file.name, text);
      setPending(parsed);
      setPendingWish(parseWishlist(text));
    } catch (e) {
      setMsg({ kind: 'error', text: t('Import selhal: {0}', e instanceof Error ? e.message : String(e)) });
    }
  }

  async function confirmImport(mode: 'merge' | 'replace') {
    if (!pending) return;
    await onImport(pending, mode, pendingWish);
    setMsg({ kind: 'ok', text: t('Importováno {0} ({1}).', plural(pending.length, ['položka', 'položky', 'položek']), mode === 'merge' ? t('sloučeno') : t('nahrazeno')) });
    setPending(null);
  }

  return (
    <div className="data-panel">
      <section>
        <h4>{t('Záloha (export)')}</h4>
        <p className="hint">{t('JSON je kompletní záloha pro obnovu. CSV otevřeš v Excelu / Google Sheets.')}</p>
        <div className="row">
          <button className="btn" disabled={!items.length} onClick={() => download(backupFilename('json'), toJson(items, wishlist), 'application/json')}>
            {t('Stáhnout JSON')}
          </button>
          <button
            className="btn"
            disabled={!items.length}
            onClick={() => (isPremium ? download(backupFilename('csv'), toCsv(items), 'text/csv;charset=utf-8') : openPaywall('export'))}
          >
            {t('Stáhnout CSV')} {!isPremium && <PremiumTag />}
          </button>
        </div>
      </section>

      <section>
        <h4>{t('Obnova (import)')}</h4>
        <p className="hint">{t('Načti dříve exportovaný JSON nebo CSV soubor.')}</p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
        {!pending && (
          <button className="btn" onClick={() => fileRef.current?.click()}>
            {t('Vybrat soubor…')}
          </button>
        )}
        {pending && (
          <div className="import-confirm">
            <p>
              {t('Soubor obsahuje')} <b>{pending.length}</b> {t('položek. Co s nimi?')}
            </p>
            <div className="row">
              <button className="btn primary" onClick={() => confirmImport('merge')}>
                {t('Sloučit')}
              </button>
              <button className="btn danger" onClick={() => confirmImport('replace')}>
                {t('Nahradit vše (')}{items.length})
              </button>
              <button className="btn ghost" onClick={() => setPending(null)}>
                {t('Zrušit')}
              </button>
            </div>
            <p className="hint">{t('Sloučit = přidá nové a přepíše položky se stejným ID. Nahradit = smaže současná data.')}</p>
          </div>
        )}
      </section>

      {msg && <p className={`banner ${msg.kind}`}>{msg.text}</p>}

      <p className="hint">{t('Data jsou uložená jen v tomto prohlížeči / zařízení. Exportem si je zálohuješ nebo přeneseš na jiné zařízení.')}</p>
    </div>
  );
}
