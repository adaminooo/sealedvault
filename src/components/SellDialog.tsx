import { useState } from 'react';
import type { Currency } from '../types';
import type { Position, SaleInput } from '../lib/portfolio';
import { allocateSale } from '../lib/portfolio';
import { fromDisplay, money, signedMoney, toDisplay, tone } from '../lib/format';
import type { PortfolioItem } from '../types';

import { t } from '../i18n';
interface Props {
  position: Position;
  currency: Currency;
  onSave: (updatedLots: PortfolioItem[], realized: number) => Promise<void> | void;
  onCancel: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const parseNum = (s: string) => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};
const numStr = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

/** Prodej kusů z pozice – automaticky z nejstarších dávek (FIFO) */
export function SellDialog({ position, currency, onSave, onCancel }: Props) {
  const held = position.stats.held;
  const cur = currency === 'CZK' ? t('Kč') : '€';
  const [qty, setQty] = useState(String(Math.min(1, held)));
  const [price, setPrice] = useState(numStr(toDisplay(position.head.currentPrice, currency)));
  const [fees, setFees] = useState('');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = parseInt(qty, 10);
  const p = parseNum(price);
  const f = fees.trim() ? parseNum(fees) : 0;
  const valid = Number.isInteger(q) && q >= 1 && q <= held && Number.isFinite(p) && p >= 0 && Number.isFinite(f) && f >= 0;
  const input: SaleInput | null = valid ? { date, quantity: q, price: fromDisplay(p, currency), fees: fromDisplay(f, currency), note: note.trim() || undefined } : null;
  const preview = input ? allocateSale(position.lots, input) : null;
  const revenue = input ? input.quantity * input.price - input.fees : 0;

  async function submit() {
    if (!input || !preview) return setError(t('Zadej počet 1–{0} a platnou cenu.', held));
    setSaving(true);
    try {
      await onSave(preview.updated, preview.realized);
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  }

  return (
    <div className="qform sell">
      <p className="hint">
        {t('Prodáváš z')} <b>{position.name}</b> {t('– držíš')} {held} {t('ks. Kusy se odečtou od nejstarších nákupů (FIFO).')}
      </p>
      <div className="qty-price">
        <div className="field">
          <span>{t('Počet')}</span>
          <div className="stepper">
            <button type="button" onClick={() => setQty(String(Math.max(1, (q || 1) - 1)))} disabled={q <= 1}>−</button>
            <input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} aria-label={t('Počet kusů')} />
            <button type="button" onClick={() => setQty(String(Math.min(held, (q || 0) + 1)))} disabled={q >= held}>+</button>
          </div>
        </div>
        <label className="field grow">
          <span>{t('Prodejní cena / ks')}</span>
          <div className="money-input">
            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            <span>{cur}</span>
          </div>
        </label>
      </div>
      <div className="form">
        <label className="field">
          <span>{t('Datum prodeje')}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('Poplatky + poštovné (')}{cur})</span>
          <input inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} placeholder={t('celkem')} />
        </label>
        <label className="field span-2">
          <span>{t('Poznámka')}</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('např. prodáno na Cardmarketu')} />
        </label>
      </div>

      {preview && (
        <div className="sell-preview">
          <div>
            <span>{t('Tržba po poplatcích')}</span>
            <b>{money(revenue, currency)}</b>
          </div>
          <div>
            <span>{t('Pořizovací cena prodaných kusů')}</span>
            <b>{money(revenue - preview.realized, currency)}</b>
          </div>
          <div className={`big ${tone(preview.realized)}`}>
            <span>{t('Realizovaný zisk')}</span>
            <b>{signedMoney(preview.realized, currency)}</b>
          </div>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>{t('Zrušit')}</button>
        <span className="spacer" />
        <button type="button" className="btn primary" disabled={!valid || saving} onClick={submit}>
          {t('Prodat')} {valid ? `${q} ks` : ''}
        </button>
      </div>
    </div>
  );
}
