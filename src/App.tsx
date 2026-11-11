import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMarket } from './hooks/useMarket';
import { autoPriceFor, bestMatch, inferType, productImageFor, type Valuation } from './lib/market';
import { useAltQuotes } from './hooks/useAltQuotes';
import { MarketBar } from './components/MarketBar';
import { setEurRate } from './lib/format';
import type { Currency, Game, PortfolioItem, PortfolioItemInput } from './types';
import { IndexedDbRepository } from './storage/indexedDbRepository';
import { usePortfolio } from './hooks/usePortfolio';
import { usePersistentState } from './hooks/usePersistentState';
import { applyFilters, DEFAULT_FILTERS, isFiltered, sortPositions, type Filters } from './lib/filters';
import { groupPositions, positionKey, type Position } from './lib/portfolio';
import { PositionDetail } from './components/PositionDetail';
import { SellDialog } from './components/SellDialog';
import { AnalyticsView } from './components/AnalyticsView';
import { Summary } from './components/Summary';
import { ItemList, type ListView } from './components/ItemList';
import { ItemForm } from './components/ItemForm';
import { Modal } from './components/Modal';
import { Toolbar } from './components/Toolbar';
import { GameChart } from './components/GameChart';
import { GearIcon, Logo, PlusIcon, SearchIcon, ShareIcon } from './components/icons';
import { SettingsPanel } from './components/SettingsPanel';
import { APP_FULL_NAME, APP_VERSION, diagnostics, mailtoUrl } from './config';
import { useWishlist } from './hooks/useWishlist';
import { useSetCatalog } from './hooks/useSetCatalog';
import { WishlistView } from './components/WishlistView';
import { AlertsBell } from './components/AlertsBell';
import { ShareDialog } from './components/ShareDialog';
import { evaluateAlerts, notifyNew, type PriceAlert } from './lib/alerts';
import { backupFilename, download, positionsToCsv } from './lib/backup';
import { money, plural } from './lib/format';
import type { WishlistItem } from './types';
import { usePremium } from './lib/premium';
import { usePriceChanges } from './hooks/usePriceChanges';
import { haptic } from './lib/motion';
import { Dock, HeaderTabs } from './components/Dock';
import { AccountButton, AuthForm, RecoveryForm } from './components/Account';
import { useCloud } from './lib/cloud';
import { changeAbs } from './lib/changes';
import { PremiumDialog } from './components/PremiumDialog';
import { PortfolioSwitcher } from './components/PortfolioSwitcher';
import { CrownIcon } from './components/icons';
import { ALL_ID, DEFAULT_PORTFOLIOS, MAIN_ID, newPortfolioId, portfolioOf } from './lib/portfolios';

import { t, LOCALE } from './i18n';
const repo = new IndexedDbRepository();

type Dialog =
  | { kind: 'add'; template?: PortfolioItemInput }
  | { kind: 'edit'; item: PortfolioItem; back?: string }
  | { kind: 'settings' }
  | { kind: 'position'; key: string }
  | { kind: 'sell'; key: string }
  | { kind: 'share' }
  | { kind: 'auth' }
  | null;
import type { Tab } from './components/Dock';

/** Kostra obsahu během načítání */
function SkeletonLayout() {
  return (
    <main className="layout" aria-busy="true" aria-label={t('Načítám')}>
      <aside className="col-left">
        <div className="skel skel-hero" />
        <div className="skel skel-card" />
      </aside>
      <section className="col-right">
        <div className="skel skel-bar" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skel skel-row" />
        ))}
      </section>
    </main>
  );
}

export default function App() {
  const { items, loading, error, add, update, remove, replaceAll } = usePortfolio(repo);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [currency, setCurrency] = usePersistentState<Currency>('currency', 'CZK');
  const [filters, setFilters] = usePersistentState<Filters>('filters', DEFAULT_FILTERS);
  const [lastGame, setLastGame] = usePersistentState<Game>('lastGame', 'Pokémon');
  const [view, setView] = usePersistentState<ListView>('view', 'list');
  const [tab, setTabRaw] = usePersistentState<Tab>('tab', 'portfolio');
  // přepnutí záložky s plynulým přechodem a jemnou vibrací
  const setTab = useCallback(
    (next: Tab) => {
      haptic();
      window.scrollTo({ top: 0 });
      // obsah se přepne s nízkou prioritou – ovládání reaguje okamžitě
      startTransition(() => setTabRaw(next));
    },
    [setTabRaw],
  );
  const shownTab = tab;
  // jednou otevřené záložky zůstávají vykreslené (skryté) – další přepnutí je okamžité
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set([tab]));
  useEffect(() => {
    setVisited((v) => (v.has(shownTab) ? v : new Set(v).add(shownTab)));
  }, [shownTab]);
  // ostatní záložky připravit v klidu po startu – první přepnutí pak nečeká na výpočty
  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const run = () => startTransition(() => setVisited(new Set<Tab>(['portfolio', 'analytics', 'wishlist'])));
    const id = idle ? idle(run, { timeout: 2500 }) : window.setTimeout(run, 1800);
    return () => {
      const cancel = (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (cancel) cancel(id);
      clearTimeout(id);
    };
  }, []);
  const [formKey, setFormKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const close = useCallback(() => setDialog(null), []);
  const cloud = useCloud();
  // stabilní funkce pro děti (memo komponenty se pak zbytečně nepřekreslují)
  const openPosition = useCallback((key: string) => setDialog({ kind: 'position', key }), []);
  const openPositionOf = useCallback((p: { key: string }) => setDialog({ kind: 'position', key: p.key }), []);

  // Ctrl+K nebo „/“ → hledání v hlavičce (PC)
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName);
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        if (!searchRef.current || !searchRef.current.offsetParent) return;
        e.preventDefault();
        searchRef.current.focus();
        searchRef.current.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toastTimer = useRef<number | undefined>(undefined);
  function showToast(text: string) {
    haptic(6);
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }

  const { market, loading: marketLoading, error: marketError, refresh: refreshMarket } = useMarket();
  // druhý trh (TCGplayer / Cardmarket) a způsob ocenění
  const altQuotes = useAltQuotes(items, market);
  const [valuation, setValuation] = usePersistentState<Valuation>('valuation', 'main');
  // kurz pro přepočet zobrazení Kč → € (před vykreslením potomků)
  setEurRate(market?.eurCzk);

  // Po načtení cen: nespárované položky se jistou shodou se spárují samy
  // a spárované položky s automatickou cenou převezmou aktuální cenu z Cardmarketu
  useEffect(() => {
    if (!market || loading) return;
    let changed = false;
    const next = items.map((orig) => {
      let it = orig;
      // Napárováno na produkt, který v ceníku není (např. neanglická verze) → spárovat znovu
      if (it.cmProductId && !market.byId.has(it.cmProductId)) {
        it = { ...it, cmProductId: undefined, cmName: undefined, productImage: undefined, priceAuto: it.priceAuto === false ? false : undefined };
        changed = true;
      }
      if (!it.cmProductId && it.priceAuto === undefined) {
        const p = bestMatch(market.products, { game: it.game, set: it.set, type: it.type, name: it.name });
        if (p) {
          it = { ...it, cmProductId: p.id, cmName: p.name, priceAuto: true };
          changed = true;
        }
      }
      const price = autoPriceFor(it, market, altQuotes.get(positionKey(it)), valuation);
      if (price == null || (price === it.currentPrice && it.priceUpdatedAt === market.priceDate)) return it;
      changed = true;
      return { ...it, currentPrice: price, priceUpdatedAt: market.priceDate, updatedAt: new Date().toISOString() };
    });
    if (changed) replaceAll(next);
  }, [market, items, loading, replaceAll, altQuotes, valuation]);

  // Jednorázově: položky typu „Jiné“ přidané před novými kategoriemi dostanou typ podle spárovaného produktu
  useEffect(() => {
    if (!market || loading || !items.length) return;
    const FLAG = 'tcg-portfolio:migration:types-v1';
    try {
      if (localStorage.getItem(FLAG)) return;
    } catch {
      return;
    }
    let n = 0;
    const next = items.map((it) => {
      if (it.type !== 'Jiné' || !it.cmProductId) return it;
      const p = market.byId.get(it.cmProductId);
      const t = p ? inferType(p) : 'Jiné';
      if (t === 'Jiné') return it;
      n++;
      return { ...it, type: t, updatedAt: new Date().toISOString() };
    });
    try {
      localStorage.setItem(FLAG, '1');
    } catch {
      /* nevadí */
    }
    if (n) {
      replaceAll(next);
      showToast(t('Upravena kategorie u {0} {1}', n, n === 1 ? t('položky') : t('položek')));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, items, loading, replaceAll]);

  // Spárované položky bez obrázku si dohledají fotku produktu (TCGplayer)
  const imgTried = useRef(new Set<string>());
  useEffect(() => {
    if (!market || loading) return;
    const todo = items.filter((it) => it.cmProductId && !it.productImage && !imgTried.current.has(`${it.id}:${it.cmProductId}`));
    if (!todo.length) return;
    (async () => {
      for (const it of todo) {
        imgTried.current.add(`${it.id}:${it.cmProductId}`);
        const p = market.byId.get(it.cmProductId!);
        if (!p) continue;
        try {
          const url = await productImageFor(p);
          // update() sloučí jen předaná pole s aktuální verzí položky
          if (url) await update(it.id, { productImage: url } as PortfolioItemInput);
        } catch {
          /* bez internetu / serveru – zkusí se příště */
        }
      }
    })();
  }, [market, items, loading, update]);

  const linkedCount = items.filter((i) => i.cmProductId && i.priceAuto !== false).length;
  const unlinked = items.filter((i) => !i.cmProductId && i.priceAuto !== false);

  async function autoLink() {
    if (!market) return;
    let n = 0;
    const next = items.map((it) => {
      if (it.cmProductId || it.priceAuto === false) return it;
      const p = bestMatch(market.products, { game: it.game, set: it.set, type: it.type, name: it.name });
      if (!p) return it;
      n++;
      return { ...it, cmProductId: p.id, cmName: p.name, priceAuto: true };
    });
    if (n) await replaceAll(next);
    showToast(n ? t('Spárováno {0} z {1}', n, unlinked.length) : t('Nenašel jsem jistou shodu – spáruj položku ručně v úpravě'));
  }

  // ---------- Premium + více portfolií ----------
  const premium = usePremium();
  const [pfState, setPfState] = usePersistentState('portfolios', DEFAULT_PORTFOLIOS);
  const portfolios = pfState.list?.length ? pfState.list : DEFAULT_PORTFOLIOS.list;
  const [activePf, setActivePf] = usePersistentState<string>('activePortfolio', ALL_ID);
  // ve verzi zdarma se zobrazuje vše dohromady (žádná data se neschovají)
  const active = premium.isPremium && portfolios.some((p) => p.id === activePf) ? activePf : ALL_ID;
  const pItems = useMemo(() => (active === ALL_ID ? items : items.filter((i) => portfolioOf(i) === active)), [items, active]);
  const pfCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const it of items) c[portfolioOf(it)] = (c[portfolioOf(it)] ?? 0) + 1;
    return c;
  }, [items]);
  const activeName = active === ALL_ID ? null : portfolios.find((p) => p.id === active)?.name ?? null;

  function createPortfolio(name: string) {
    const id = newPortfolioId();
    setPfState({ list: [...portfolios, { id, name }] });
    setActivePf(id);
    showToast(t('Vytvořeno portfolio „{0}“', name));
  }
  function renamePortfolio(id: string, name: string) {
    setPfState({ list: portfolios.map((p) => (p.id === id ? { ...p, name } : p)) });
  }
  async function deletePortfolio(id: string) {
    if (id === MAIN_ID) return;
    const moved = items.filter((i) => portfolioOf(i) === id);
    if (moved.length) await replaceAll(items.map((i) => (portfolioOf(i) === id ? { ...i, portfolioId: undefined } : i)));
    setPfState({ list: portfolios.filter((p) => p.id !== id) });
    if (activePf === id) setActivePf(ALL_ID);
    const n = moved.length;
    const what = t(n === 1 ? 'položka přesunuta' : n < 5 ? 'položky přesunuty' : 'položek přesunuto');
    showToast(n ? t('Portfolio smazáno · {0} {1} do Hlavního', n, what) : t('Portfolio smazáno'));
  }
  async function movePosition(p: Position, to: string) {
    const ids = new Set(p.lots.map((l) => l.id));
    await replaceAll(items.map((i) => (ids.has(i.id) ? { ...i, portfolioId: to === MAIN_ID ? undefined : to } : i)));
    showToast(t('Přesunuto do „{0}“', portfolios.find((x) => x.id === to)?.name ?? t('Hlavní')));
  }

  const sets = useMemo(() => [...new Set(pItems.map((i) => i.set).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'cs')), [pItems]);

  // Série edic (Pokémon podle katalogu: Mega Evolution, Scarlet & Violet…; Riftbound jako jedna série)
  const pokemonCatalog = useSetCatalog('Pokémon');
  const onePieceCatalog = useSetCatalog('One Piece');
  const seriesBySet = useMemo(
    () =>
      new Map([
        ...pokemonCatalog.filter((s) => s.series).map((s) => [`Pokémon|${s.name.toLowerCase()}`, s.series!] as const),
        ...onePieceCatalog.filter((s) => s.series).map((s) => [`One Piece|${s.name.toLowerCase()}`, `One Piece · ${s.series}`] as const),
      ]),
    [pokemonCatalog, onePieceCatalog],
  );
  const seriesOf = useCallback(
    (it: PortfolioItem) =>
      it.game === 'Riftbound'
        ? 'Riftbound'
        : seriesBySet.get(`${it.game}|${it.set.toLowerCase()}`) ?? (it.game === 'One Piece' ? 'One Piece' : t('Ostatní')),
    [seriesBySet],
  );
  const seriesOptions = useMemo(
    () => [...new Set(pItems.filter((i) => filters.game === 'all' || i.game === filters.game).map(seriesOf))].sort((a, b) => a.localeCompare(b, 'cs')),
    [pItems, seriesOf, filters.game],
  );
  const typeOptions = useMemo(() => [...new Set(pItems.map((i) => i.type))], [pItems]);

  const visible = useMemo(() => applyFilters(pItems, filters, seriesOf), [pItems, filters, seriesOf]);
  // denní / týdenní změna cen (z historie)
  const { changes, spark, trend } = usePriceChanges(pItems, visible);
  const dayChangeOf = useCallback(
    (p: Position) => (p.stats.held && p.head.cmProductId ? changeAbs(p.stats.value, changes.get(p.head.cmProductId)?.d1 ?? null) : null),
    [changes],
  );
  const positions = useMemo(() => sortPositions(groupPositions(visible), filters.sort, dayChangeOf), [visible, filters.sort, dayChangeOf]);
  const dayChange = useMemo(() => {
    let abs = 0;
    let known = false;
    let value = 0;
    for (const p of groupPositions(visible)) {
      value += p.stats.value;
      const c = dayChangeOf(p);
      if (c != null) {
        abs += c;
        known = true;
      }
    }
    return known ? { abs, pct: value - abs > 0 ? (abs / (value - abs)) * 100 : 0 } : null;
  }, [visible, dayChangeOf]);
  const allPositions = useMemo(() => groupPositions(pItems), [pItems]);
  const findPosition = (key: string): Position | undefined => allPositions.find((p) => p.key === key);
  const filtered = isFiltered(filters);

  async function handleImport(imported: PortfolioItem[], mode: 'merge' | 'replace', importedWish: WishlistItem[] = []) {
    if (mode === 'replace') {
      await replaceAll(imported);
      if (importedWish.length) await replaceWishlist(importedWish);
      return;
    }
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const it of imported) byId.set(it.id, it);
    await replaceAll([...byId.values()]);
    if (importedWish.length) {
      const w = new Map(wishlist.map((x) => [x.id, x]));
      for (const x of importedWish) w.set(x.id, x);
      await replaceWishlist([...w.values()]);
    }
  }

  // ---------- Wishlist + cenové alerty ----------
  const { wishlist, addWish, updateWish, removeWish, replaceWishlist } = useWishlist();
  // cenové alerty jsou součástí Premium
  const alerts = useMemo(() => (premium.isPremium ? evaluateAlerts(items, wishlist, market) : []), [items, wishlist, market, premium.isPremium]);
  useEffect(() => {
    if (!market) return;
    notifyNew(alerts, (czk) => money(czk, currency)).then((n) => {
      if (n) showToast(`${n === 1 ? t('Splněný cenový alert') : t('{0} splněné cenové alerty', n)}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.map((a) => a.id).join('|'), market]);

  function openAlert(a: PriceAlert) {
    if (a.kind === 'wish') setTab('wishlist');
    else setDialog({ kind: 'position', key: a.target });
  }

  /** Nastaví alert na všechny dávky pozice */
  async function saveAlerts(p: Position, above: number | undefined, below: number | undefined) {
    const ids = new Set(p.lots.map((l) => l.id));
    await replaceAll(items.map((it) => (ids.has(it.id) ? { ...it, alertAbove: above, alertBelow: below } : it)));
    showToast(above || below ? t('Cenový alert uložen') : t('Cenový alert vypnut'));
  }

  function exportCsv() {
    if (!premium.isPremium) return premium.openPaywall('export');
    const rows = positions.map((p) => ({
      name: p.name, game: p.game, set: p.head.set, type: p.head.type, held: p.stats.held, avgCost: p.avgCost,
      price: p.head.currentPrice, value: p.stats.value, profit: p.stats.profit, profitPct: p.stats.profitPct,
      realized: p.stats.realized, lots: p.lots.length,
    }));
    download(backupFilename('csv').replace('sealed-portfolio', 'sealedvault-pozice'), positionsToCsv(rows), 'text/csv;charset=utf-8');
    showToast(t('Exportováno {0} produktů do CSV', rows.length));
  }

  // ---------- Mobil: schovat spodní lištu při scrollu dolů, mini lišta s hodnotou ----------
  const [scrollDown, setScrollDown] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) > 8) {
        setScrollDown(y > last && y > 120);
        last = y;
      }
      setPastHero(y > 320);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const switcher = (
    <PortfolioSwitcher
      portfolios={portfolios}
      active={active}
      counts={pfCounts}
      onSelect={setActivePf}
      onCreate={createPortfolio}
    />
  );
  // nová položka jde do otevřeného portfolia (u „Vše“ do Hlavního)
  const targetPf = active === ALL_ID || active === MAIN_ID ? undefined : active;

  return (
    <div className={`app ${scrollDown ? 'scroll-down' : ''}`}>
      <div className="bg-fx" aria-hidden>
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
        <span className="horizon" />
      </div>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <Logo size={38} />
            <div>
              <h1>{t('Sealed')}<span className="brand-accent">{t('Vault')}</span></h1>
              <span>{t('Sealed TCG portfolio')}</span>
            </div>
          </div>

          {items.length > 0 && (
            <HeaderTabs tab={tab} wishCount={wishlist.length} onTab={setTab} />
          )}

          {items.length > 0 && tab === 'portfolio' && (
            <label className="header-search">
              <SearchIcon />
              <input
                ref={searchRef}
                type="search"
                placeholder={t('Hledat…')}
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
              <kbd>{t('Ctrl K')}</kbd>
            </label>
          )}

          <div className="topbar-actions">
            <button
              className={`premium-btn ${premium.isPremium ? 'on' : ''}`}
              onClick={() => premium.openPaywall()}
              title={premium.isPremium ? t('Premium aktivní – zbývá {0} zkušební verze', plural(premium.daysLeft, ['den', 'dny', 'dní'])) : t('SealedVault Premium')}
            >
              <CrownIcon size={16} />
              <span>{premium.isPremium ? t('Premium · {0} d', premium.daysLeft) : t('Premium')}</span>
            </button>
            <button
              className={`market-pill ${marketError ? 'err' : market ? 'ok' : ''}`}
              onClick={() => refreshMarket(true)}
              disabled={marketLoading}
              title={market ? t('Pokémon + One Piece: Cardmarket · Riftbound: TCGplayer\nKurz ČNB: 1 € = {0} Kč, 1 $ = {1} Kč\nKlikni pro obnovení', market.eurCzk ?? '?', market.usdCzk ?? '?') : marketError ?? ''}
            >
              <span className="cm-dot" aria-hidden />
              {marketLoading ? t('Načítám ceny…') : market ? t('Ceny {0}', new Date(market.priceDate).toLocaleDateString(LOCALE, { day: 'numeric', month: 'numeric' })) : t('Ceny offline')}
            </button>
            <div className="segmented cur" role="group" aria-label={t('Měna')}>
              <button className={currency === 'CZK' ? 'active' : ''} onClick={() => setCurrency('CZK')}>{t('Kč')}</button>
              <button className={currency === 'EUR' ? 'active' : ''} onClick={() => setCurrency('EUR')}>€</button>
            </div>
            <AlertsBell alerts={alerts} currency={currency} onOpen={openAlert} />
            {items.length > 0 && (
              <button className="icon-btn" onClick={() => setDialog({ kind: 'share' })} aria-label={t('Sdílet portfolio')} title={t('Sdílet portfolio')}>
                <ShareIcon size={18} />
              </button>
            )}
            <AccountButton onOpen={() => setDialog(cloud.user ? { kind: 'settings' } : { kind: 'auth' })} />
            <button className="icon-btn" onClick={() => setDialog({ kind: 'settings' })} aria-label={t('Nastavení')} title={t('Nastavení, záloha a podpora')}>
              <GearIcon />
            </button>
            <button className="btn primary add-desktop" onClick={() => setDialog({ kind: 'add' })}>
              <PlusIcon /> {t('Přidat')}
            </button>
          </div>
        </div>
        {/* mobil: kompaktní řádek s hodnotou po odscrollování karty */}
        {tab === 'portfolio' && pastHero && items.length > 0 && (
          <button className="mini-bar" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span>{filtered ? t('Výběr') : t('Hodnota portfolia')}</span>
            <b>{money(positions.reduce((a, p) => a + p.stats.value, 0), currency)}</b>
          </button>
        )}
      </header>

      {error && <p className="banner error">{t('Chyba úložiště:')} {error}</p>}

      {loading ? (
        <SkeletonLayout />
      ) : items.length === 0 ? (
        <main className="empty-state">
          <Logo size={64} />
          <h2>{t('Vítej v SealedVaultu')}</h2>
          <p>{t('Přidej booster boxy, ETB a displaye a uvidíš, kolik ti vydělávají.')}</p>
          <div className="row">
            <button className="btn primary" onClick={() => setDialog({ kind: 'add' })}><PlusIcon /> {t('Přidat první položku')}</button>
            <button className="btn" onClick={() => setDialog({ kind: 'settings' })}>{t('Importovat zálohu')}</button>
          </div>
        </main>
      ) : (
        <>
        {visited.has('wishlist') && (
        <main className="layout wide tab-pane" hidden={shownTab !== 'wishlist'}>
          <WishlistView
            wishlist={wishlist}
            market={market}
            currency={currency}
            onAdd={addWish}
            onUpdate={updateWish}
            onRemove={removeWish}
            onBuy={(w) =>
              setDialog({
                kind: 'add',
                template: {
                  name: w.name, game: w.game, set: w.set, type: w.type, quantity: 1, buyPrice: 0,
                  buyDate: new Date().toISOString().slice(0, 10), fees: 0, currentPrice: 0, note: '',
                  productImage: w.productImage, cmProductId: w.cmProductId, priceAuto: w.cmProductId ? true : undefined,
                },
              })
            }
          />
        </main>
        )}
        {visited.has('analytics') && (
        <main className="layout wide tab-pane" hidden={shownTab !== 'analytics'}>
          {switcher}
          <AnalyticsView items={pItems} currency={currency} market={market} seriesOf={seriesOf} onOpen={openPosition} />
        </main>
        )}
        {visited.has('portfolio') && (
        <main className="layout tab-pane" hidden={shownTab !== 'portfolio'}>
          {switcher}
          <aside className="col-left">
            <Summary items={visible} currency={currency} filtered={filtered} dayChange={dayChange} trend={trend} />
            <MarketBar
              market={market}
              loading={marketLoading}
              error={marketError}
              linked={linkedCount}
              unlinked={unlinked.length}
              onRefresh={() => refreshMarket(true)}
              onAutoLink={autoLink}
            />
            <GameChart items={visible} currency={currency} />
          </aside>
          <section className="col-right">
            <Toolbar
              filters={filters}
              onChange={setFilters}
              sets={sets}
              seriesOptions={seriesOptions}
              typeOptions={typeOptions}
              shown={positions.length}
              total={allPositions.length}
              view={view}
              onView={setView}
              onExport={exportCsv}
            />
            {positions.length === 0 ? (
              <p className="empty">
                {pItems.length === 0
                  ? t('Portfolio „{0}“ je zatím prázdné – přidej první položku tlačítkem Přidat.', activeName ?? '')
                  : filters.holding === 'sold'
                    ? t('Zatím jsi nic neprodal.')
                    : t('Filtrům neodpovídá žádná položka.')}
              </p>
            ) : (
              <ItemList positions={positions} currency={currency} view={view} changes={changes} spark={spark} onOpen={openPositionOf} />
            )}
          </section>
        </main>
        )}
        </>
      )}

      {!loading && (
        <footer className="app-footer">
          <span>
            <b>{APP_FULL_NAME}</b> · v{APP_VERSION}
          </span>
          <button className="link-btn" onClick={() => setDialog({ kind: 'settings' })}>{t('Nastavení')}</button>
          <a className="link-btn" href={mailtoUrl(`${APP_FULL_NAME} – dotaz`, `Ahoj,\n\n\n\n---\n${diagnostics()}`)}>{t('Podpora')}</a>
        </footer>
      )}

      {items.length === 0 && (
        <button className="fab" onClick={() => setDialog({ kind: 'add' })} aria-label={t('Přidat položku')}>
          <PlusIcon />
        </button>
      )}

      {items.length > 0 && (
        <Dock
          tab={tab}
          wishCount={wishlist.length}
          onTab={setTab}
          onAdd={() => {
            haptic();
            setDialog({ kind: 'add' });
          }}
        />
      )}

      {dialog?.kind === 'share' && (
        <Modal title={t('Sdílet portfolio')} onClose={close}>
          <ShareDialog positions={allPositions} currency={currency} eurCzk={market?.eurCzk ?? null} />
        </Modal>
      )}

      {dialog?.kind === 'position' && (() => {
        const p = findPosition(dialog.key);
        if (!p) return null;
        return (
          <Modal title={t('Detail produktu')} onClose={close}>
            <PositionDetail
              alt={altQuotes.get(p.key) ?? null}
              valuation={valuation}
              position={p}
              currency={currency}
              market={market}
              onEditLot={(lot) => setDialog({ kind: 'edit', item: lot, back: p.key })}
              onSell={() => setDialog({ kind: 'sell', key: p.key })}
              onSaveAlerts={(a, b) => saveAlerts(p, a, b)}
              portfolios={premium.isPremium && portfolios.length > 1 ? portfolios : undefined}
              onMove={(to) => movePosition(p, to)}
              onAddLot={() => {
                const h = p.head;
                setDialog({
                  kind: 'add',
                  template: {
                    name: h.name, game: h.game, set: h.set, type: h.type, quantity: 1, buyPrice: 0, buyDate: new Date().toISOString().slice(0, 10),
                    fees: 0, currentPrice: 0, note: '', setLogo: h.setLogo, productImage: h.productImage,
                    cmProductId: h.cmProductId, cmName: h.cmName, priceAuto: h.priceAuto, portfolioId: h.portfolioId,
                  },
                });
              }}
            />
          </Modal>
        );
      })()}

      {dialog?.kind === 'sell' && (() => {
        const p = findPosition(dialog.key);
        if (!p) return null;
        return (
          <Modal title={t('Prodat')} onClose={() => setDialog({ kind: 'position', key: p.key })}>
            <SellDialog
              position={p}
              currency={currency}
              onCancel={() => setDialog({ kind: 'position', key: p.key })}
              onSave={async (updated, realized) => {
                const byId = new Map(updated.map((u) => [u.id, u]));
                await replaceAll(items.map((it) => byId.get(it.id) ?? it));
                setDialog({ kind: 'position', key: p.key });
                showToast(t('Prodáno · realizovaný zisk {0}{1} Kč', realized >= 0 ? '+' : '−', Math.abs(Math.round(realized)).toLocaleString(LOCALE)));
              }}
            />
          </Modal>
        );
      })()}

      {(dialog?.kind === 'add' || dialog?.kind === 'edit') && (
        <Modal title={dialog.kind === 'add' ? (dialog.template ? t('Nová dávka') : t('Nová položka')) : t('Upravit dávku')} onClose={dialog.kind === 'edit' && dialog.back ? () => setDialog({ kind: 'position', key: dialog.back! }) : close}>
          <ItemForm
            key={dialog.kind === 'edit' ? dialog.item.id : `new-${formKey}`}
            initial={dialog.kind === 'edit' ? dialog.item : dialog.template}
            asNew={dialog.kind === 'add'}
            defaultGame={lastGame}
            currency={currency}
            market={market}
            marketError={marketError}
            setSuggestions={sets}
            onCancel={close}
            onSubmit={async (input, addAnother) => {
              if (dialog.kind === 'edit') {
                await update(dialog.item.id, input);
                if (dialog.back) setDialog({ kind: 'position', key: dialog.back });
                else close();
                showToast(t('Uloženo'));
                return;
              }
              await add({ ...input, portfolioId: dialog.template?.portfolioId ?? targetPf });
              setLastGame(input.game);
              showToast(t('Přidáno: {0}', input.name));
              if (addAnother) setFormKey((k) => k + 1);
              else close();
            }}
            onDelete={
              dialog.kind === 'edit'
                ? async () => {
                    if (confirm(t('Opravdu smazat tuto dávku „{0}“?', dialog.item.name))) {
                      await remove(dialog.item.id);
                      // když produkt má další dávky, vrať se do jeho detailu
                      const back = dialog.back;
                      if (back && (findPosition(back)?.lots.length ?? 0) > 1) setDialog({ kind: 'position', key: back });
                      else close();
                    }
                  }
                : undefined
            }
          />
        </Modal>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      {dialog?.kind === 'settings' && (
        <Modal title={t('Nastavení')} onClose={close}>
          <SettingsPanel
            items={items}
            currency={currency}
            onCurrency={setCurrency}
            market={market}
            marketLoading={marketLoading}
            marketError={marketError}
            unlinked={unlinked.length}
            onRefresh={() => refreshMarket(true)}
            onAutoLink={autoLink}
            wishlist={wishlist}
            valuation={valuation}
            onValuation={setValuation}
            onImport={handleImport}
            portfolios={portfolios}
            counts={pfCounts}
            onRenamePortfolio={renamePortfolio}
            onDeletePortfolio={deletePortfolio}
            onLogin={() => setDialog({ kind: 'auth' })}
          />
        </Modal>
      )}

      {dialog?.kind === 'auth' && (
        <Modal title={t('Účet SealedVault')} onClose={close}>
          <AuthForm onDone={() => { close(); showToast(t('Přihlášeno – synchronizuji data')); }} />
        </Modal>
      )}

      {cloud.recovery && (
        <Modal title={t('Nové heslo')} onClose={() => void 0}>
          <RecoveryForm onDone={() => showToast(t('Heslo změněno'))} />
        </Modal>
      )}

      {premium.paywall && (
        <Modal title={t('Premium')} onClose={premium.closePaywall}>
          <PremiumDialog feature={premium.paywall} />
        </Modal>
      )}
    </div>
  );
}
