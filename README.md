# SealedVault TCG – portfolio sealed produktů (Pokémon, One Piece & Riftbound)

PWA pro sledování portfolia sealed TCG produktů. Vite + React + TypeScript, bez vlastního serveru.
Data uživatele jsou jen v jeho zařízení (IndexedDB), ceny z trhů jsou statické soubory, které
jednou denně připraví GitHub Actions.

**Appka:** https://adaminooo.github.io/sealedvault/

## Jak to funguje

```
GitHub Actions (každý den 6:30 UTC + při každém pushi do main)
  └─ scripts/build-data.mjs
       ├─ ceny: Cardmarket (Pokémon, One Piece), TCGplayer přes tcgcsv.com (Riftbound), kurzy ČNB
       ├─ uloží denní záznam do data-src/own/YYYY-MM-DD.json (commit do repozitáře)
       ├─ spojí historii: archiv TCGplayeru (data-src/tcg-history, od 8. 2. 2024) + vlastní denní záznam
       └─ zapíše dist/data/*.json  →  nasazení na GitHub Pages
Appka (prohlížeč) čte jen dist/data/*.json – žádný server, žádné limity nasazení.
```

Výstupní data (`/data/`):

| soubor | obsah |
|---|---|
| `prices.json` | sealed produkty s cenami + kurzy |
| `tcg.json` | druhý trh (TCGplayer) pro Pokémon a One Piece, obrázky produktů |
| `h/0…63.json`, `h/meta.json` | historie cen rozdělená do košů (id % 64) |
| `rates.json` | kurzy ČNB od roku 2024 |
| `sets-pokemon.json`, `sets-onepiece.json` | katalogy edic |

## Lokálně

Potřebuješ Node.js 20+.

```bash
npm install
npm run dev        # vývojový server na http://localhost:5173
npm run build      # produkční build do dist/
npm run data       # stáhne ceny a vygeneruje dist/data (bez zápisu denního záznamu)
npm run preview    # produkční build na http://localhost:4173
```

PC verze (zástupce **SealedVault** na ploše, `scripts/launch.ps1`) běží na `localhost:4173`.
Když u sebe nemá složku `dist/data`, bere data z veřejné adresy appky.

### Starší historie cen

`npm run backfill -- 2024-02-08` stáhne týdenní archiv cen TCGplayeru (https://tcgcsv.com, archiv od
8. 2. 2024) a výsledek uloží do `.backfill/out`. Ten se zkopíruje do `data-src/tcg-history`.
U produktů z Cardmarketu se ceny přepočtou kurzem ČNB a srovnají na úroveň Cardmarketu v den,
kdy začal vlastní denní záznam (aby graf neskočil).

## Funkce

- portfolio s nákupními dávkami, prodeje metodou FIFO, více portfolií (Premium)
- ceny z Cardmarketu a TCGplayeru (jen anglické verze), porovnání trhů, volba ocenění
- denní změna hodnoty, historie cen produktů i portfolia, analytika (XIRR, top/flop, koncentrace…)
- wishlist s cílovou cenou, cenové alerty (Premium)
- sdílení portfolia odkazem – snímek je zakomprimovaný přímo v odkazu (`#s=…`), nic se neukládá
- čeština / angličtina (Nastavení → Jazyk), texty v `src/i18n`
- Premium zatím jako 14denní zkušební verze bez plateb (`src/lib/premium.tsx`)

## Instalace na telefon

- **iPhone (Safari):** otevři adresu appky → Sdílet → *Přidat na plochu*.
- **Android (Chrome):** menu ⋮ → *Nainstalovat aplikaci*.

Data jsou v každém zařízení zvlášť. Přeneseš je přes Nastavení → Záloha (JSON) a import.

## Logo a ikony

Zdroj loga je `public/logo.svg`, ikony vygeneruje `npm run icons`.
