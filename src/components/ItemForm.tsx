import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ProductSearch } from './ProductSearch';
import { CONDITIONS, GAMES, PRODUCT_TYPES, type Currency, type Game, type PortfolioItemInput, type ProductType } from '../types';
import { searchSets } from '../lib/catalog';
import { compressImage, isValidImageUrl } from '../lib/image';
import { fromDisplay, money, toDisplay } from '../lib/format';
import { useSetCatalog } from '../hooks/useSetCatalog';
import { ProductImage, TYPE_ABBR } from './ProductImage';
import { ChevronIcon } from './icons';
import { CmPicker } from './CmPicker';
import { bestMatch, inferType, marketPrice, productImageFor, toCzk, type MarketProduct, type MarketSnapshot } from '../lib/market';

import { t } from '../i18n';
interface Props {
  initial?: PortfolioItemInput;
  /** Výchozí hra pro novou položku (naposledy použitá) */
  defaultGame?: Game;
  currency: Currency;
  market: MarketSnapshot | null;
  marketError: string | null;
  setSuggestions: string[];
  onSubmit: (input: PortfolioItemInput, addAnother: boolean) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
  /** initial je jen šablona (nová dávka existujícího produktu) */
  asNew?: boolean;
}

/** Plné názvy typů pro automatický název produktu */
const TYPE_NAMES: Record<ProductType, string> = {
  'Booster box': 'Booster Box',
  ETB: 'Elite Trainer Box',
  Display: 'Booster Display',
  'Booster bundle': 'Booster Bundle',
  UPC: 'Ultra-Premium Collection',
  'Premium Collection': 'Premium Collection',
  'Collection box': 'Collection',
  Tin: 'Tin',
  Blister: 'Blister',
  Booster: 'Booster',
  Deck: 'Starter Deck',
  Jiné: '',
};

const TYPE_LABELS: Record<ProductType, string> = {
  'Booster box': 'Booster box',
  ETB: 'Elite Trainer',
  Display: 'Display',
  'Booster bundle': 'Bundle',
  UPC: 'Ultra-Premium',
  'Premium Collection': 'Premium',
  'Collection box': 'Kolekce / box',
  Tin: 'Tin',
  Blister: 'Blister',
  Booster: 'Booster',
  Deck: 'Deck',
  Jiné: 'Jiné',
};

/** Přijme "1 299,50" i "1299.5" */
function parseNum(s: string): number {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

const numStr = (n: number | undefined) =>
  n === undefined || n === 0 ? '' : String(Math.round(n * 100) / 100).replace('.', ',');
const today = () => new Date().toISOString().slice(0, 10);

export function ItemForm({ initial, defaultGame, currency, market, marketError, setSuggestions, onSubmit, onCancel, onDelete, asNew }: Props) {
  const editing = !!initial && !asNew;
  const [game, setGame] = useState<Game>(initial?.game ?? defaultGame ?? 'Pokémon');
  const [set, setSet] = useState(initial?.set ?? '');
  const [setLogo, setSetLogo] = useState<string | undefined>(initial?.setLogo);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [type, setType] = useState<ProductType>(initial?.type ?? 'Booster box');
  const [name, setName] = useState(initial?.name ?? '');
  const [nameTouched, setNameTouched] = useState(!!initial);
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '1');
  // Pole se zadávají v měně zobrazení (Kč nebo €); ukládá se vždy v Kč
  const shownInit = useMemo(
    () => ({
      buy: numStr(initial ? toDisplay(initial.buyPrice, currency) : undefined),
      fees: numStr(initial ? toDisplay(initial.fees, currency) : undefined),
      current:
        initial && initial.currentPrice !== initial.buyPrice ? numStr(toDisplay(initial.currentPrice, currency)) : '',
    }),
    // jen při otevření formuláře
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [buyPrice, setBuyPrice] = useState(shownInit.buy);
  const [currentPrice, setCurrentPrice] = useState(shownInit.current);
  const [buyDate, setBuyDate] = useState(initial?.buyDate ?? today());
  const [fees, setFees] = useState(shownInit.fees);
  const [note, setNote] = useState(initial?.note ?? '');
  const [condition, setCondition] = useState<string[]>(initial?.condition ?? []);
  const [image, setImage] = useState(initial?.image ?? '');
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? []);
  const photosRef = useRef<HTMLInputElement>(null);

  async function addPhotos(files: FileList) {
    setImageBusy(true);
    try {
      const added: string[] = [];
      for (const f of [...files].slice(0, 8 - photos.length)) added.push(await compressImage(f, 1024, 0.8));
      setPhotos((p) => [...p, ...added].slice(0, 8));
    } catch {
      setError(t('Fotku se nepodařilo načíst.'));
    } finally {
      setImageBusy(false);
    }
  }
  const [imageBusy, setImageBusy] = useState(false);
  const [more, setMore] = useState(
    !!initial &&
      (initial.fees > 0 || (initial.priceAuto === false && initial.currentPrice !== initial.buyPrice)),
  );
  // Cardmarket: undefined = navrhnout automaticky, null = nepárovat, číslo = ručně vybraný produkt
  const [cmChoice, setCmChoice] = useState<number | null | undefined>(
    initial?.cmProductId ?? (initial?.priceAuto === false ? null : undefined),
  );
  const [priceAuto, setPriceAuto] = useState(initial?.priceAuto ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const catalog = useSetCatalog(game, setSuggestions);
  const matches = useMemo(() => searchSets(catalog, set, 8), [catalog, set]);
  // Starší položky nemají uložené logo – dohledá se podle názvu edice
  const shownLogo = setLogo ?? catalog.find((s) => s.name.toLowerCase() === set.trim().toLowerCase())?.logo;

  const cur = currency === 'CZK' ? t('Kč') : '€';
  const autoName = [set.trim(), TYPE_NAMES[type]].filter(Boolean).join(' ');
  const effectiveName = nameTouched ? name : autoName;
  const q = parseInt(quantity, 10);
  const quantityNum = Number.isFinite(q) ? q : 1;
  /** Text z pole → Kč; nezměněné pole vrátí přesně původní uloženou hodnotu (bez chyby ze zaokrouhlení kurzem) */
  const toStored = (text: string, initText: string, initCzk: number | undefined): number => {
    if (initCzk !== undefined && text === initText) return initCzk;
    const v = parseNum(text);
    return Number.isFinite(v) ? fromDisplay(v, currency) : NaN;
  };
  const bp = toStored(buyPrice, shownInit.buy, initial?.buyPrice); // v Kč
  const total = Number.isFinite(q) && Number.isFinite(bp) ? q * bp : 0;

  const cmQuery = useMemo(() => ({ game, set, type, name: effectiveName }), [game, set, type, effectiveName]);
  const cmProduct: MarketProduct | null = useMemo(() => {
    if (!market || cmChoice === null) return null;
    if (typeof cmChoice === 'number') return market.byId.get(cmChoice) ?? null;
    return bestMatch(market.products, cmQuery);
  }, [market, cmChoice, cmQuery]);
  const cmPrice = marketPrice(cmProduct);
  const autoCurrent = cmProduct && priceAuto && cmPrice != null ? toCzk(cmPrice, cmProduct.currency, market) : null; // v Kč

  // Obrázek produktu z TCGplayeru podle spárovaného produktu
  const [productImage, setProductImage] = useState<string | undefined>(initial?.productImage);
  useEffect(() => {
    if (!cmProduct) {
      if (market) setProductImage(undefined);
      return;
    }
    let alive = true;
    productImageFor(cmProduct)
      .then((url) => alive && setProductImage(url ?? undefined))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [cmProduct, market]);

  /** Výběr produktu z vyhledávání: doplní název, typ, edici i párování */
  function pickProduct(p: MarketProduct) {
    setCmChoice(p.id);
    setPriceAuto(true);
    setName(p.name);
    setNameTouched(true);
    setType(inferType(p));
    const lower = p.name.toLowerCase();
    const s = catalog
      .filter((c) => !c.id.startsWith('own-') && lower.includes(c.name.toLowerCase()))
      .sort((a, b) => b.name.length - a.name.length)[0];
    setSet(s?.name ?? '');
    setSetLogo(s?.logo);
  }

  function changeGame(g: Game) {
    if (g === game) return;
    setGame(g);
    setSet('');
    setSetLogo(undefined);
  }

  function typeSet(value: string) {
    setSet(value);
    const exact = catalog.find((s) => s.name.toLowerCase() === value.trim().toLowerCase());
    setSetLogo(exact?.logo);
    setPickerOpen(true);
  }

  function step(delta: number) {
    const n = Number.isFinite(q) ? q : 1;
    setQuantity(String(Math.max(1, n + delta)));
  }

  async function pickFile(file: File) {
    setImageBusy(true);
    setError(null);
    try {
      setImage(await compressImage(file));
    } catch {
      setError(t('Obrázek se nepodařilo načíst.'));
    } finally {
      setImageBusy(false);
    }
  }

  async function submit(addAnother: boolean) {
    const f = fees.trim() ? toStored(fees, shownInit.fees, initial?.fees) : 0;
    const cp =
      autoCurrent ??
      (currentPrice.trim()
        ? toStored(currentPrice, shownInit.current, initial?.priceAuto === false ? initial.currentPrice : undefined)
        : bp);
    const img = image.trim();

    if (!effectiveName.trim()) return setError(t('Vyber edici nebo zadej název produktu.'));
    if (!Number.isInteger(q) || q < 1) return setError(t('Počet kusů musí být celé číslo ≥ 1.'));
    const alreadySold = editing ? (initial?.sales ?? []).reduce((a, s) => a + s.quantity, 0) : 0;
    if (q < alreadySold) return setError(t('Z této dávky už je prodáno {0} ks – počet nemůže být menší.', alreadySold));
    if (!Number.isFinite(bp) || bp < 0 || !buyPrice.trim()) return setError(t('Zadej nákupní cenu za kus.'));
    if (!Number.isFinite(f) || f < 0) return setError(t('Poštovné/poplatky nejsou platné číslo.'));
    if (!Number.isFinite(cp) || cp < 0) return setError(t('Aktuální cena není platné číslo.'));
    if (img && !img.startsWith('data:image/') && !isValidImageUrl(img)) return setError(t('Odkaz na obrázek musí začínat https://'));

    setError(null);
    setSaving(true);
    try {
      await onSubmit(
        {
          name: effectiveName.trim(),
          game,
          set: set.trim(),
          type,
          quantity: q,
          buyPrice: bp,
          buyDate,
          fees: f,
          currentPrice: cp,
          note: note.trim(),
          condition: condition.length ? condition : undefined,
          photos: photos.length ? photos : undefined,
          image: img || undefined,
          setLogo: shownLogo,
          productImage,
          ...(market
            ? {
                cmProductId: cmProduct?.id,
                cmName: cmProduct?.name,
                // false jen při výslovném „Nepárovat“; bez nalezené shody necháme na pozdější párování
                priceAuto: cmProduct ? priceAuto : cmChoice === null ? false : undefined,
                priceUpdatedAt: autoCurrent != null ? market.priceDate : undefined,
              }
            : {
                // ceny nejsou načtené (offline) – párování ponecháme beze změny
                cmProductId: initial?.cmProductId,
                cmName: initial?.cmName,
                priceAuto: initial?.priceAuto,
                priceUpdatedAt: initial?.priceUpdatedAt,
              }),
        },
        addAnother,
      );
    } catch (err) {
      setError(t('Uložení selhalo: {0}', String(err)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="qform"
      noValidate
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        submit(false);
      }}
    >
      {/* Hra */}
      <div className="segmented big">
        {GAMES.map((g) => (
          <button type="button" key={g} className={g === game ? 'active' : ''} onClick={() => changeGame(g)}>
            {g}
          </button>
        ))}
      </div>

      {/* Rychlé hledání produktu na tržišti – vyplní vše najednou */}
      <ProductSearch market={market} game={game} currency={currency} onPick={pickProduct} />

      <div className="or-sep"><span>{t('nebo vyber edici a typ')}</span></div>

      {/* Edice s vyhledáváním v katalogu */}
      <div className="field">
        <span>{t('Edice')}</span>
        <div className="set-picker">
          <div className="set-input">
            {shownLogo ? <img src={shownLogo} alt="" referrerPolicy="no-referrer" /> : <span className="set-input-ph" />}
            <input
              value={set}
              onChange={(e) => typeSet(e.target.value)}
              onFocus={() => setPickerOpen(true)}
              onBlur={() => setTimeout(() => setPickerOpen(false), 120)}
              placeholder={game === 'Pokémon' ? t('Hledej edici, např. Surging Sparks') : game === 'One Piece' ? t('Hledej edici, např. Romance Dawn') : t('Hledej edici, např. Origins')}
              autoComplete="off"
              enterKeyHint="done"
            />
          </div>
          {pickerOpen && matches.length > 0 && (
            <ul className="set-list" role="listbox">
              {matches.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={s.name === set ? 'active' : ''}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSet(s.name);
                      setSetLogo(s.logo);
                      setPickerOpen(false);
                    }}
                  >
                    <span className="set-logo">{s.logo ? <img src={s.logo} alt="" loading="lazy" referrerPolicy="no-referrer" /> : s.name.slice(0, 2)}</span>
                    <span className="set-name">{s.name}</span>
                    <span className="set-meta">
                      {[s.series, s.releaseDate?.slice(0, 4)].filter(Boolean).join(' · ') || (s.id.startsWith('own-') ? 'tvoje' : '')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Typ produktu */}
      <div className="field">
        <span>{t('Typ produktu')}</span>
        <div className="type-grid">
          {PRODUCT_TYPES.map((t) => (
            <button type="button" key={t} className={`type-chip ${t === type ? 'active' : ''}`} onClick={() => setType(t)}>
              <b>{TYPE_ABBR[t]}</b>
              <span>{TYPE_LABELS[t]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Náhled + název */}
      <div className="preview-row">
        <button type="button" className="image-pick" onClick={() => fileRef.current?.click()} aria-label={t('Přidat fotku produktu')}>
          <ProductImage game={game} type={type} image={image || undefined} productImage={productImage} setLogo={shownLogo} size="lg" />
          <span className="image-pick-label">{imageBusy ? '…' : image ? t('Změnit') : t('+ Foto')}</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickFile(f);
            e.target.value = '';
          }}
        />
        <label className="field grow">
          <span>{t('Název')} {nameTouched ? '' : t('(vyplní se sám)')}</span>
          <input
            value={effectiveName}
            onChange={(e) => {
              setNameTouched(true);
              setName(e.target.value);
            }}
            placeholder={t('např. Prismatic Evolutions ETB')}
          />
          {image && (
            <button type="button" className="link-btn" onClick={() => setImage('')}>
              {t('Odebrat obrázek')}
            </button>
          )}
        </label>
      </div>

      {/* Počet + cena */}
      <div className="qty-price">
        <div className="field">
          <span>{t('Počet')}</span>
          <div className="stepper">
            <button type="button" onClick={() => step(-1)} aria-label={t('Méně')} disabled={q <= 1}>−</button>
            <input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))} aria-label={t('Počet kusů')} />
            <button type="button" onClick={() => step(1)} aria-label={t('Více')}>+</button>
          </div>
        </div>
        <label className="field grow">
          <span>{t('Cena za kus')}</span>
          <div className="money-input">
            <input inputMode="decimal" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} placeholder="0" />
            <span>{cur}</span>
          </div>
        </label>
      </div>

      {total > 0 && (
        <p className="total-line">
          {t('Celkem')} <b>{money(total, currency)}</b>
          {q > 1 && <span> · {q} {t('×')} {money(bp, currency)}</span>}
          {autoCurrent != null && Number.isFinite(q) && (
            <span className={autoCurrent * q >= total ? 'pos' : 'neg'}>
              {' '}{t('· dnes')} {money(autoCurrent * q, currency)}
            </span>
          )}
        </p>
      )}

      {/* Cardmarket */}
      <CmPicker
        market={market}
        marketError={marketError}
        query={cmQuery}
        product={cmProduct}
        isAuto={cmChoice === undefined}
        onPick={(p) => setCmChoice(p ? p.id : null)}
        priceAuto={priceAuto}
        onPriceAuto={setPriceAuto}
        currency={currency}
      />

      {/* Fotky (stav balení, detail poškození…) */}
      <div className="field">
        <span>{t('Fotky')} {photos.length > 0 && `(${photos.length}/8)`}</span>
        <div className="photo-strip">
          {photos.map((src, i) => (
            <span key={i} className="photo-thumb">
              <img src={src} alt="" />
              <button type="button" aria-label={t('Odebrat fotku')} onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}>{t('×')}</button>
            </span>
          ))}
          {photos.length < 8 && (
            <button type="button" className="photo-add" onClick={() => photosRef.current?.click()} disabled={imageBusy}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>{imageBusy ? '…' : t('Přidat')}</span>
            </button>
          )}
          <input
            ref={photosRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) addPhotos(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* Stav a poznámka */}
      <div className="field">
        <span>{t('Stav produktu')}</span>
        <div className="cond-chips">
          {CONDITIONS.map((c) => {
            const on = condition.includes(c.id);
            return (
              <button
                type="button"
                key={c.id}
                className={`cond-chip ${c.tone} ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() =>
                  setCondition((prev) => {
                    if (prev.includes(c.id)) return prev.filter((x) => x !== c.id);
                    // „Perfektní“ se nekombinuje s vadami
                    if (c.id === 'Perfektní') return ['Perfektní'];
                    return [...prev.filter((x) => x !== 'Perfektní'), c.id];
                  })
                }
              >
                {on && '✓ '}
                {t(c.id)}
              </button>
            );
          })}
        </div>
      </div>
      <label className="field">
        <span>{t('Poznámka')}</span>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={quantityNum > 1 ? t('např. 1 ks má natrženou fólii, koupeno na Cardmarketu…') : t('např. koupeno na Cardmarketu, malý důlek na rohu…')}
        />
      </label>

      {/* Další údaje */}
      <button type="button" className={`more-toggle ${more ? 'open' : ''}`} onClick={() => setMore(!more)}>
        <ChevronIcon /> {t('Další údaje')}
        <span className="muted">{t('aktuální cena, datum, poštovné, obrázek')}</span>
      </button>

      {more && (
        <div className="form">
          <label className="field">
            <span>{t('Aktuální cena / ks (')}{cur})</span>
            {autoCurrent != null ? (
              <input value={`${money(autoCurrent, currency)} (${cmProduct?.source === 'tcgplayer' ? 'TCGplayer' : 'Cardmarket'})`} disabled />
            ) : (
              <input inputMode="decimal" value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} placeholder={t('= nákupní')} />
            )}
          </label>
          <label className="field">
            <span>{t('Datum nákupu')}</span>
            <input type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} />
          </label>
          <label className="field">
            <span>{t('Poštovné / poplatky (')}{cur})</span>
            <input inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} placeholder={t('celkem')} />
          </label>
          <label className="field">
            <span>{t('Odkaz na obrázek')}</span>
            <input
              value={image.startsWith('data:') ? '' : image}
              onChange={(e) => setImage(e.target.value)}
              placeholder={image.startsWith('data:') ? t('vlastní fotka') : 'https://…'}
              inputMode="url"
            />
          </label>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        {onDelete ? (
          <button type="button" className="btn danger" onClick={onDelete}>{t('Smazat')}</button>
        ) : (
          <button type="button" className="btn ghost" onClick={onCancel}>{t('Zrušit')}</button>
        )}
        <span className="spacer" />
        {!editing && (
          <button type="button" className="btn" disabled={saving} onClick={() => submit(true)}>
            {t('Přidat a další')}
          </button>
        )}
        <button type="submit" className="btn primary" disabled={saving || imageBusy}>
          {editing ? t('Uložit') : t('Přidat')}
        </button>
      </div>
    </form>
  );
}
