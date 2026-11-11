import { useEffect, useMemo, useState } from 'react';
import { conditionTone, type Currency, type PortfolioItem } from '../types';
import type { HistoryData, Position } from '../lib/portfolio';
import { heldQty, itemStats, unitCost } from '../lib/calc';
import { fetchHistory, HISTORY_START } from '../lib/history';
import { date, displayMoney, fromDisplay, getEurRate, money, pct, signedMoney, tone, toDisplay } from '../lib/format';
import {
  formatSource,
  marketPrice,
  productUrl,
  SOURCE_LABEL,
  toCzk,
  type AltQuote,
  type MarketProduct,
  type MarketSnapshot,
  type Valuation,
} from '../lib/market';
import { ProductImage } from './ProductImage';
import { LineChart, type ChartSeries } from './LineChart';
import { CrownIcon, LockIcon, TrendIcon, BellIcon, ExternalIcon } from './icons';
import { usePremium } from '../lib/premium';
import { portfolioOf, type Portfolio } from '../lib/portfolios';
import { PremiumTag } from './PremiumLock';

import { t, LOCALE } from '../i18n';
/** Verze zdarma: kolik dní historie ceny je vidět */
const FREE_HISTORY_DAYS = 91;

interface Props {
  position: Position;
  currency: Currency;
  market: MarketSnapshot | null;
  onEditLot: (lot: PortfolioItem) => void;
  onSell: () => void;
  onAddLot: () => void;
  /** Hranice cenového alertu (Kč) – undefined = vypnuto */
  onSaveAlerts: (above: number | undefined, below: number | undefined) => void;
  /** Portfolia pro přesun (jen Premium s více portfolii) */
  portfolios?: Portfolio[];
  onMove?: (to: string) => void;
  /** Cena na druhém trhu */
  alt: AltQuote | null;
  valuation: Valuation;
}

const VALUATION_LABEL: Record<Valuation, string> = { main: 'hlavní trh', avg: 'průměr trhů', min: 'nižší z trhů' };

/** Porovnání cen stejného produktu na Cardmarketu a TCGplayeru */
function MarketCompare({ mp, alt, market, currency, valuation }: { mp: MarketProduct | undefined; alt: AltQuote | null; market: MarketSnapshot | null; currency: Currency; valuation: Valuation }) {
  if (!mp || !market) return null;
  const main = marketPrice(mp);
  const rows = [
    main != null && { label: SOURCE_LABEL[mp.source], currency: mp.currency, price: main, low: mp.low, url: productUrl(mp), tag: t('hlavní') },
    alt && { label: SOURCE_LABEL[alt.source], currency: alt.currency, price: alt.price, low: alt.low, url: alt.url, tag: t('srovnání') },
  ].filter(Boolean) as { label: string; currency: MarketProduct['currency']; price: number; low: number | null; url: string; tag: string }[];
  if (!rows.length) return null;
  const czk = rows.map((r) => toCzk(r.price, r.currency, market));
  const diff = czk.length === 2 && czk[0] > 0 ? ((czk[1] - czk[0]) / czk[0]) * 100 : null;
  return (
    <section className="card-lite pd-markets">
      <header>
        <h3>{t('Ceny na trzích')}</h3>
        <span className="hint">{t('ocenění:')} {t(VALUATION_LABEL[valuation])}</span>
      </header>
      <ul>
        {rows.map((r, i) => (
          <li key={r.label}>
            <span className="mk-name">
              <b>{r.label}</b>
              <em>{r.tag}</em>
            </span>
            <span className="mk-price">
              <b>{money(czk[i], currency)}</b>
              <em>
                {formatSource(r.price, r.currency)}
                {r.low != null && t(' · od {0}', formatSource(r.low, r.currency))}
              </em>
            </span>
            <a href={r.url} target="_blank" rel="noreferrer" className="icon-btn sm" aria-label={t('Otevřít na {0}', r.label)}><ExternalIcon size={14} /></a>
          </li>
        ))}
      </ul>
      {diff != null && (
        <p className="hint">
          {rows[1].label} {t('je')} {Math.abs(diff) < 1 ? t('prakticky stejně') : diff > 0 ? t('o {0} % dráž', Math.round(diff)) : t('o {0} % levněji', Math.round(-diff))} {t('než')} {rows[0].label}.
        </p>
      )}
      {!alt && <p className="hint">{t('Na druhém trhu se tenhle produkt nepodařilo jednoznačně najít.')}</p>}
    </section>
  );
}

const parseNum = (s: string) => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
const shownNum = (czk: number | undefined, c: Currency) =>
  czk ? String(Math.round(toDisplay(czk, c) * 100) / 100).replace('.', ',') : '';

/** Fotky všech dávek + náhled přes celou obrazovku */
function Gallery({ photos }: { photos: string[] }) {
  const [idx, setIdx] = useState<number | null>(null);
  useEffect(() => {
    if (idx == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIdx(null);
      if (e.key === 'ArrowRight') setIdx((i) => (i! + 1) % photos.length);
      if (e.key === 'ArrowLeft') setIdx((i) => (i! - 1 + photos.length) % photos.length);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [idx, photos.length]);
  if (!photos.length) return null;
  return (
    <>
      <div className="pd-gallery">
        {photos.map((src, i) => (
          <button key={i} onClick={() => setIdx(i)} aria-label={t('Fotka {0}', i + 1)}>
            <img src={src} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      {idx != null && (
        <div className="lightbox" onClick={() => setIdx(null)}>
          <img src={photos[idx]} alt="" onClick={(e) => e.stopPropagation()} />
          {photos.length > 1 && (
            <>
              <button className="lb-nav prev" onClick={(e) => { e.stopPropagation(); setIdx((idx - 1 + photos.length) % photos.length); }} aria-label={t('Předchozí')}>‹</button>
              <button className="lb-nav next" onClick={(e) => { e.stopPropagation(); setIdx((idx + 1) % photos.length); }} aria-label={t('Další')}>›</button>
            </>
          )}
          <span className="lb-count">{idx + 1} / {photos.length}</span>
        </div>
      )}
    </>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const ts = (d: string) => new Date(d + 'T12:00:00Z').getTime();
const recFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'numeric', year: 'numeric' });

/** Kurz k datu – poslední známý (víkendy a svátky přebírají předchozí den) */
export function rateLookup(rates: HistoryData['rates']) {
  const days = Object.keys(rates).sort();
  return (d: string, which: 0 | 1): number | null => {
    let lo = 0;
    let hi = days.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (days[mid] <= d) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found >= 0 ? rates[days[found]][which] : null;
  };
}

/** Detail produktu: graf ceny, nákupní dávky, prodeje */
export function PositionDetail({ position: p, currency, market, onEditLot, onSell, onAddLot, onSaveAlerts, alt, valuation, portfolios, onMove }: Props) {
  const { isPremium, openPaywall } = usePremium();
  // verze zdarma: graf ceny za poslední 3 měsíce
  const [range, setRange] = useState<'3M' | '1R' | 'ALL'>(isPremium ? 'ALL' : '3M');
  const RANGE_DAYS = { '3M': FREE_HISTORY_DAYS, '1R': 365, ALL: 0 };
  const shownRange = isPremium ? range : '3M';
  const histCutoff = RANGE_DAYS[shownRange] ? new Date(Date.now() - RANGE_DAYS[shownRange] * 864e5).toISOString().slice(0, 10) : '';
  const curAbove = p.lots.find((l) => l.alertAbove)?.alertAbove;
  const curBelow = p.lots.find((l) => l.alertBelow)?.alertBelow;
  const [above, setAbove] = useState(shownNum(curAbove, currency));
  const [below, setBelow] = useState(shownNum(curBelow, currency));
  const alertsDirty = above !== shownNum(curAbove, currency) || below !== shownNum(curBelow, currency);
  const cur = currency === 'CZK' ? t('Kč') : '€';
  const photos = p.lots.flatMap((l) => [...(l.image ? [l.image] : []), ...(l.photos ?? [])]);
  const head = p.head;
  const id = head.cmProductId;
  const mp = id && market ? market.byId.get(id) : undefined;
  // historie ceny produktu co nejdál zpátky (ne jen od nákupu)
  const from = HISTORY_START;
  const [hist, setHist] = useState<HistoryData | null>(null);
  const [histErr, setHistErr] = useState(false);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    fetchHistory([id], from)
      .then((h) => alive && setHist(h))
      .catch(() => alive && setHistErr(true));
    return () => {
      alive = false;
    };
  }, [id, from]);

  const series = useMemo<ChartSeries[]>(() => {
    const now = today();
    const rate = hist ? rateLookup(hist.rates) : null;
    const usd = !!id && id >= 1e9;
    const pts: { x: number; y: number | null }[] = [];
    for (const [d, native] of hist?.series[String(id)] ?? []) {
      if (d === now || d < histCutoff) continue;
      const r = rate?.(d, usd ? 1 : 0);
      const eur = rate?.(d, 0);
      if (!r) continue;
      const czk = native * r;
      pts.push({ x: ts(d), y: currency === 'EUR' ? (usd ? czk / (eur || getEurRate()) : native) : czk });
    }
    pts.push({ x: ts(now), y: toDisplay(head.currentPrice, currency) });
    const avg = toDisplay(p.avgCost, currency);
    return [
      { id: 'price', label: t('Cena / ks'), color: 'var(--accent-2)', area: true, points: pts },
      { id: 'avg', label: t('Ø nákup / ks'), color: 'var(--muted)', dashed: true, points: pts.map((q) => ({ x: q.x, y: avg })) },
    ];
  }, [hist, id, head.currentPrice, currency, p.avgCost, histCutoff]);
  const olderHidden = !isPremium && !!(hist?.series[String(id)] ?? []).some(([d]) => d < histCutoff);

  const s = p.stats;
  const tn = tone(s.profit);

  return (
    <div className="pdetail">
      <div className="pd-head">
        <div className="pd-image">
          <ProductImage game={head.game} type={head.type} image={head.image} productImage={head.productImage} setLogo={head.setLogo} size="xl" />
        </div>
        <div className="pd-title">
          <span className="eyebrow">{[head.game, head.set, head.type].filter(Boolean).join(' · ')}</span>
          <h2>{p.name}</h2>
          {mp && (
            <a href={productUrl(mp)} target="_blank" rel="noreferrer" className="cm-link">
              {SOURCE_LABEL[mp.source]} <ExternalIcon size={12} />
            </a>
          )}
          <div className="pd-price">
            <b>{money(head.currentPrice, currency)}</b>
            <span>{t('/ ks')}</span>
            <span className={`pill sm ${tn}`}>
              <TrendIcon dir={tn} />
              {pct(s.profitPct)}
            </span>
          </div>
        </div>
      </div>

      <div className="pd-stats">
        <div><span>{t('Drženo')}</span><b>{s.held} {t('ks')}</b></div>
        <div><span>{t('Hodnota')}</span><b>{money(s.value, currency)}</b></div>
        <div><span>{t('Ø nákup / ks')}</span><b>{money(p.avgCost, currency)}</b></div>
        <div><span>{t('Nerealizovaný')}</span><b className={tn}>{signedMoney(s.profit, currency)}</b></div>
        {s.sold > 0 && (
          <div><span>{t('Realizovaný')}</span><b className={tone(s.realized)}>{signedMoney(s.realized, currency)}</b></div>
        )}
      </div>

      {portfolios && onMove && (
        <label className="pd-move">
          <span>{t('Portfolio')}</span>
          <select value={portfolioOf(head)} onChange={(e) => onMove(e.target.value)}>
            {portfolios.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
        </label>
      )}

      <MarketCompare mp={mp} alt={alt} market={market} currency={currency} valuation={valuation} />

      <section className="pd-chart card-lite">
        <header>
          <h3>{t('Vývoj ceny')}</h3>
          <div className="segmented sm">
            {(['3M', '1R', 'ALL'] as const).map((r) => {
              const locked = !isPremium && r !== '3M';
              return (
                <button
                  key={r}
                  className={`${shownRange === r ? 'active' : ''} ${locked ? 'locked' : ''}`}
                  onClick={() => (locked ? openPaywall('history') : setRange(r))}
                >
                  {r === 'ALL' ? t('Vše') : r}
                  {locked && <LockIcon size={10} />}
                </button>
              );
            })}
          </div>
        </header>
        <LineChart
          series={series}
          height={190}
          formatY={(v) => displayMoney(v, currency, true)}
          empty={!id ? t('Produkt není spárovaný s tržištěm – historie cen není k dispozici.') : histErr ? t('Historii se nepodařilo načíst.') : t('Načítám…')}
        />
        {id && series[0].points.length < 3 && (
          <p className="hint">{t('Ceny ukládáme každý den – graf se bude postupně plnit.')}</p>
        )}
        {id && hist?.estimated?.[String(id)] && (
          <p className="hint">
            {t('Do')} {recFmt.format(new Date(hist.estimated[String(id)]))} {t('ceny z archivu TCGplayeru')}
            {id < 1e9 ? t(' (přepočteno kurzem ČNB a srovnáno na úroveň Cardmarketu)') : ''}{t(', potom denní záznam.')}
          </p>
        )}
        {olderHidden && (
          <button className="link-btn pm-more" onClick={() => openPaywall('history')}>
            <CrownIcon size={13} /> {t('Starší historie ceny s Premium')}
          </button>
        )}
      </section>

      <Gallery photos={photos} />

      {s.held > 0 && !isPremium && (
        <section className="card-lite pd-alerts locked">
          <header>
            <h3 className="h-icon"><BellIcon size={16} />{t('Cenový alert')}</h3>
            <PremiumTag />
          </header>
          <p className="hint">{t('Dostaň upozornění, když cena stoupne nad nebo klesne pod tvoji hranici.')}</p>
          <button className="btn sm primary" onClick={() => openPaywall('alerts')}>
            {t('Odemknout alerty')}
          </button>
        </section>
      )}

      {s.held > 0 && isPremium && (
        <section className="card-lite pd-alerts">
          <header>
            <h3 className="h-icon"><BellIcon size={16} />{t('Cenový alert')}</h3>
            <span className="hint">{t('teď')} {money(head.currentPrice, currency)} {t('/ ks')}</span>
          </header>
          <div className="alert-inputs">
            <label className="field">
              <span>{t('Upozornit, když stoupne nad')}</span>
              <div className="money-input sm">
                <input inputMode="decimal" value={above} onChange={(e) => setAbove(e.target.value)} placeholder="—" />
                <span>{cur}</span>
              </div>
            </label>
            <label className="field">
              <span>{t('Upozornit, když klesne pod')}</span>
              <div className="money-input sm">
                <input inputMode="decimal" value={below} onChange={(e) => setBelow(e.target.value)} placeholder="—" />
                <span>{cur}</span>
              </div>
            </label>
          </div>
          {alertsDirty && (
            <button
              className="btn sm primary"
              onClick={() => {
                const a = parseNum(above);
                const b = parseNum(below);
                onSaveAlerts(a != null ? fromDisplay(a, currency) : undefined, b != null ? fromDisplay(b, currency) : undefined);
              }}
            >
              {t('Uložit alert')}
            </button>
          )}
        </section>
      )}

      <section className="pd-lots">
        <header>
          <h3>{t('Nákupní dávky')} <span className="count">{p.lots.length}</span></h3>
        </header>
        <ul>
          {p.lots.map((lot) => {
            const ls = itemStats(lot);
            const held = heldQty(lot);
            const ltn = tone(ls.profit);
            return (
              <li key={lot.id}>
                <button className="lot" onClick={() => onEditLot(lot)}>
                  <span className="lot-date">{date(lot.buyDate)}</span>
                  <span className="lot-main">
                    <b>
                      {held < lot.quantity ? `${held} z ${lot.quantity}` : lot.quantity} {t('ks ×')} {money(unitCost(lot), currency)}
                    </b>
                    <span className="lot-meta">
                      {(lot.condition ?? []).map((c) => (
                        <span key={c} className={`cond-tag ${conditionTone(c)}`}>{t(c)}</span>
                      ))}
                      {lot.note && <span className="note-snip">{lot.note}</span>}
                    </span>
                    {(lot.sales ?? []).map((sale) => {
                      const r = sale.quantity * sale.price - (sale.fees || 0) - sale.quantity * unitCost(lot);
                      return (
                        <span key={sale.id} className="lot-sale">
                          {t('Prodáno')} {date(sale.date)}: {sale.quantity} {t('ks ×')} {money(sale.price, currency)} ·{' '}
                          <em className={tone(r)}>{signedMoney(r, currency)}</em>
                        </span>
                      );
                    })}
                  </span>
                  <span className="lot-side">
                    {held > 0 ? (
                      <>
                        <b>{money(ls.value, currency)}</b>
                        <em className={ltn}>{signedMoney(ls.profit, currency)}</em>
                      </>
                    ) : (
                      <span className="cond-tag good">{t('Prodáno')}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="form-actions sticky-actions">
        <button className="btn" onClick={onAddLot}>{t('+ Přidat dávku')}</button>
        <span className="spacer" />
        <button className="btn primary" onClick={onSell} disabled={s.held <= 0}>
          {t('Prodat')}
        </button>
      </div>
    </div>
  );
}
