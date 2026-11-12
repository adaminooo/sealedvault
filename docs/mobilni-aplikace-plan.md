# SealedVault – plán nativní mobilní aplikace (iOS + Android)

> Stav: **návrh ke schválení**. Nic z toho zatím není implementováno; web zůstává beze změny.
> Stack: React Native · Expo · TypeScript · Expo Router · EAS Build.

---

## Shrnutí v kostce

- **Mobilní appka vznikne jako nový projekt ve složce `mobile/`** ve stejném repozitáři. Web (`src/`) se nemění.
- **Data a účty zůstávají stejné** – stejný Supabase projekt, stejná tabulka `user_data`, stejný formát záznamů.
  Uživatel se v mobilní appce přihlásí stejným účtem a uvidí stejné portfolio jako na webu/PC (obousměrně).
- **Ceny a historie** appka čte ze stejných denních souborů na GitHub Pages (`/data/*.json`), které už dnes generuje GitHub Actions.
- **Převezmeme logiku, přepíšeme vzhled.** Výpočty portfolia (≈ 1 300 řádků) jsou čistý TypeScript a půjdou použít téměř beze změny.
  Celé UI (komponenty + CSS, ≈ 6 300 řádků) se navrhne znovu podle nativních zásad – ne převodem webu.
- **Nové věci, které web nemá:** push notifikace z backendu, fotoaparát/skener, nákup Premium přes App Store / Google Play, mazání účtu v appce (povinné pro App Store).
- **Odhad:** cca **6–8 týdnů** práce do první verze v TestFlight / interním testu Google Play, cca **9–11 týdnů** do zveřejnění v obchodech (podrobně níže).

---

## FÁZE 1 – Audit současného projektu

### Struktura

| Část | Kde | Rozsah | Poznámka |
|---|---|---|---|
| UI komponenty | `src/components` (29) | 4 422 ř. | React DOM, HTML elementy, CSS třídy |
| Styly | `src/index.css` | 1 830 ř. | design tokeny v `:root`, glass efekty, animace |
| Hlavní obrazovka / stav | `src/App.tsx` | 771 ř. | záložky, dialogy, filtry, synchronizace |
| Logika | `src/lib` (18) | 2 190 ř. | viz rozdělení níže |
| Hooky | `src/hooks` (8) | 382 ř. | |
| Lokální úložiště | `src/storage` | 134 ř. | IndexedDB (`items`, `wishlist`) |
| Překlady | `src/i18n` | 639 ř. | čeština = klíč, `en.ts` slovník |
| Serverová část | `server/*.mjs`, `scripts/*.mjs` | 1 121 ř. | běží v GitHub Actions, ne v prohlížeči |

**Frontend:** Vite 8 + React 19 + TypeScript, PWA (service worker), bez routeru (záložky přes stav).

### Databáze a schéma (Supabase, projekt `xvoosxlqoyrbefvwkdgm`)

- Tabulka `public.user_data` (`user_id`, `kind` = `item` | `wish` | `settings`, `id`, `data jsonb`, `deleted`, `client_at`, `updated_at`).
- RLS: každý uživatel čte a mění jen svoje řádky. `updated_at` nastavuje trigger (serverový čas = kurzor pro stahování změn).
- Záznam `item` = celý `PortfolioItem` jako JSON (včetně fotek jako data URL), `wish` = `WishlistItem`, `settings/portfolios` = seznam portfolií.

### API a cenové zdroje

| Zdroj | Jak se používá dnes | Pro mobil |
|---|---|---|
| Cardmarket price guide (Pokémon, One Piece) | GitHub Actions denně → `data/prices.json` | **beze změny** – appka čte JSON z GitHub Pages |
| TCGplayer přes TCGCSV (Riftbound + druhý trh) | Actions → `prices.json`, `tcg.json` | beze změny |
| Archiv TCGCSV (historie od 2/2024) | jednorázově → `data-src/tcg-history` → `data/h/*.json` | beze změny |
| ČNB kurzy | Actions → `rates.json` | beze změny |
| Katalog edic (pokemontcg.io / TCGplayer) | Actions → `sets-*.json` | beze změny |
| Obrázky produktů | přímé odkazy na CDN TCGplayeru | `expo-image` s diskovou mezipamětí |

Žádné tajné klíče nejsou potřeba – všechna cenová data jsou veřejné statické soubory.

### Autentizace

Supabase Auth, e-mail + heslo, potvrzení e-mailu, obnova hesla odkazem. V appce jen veřejný klíč `sb_publishable_…`.

### Výpočty portfolia, wishlist, analytika

Pozice z nákupních dávek (FIFO prodeje), hodnota/zisk/realizovaný zisk, XIRR, likvidační hodnota, koncentrace (HHI), výkon po skupinách,
denní/týdenní změna, série vývoje portfolia, cenové alerty (nad/pod, cíl wishlistu), více portfolií, Premium (zatím jen zkušební verze v zařízení).

### Co lze znovu použít a co přepsat

| Soubor / oblast | Verdikt | Proč |
|---|---|---|
| `lib/calc.ts`, `portfolio.ts`, `performance.ts`, `filters.ts`, `changes.ts`, `portfolios.ts` | ✅ **převzít beze změny** | čistý TypeScript bez prohlížeče |
| `lib/format.ts`, `lib/history.ts` | ✅ převzít + malý adaptér | závisí jen na jazyku (`i18n`) a načítání dat (`data.ts`) |
| `lib/market.ts` (párování, ocenění, `inferType`, `bestMatch`) | ✅ převzít, vyměnit mezipaměť | `localStorage` → AsyncStorage/MMKV |
| `lib/cloud.ts` (synchronizace, fronta, LWW) | ✅ **převzít logiku**, vyměnit úložiště | IndexedDB/`localStorage` → SQLite/MMKV; protokol se serverem stejný |
| `i18n/en.ts` + funkce `t()` | ✅ převzít | slovník je čistá data |
| `types.ts` | ✅ převzít | |
| `lib/alerts.ts` | 🔁 částečně | vyhodnocení převzít, oznámení → push z backendu + `expo-notifications` |
| `lib/backup.ts` (JSON/CSV) | 🔁 částečně | parsování převzít, stahování souborů → `expo-sharing` / `expo-document-picker` |
| `lib/share.ts` | 🔁 částečně | kódování odkazu převzít (`CompressionStream` → knihovna `fflate`) |
| `lib/image.ts` (zmenšení fotek) | ❌ přepsat | `expo-image-manipulator` |
| `lib/premium.tsx` | ❌ přepsat | nákup přes App Store / Google Play (RevenueCat) |
| `lib/motion.ts`, `useCountUp` | ❌ přepsat | Reanimated + `expo-haptics` |
| `storage/indexedDbRepository.ts` | ❌ přepsat | `expo-sqlite` (stejné rozhraní `Repository`) |
| Všech 29 komponent + `index.css` | ❌ **navrhnout znovu** | nativní obrazovky, ne převod webu |
| `server/*`, `scripts/*`, GitHub Actions | ✅ beze změny | sdílený zdroj dat pro web i mobil |

**Poměr:** zhruba **1 500 řádků logiky převezmeme**, **≈ 6 500 řádků UI napíšeme nově** (v nativním podání bude kratší – odpadne CSS a webové obcházení).

---

## FÁZE 2 – Architektura React Native + Expo

### Umístění kódu

```
Sealed Portfolio/
├─ src/            ← web (beze změny)
├─ server/, scripts/, data-src/   ← denní data (beze změny)
├─ supabase/       ← schéma DB + šablony e-mailů (+ nové: funkce pro push)
└─ mobile/         ← NOVÁ Expo appka
   ├─ app/                 Expo Router (obrazovky)
   │  ├─ (tabs)/           Portfolio · Analýza · Wishlist · Účet
   │  ├─ product/[key].tsx detail produktu
   │  ├─ add.tsx           přidání (formSheet)
   │  ├─ sell/[key].tsx    prodej (formSheet)
   │  └─ auth/…            přihlášení, registrace, nové heslo
   ├─ src/core/            převzatá logika (calc, portfolio, performance, filters, market, sync…)
   ├─ src/data/            načítání denních dat + mezipaměť
   ├─ src/db/              SQLite úložiště + fronta synchronizace
   ├─ src/ui/              design systém (tokeny, komponenty)
   └─ app.config.ts, eas.json
```

**Sdílení kódu s webem:** v 1. kroku se čisté moduly **zkopírují** do `mobile/src/core` (web zůstane netknutý).
Až bude mobil stabilní, navrhuji je přesunout do sdílené složky `shared/`, kterou budou používat oba projekty – jeden zdroj pravdy pro výpočty.
(To už je drobná úprava webu → samostatné schválení.)

### Knihovny (instalace přes `npx expo install`, verze podle aktuálního SDK)

| Účel | Knihovna |
|---|---|
| Navigace | Expo Router (NativeTabs, Stack, formSheet) |
| Nativní ovládací prvky | `@expo/ui` (SwiftUI / Jetpack Compose: segmenty, přepínače, menu, pickery, sheety) |
| Animace, gesta | `react-native-reanimated`, `react-native-gesture-handler` |
| Grafy | `@shopify/react-native-skia` (výkonné, plynulé čáry, gradienty) |
| Seznamy | `@shopify/flash-list` |
| Lokální data | `expo-sqlite` (položky, wishlist, fronta) + `react-native-mmkv` (nastavení) |
| Účty, DB | `@supabase/supabase-js` + `expo-secure-store` (bezpečné uložení přihlášení) |
| Data z GitHub Pages | `@tanstack/react-query` (mezipaměť, offline, obnovení při návratu do appky) |
| Obrázky | `expo-image` (disková mezipaměť) |
| Fotoaparát, galerie | `expo-camera`, `expo-image-picker`, `expo-image-manipulator` |
| Skener čárových kódů | `expo-camera` (EAN/UPC) |
| Push notifikace | `expo-notifications` + Expo Push Service |
| Haptika, sklo | `expo-haptics`, `expo-blur` / `expo-glass-effect` (iOS liquid glass) |
| Nákupy Premium | RevenueCat (`react-native-purchases`) |
| Sdílení, soubory | `expo-sharing`, `expo-document-picker`, `expo-file-system` |
| Písma | `@expo-google-fonts/inter`, `space-grotesk` |
| Aktualizace bez obchodu | EAS Update |

Pro `react-native-mmkv`, RevenueCat a push je potřeba **development build** (Expo Go nestačí) – připravíme přes EAS.

---

## FÁZE 3 – Design systém mobilní aplikace

Zachová identitu SealedVault, ale v nativním podání.

**Tokeny** (jeden soubor `mobile/src/ui/theme.ts`, převzaté z webu):
- pozadí `#050507`, povrchy `#0d0d12` / `#15151d` / `#1f1f2a`, okraje `rgba(255,255,255,.07/.14)`
- značka: fialová `#8f6bff`, přechod `#9b7bff → #6d5cff → #4f7dff`, světlá fialová `#a99dff`
- zisk `#3ddc84`, ztráta `#ff4d6a`, zlatá jen pro Premium `#ffc65c`
- barvy her: Pokémon `#b08a0c`, One Piece `#d0517a`, Riftbound `#2b9fd6`
- písma: Space Grotesk (čísla, nadpisy), Inter (text); čísla vždy `tabular-nums`
- zaoblení 12 / 16 / 20 px, mezery v rastru 4 px, jednotná sada ikon (SF Symbols na iOS, Material Symbols na Androidu)

**Nativní principy místo webových:**
- spodní lišta = systémové `NativeTabs` (na iOS 26 liquid glass, na Androidu Material 3), ne vlastní kreslená
- velké nadpisy obrazovek, které se při scrollu zmenší do hlavičky
- dialogy → **formSheet** s úchytem (detenty: polovina / celá obrazovka), ne středová okna
- swipe na řádku produktu (Prodat / Upravit / Smazat), dlouhé podržení = kontextové menu s náhledem
- haptika u zisku/ztráty, uložení, přepnutí, potažení pro obnovení cen
- pull-to-refresh místo tlačítka „Obnovit ceny“
- klávesnice: číselná pro ceny, „Další“ přeskočí na další pole, formulář se nekryje klávesnicí
- respektuje systémové „Omezit pohyb“ a velikost písma (Dynamic Type)

---

## FÁZE 4 – Migrace obrazovek

| Web | Mobil | Nativní řešení | Priorita |
|---|---|---|---|
| Hlavní karta (Summary) + graf | **Portfolio** – hlavička | velké číslo s count-up, sparkline (Skia), denní změna, přepínač portfolií jako segment v hlavičce | 1 |
| Seznam / mřížka položek | **Portfolio** – seznam | FlashList, řádek s mini grafem, swipe akce, filtry jako horizontální „chips“ + sheet s detailními filtry, řazení přes nativní menu | 1 |
| Detail produktu | `product/[key]` (push) | graf ceny s dotykovým kurzorem + haptika, porovnání trhů, dávky, galerie (zoom gestem), alert | 1 |
| Přidat položku (ItemForm) | `add` (formSheet) | vyhledávání nahoře, **skener čárového kódu**, foto z fotoaparátu, nativní pickery (hra, typ), datum = nativní kalendář | 1 |
| Prodej | `sell/[key]` (formSheet) | stepper počtu, náhled zisku, potvrzení s haptikou | 2 |
| Analýza | záložka **Analýza** | interaktivní graf (Skia) s výběrem období, KPI karty, Výkon, likvidace, koncentrace | 2 |
| Wishlist | záložka **Wishlist** | seznam s cílovou cenou, swipe „Koupeno“ → přidání do portfolia | 2 |
| Nastavení + Účet | záložka **Účet** | `@expo/ui` seznam (jako Nastavení v iOS): účet, synchronizace, měna, jazyk, notifikace, záloha, Premium, podpora, **smazat účet** | 2 |
| Přihlášení / registrace / nové heslo | `auth/*` | nativní formuláře, automatické vyplnění hesla z klíčenky (iOS) / Google | 1 |
| Premium | sheet „Premium“ | nativní nákup (RevenueCat), obnovení nákupů | 3 |
| Sdílení portfolia | systémový share sheet | stejný odkaz `#s=…` jako web (otevře se webová stránka) | 3 |
| Zvoneček alertů | push notifikace + seznam v záložce Účet | | 2 |
| Záloha JSON/CSV | Účet → Záloha | `expo-sharing` (uložit do Souborů), import z `expo-document-picker` | 3 |

---

## FÁZE 5 – Napojení na databázi a API

### Data uživatele (Supabase) – kompatibilita

- **Stejná tabulka `user_data`, stejný formát JSON** → web, PC verze i mobil sdílejí jeden účet a synchronizují se navzájem.
- Mobil převezme **stejný synchronizační protokol** jako web (fronta změn, stahování podle `updated_at`, rozhodnutí podle `client_at`).
- Žádná destruktivní změna DB. Nové věci jen **přidáme** vedle (nové tabulky), existující se nemění:

```sql
-- jen přidání, nic se nemaže ani nepřejmenovává
create table public.push_tokens (
  user_id uuid references auth.users on delete cascade,
  token text primary key,
  platform text, updated_at timestamptz default now()
);           -- + RLS „jen vlastní“
create table public.alert_log (…);   -- které alerty už byly odeslány (aby nechodily opakovaně)
```

### Fotky

Dnes jsou fotky uložené přímo v JSON záznamu (data URL). Pro mobil (víc fotek z fotoaparátu) navrhuji **Supabase Storage**:
soukromý bucket `photos/{user_id}/…` s RLS, v záznamu jen odkaz. **Zpětně kompatibilní:** staré záznamy s data URL zůstanou funkční,
nové fotky půjdou do Storage; web se naučí oba formáty v samostatném kroku.

### Ceny a historie

Beze změny – `https://adaminooo.github.io/sealedvault/data/…`. React Query: mezipaměť na disku, obnovení při otevření appky a pull-to-refresh, funguje offline.

### Push notifikace pro cenové alerty (citlivá operace na backendu)

Vyhodnocení musí běžet na serveru, aby notifikace přišla i se zavřenou appkou:

1. Appka po povolení uloží Expo push token do `push_tokens`.
2. **Supabase Edge Function `price-alerts`** (spouštěná denně po aktualizaci cen – cron / volání z GitHub Actions):
   načte nové ceny, projde alerty uživatelů (`user_data` → položky s `alertAbove/alertBelow`, wishlist s `targetPrice`), odešle push přes Expo Push API, zapíše do `alert_log`.
3. **Tajný klíč** (`service_role`) existuje **jen v Edge Function** (Supabase secrets) – nikdy v appce ani v repozitáři.

### Autentizace

- Supabase Auth (stejné účty), přihlášení uloženo v `expo-secure-store` (Keychain / Keystore), ne v obyčejném úložišti.
- Odkazy z e-mailů (potvrzení, nové heslo) → **universal links / App Links** na doménu appky, aby otevřely přímo appku.
- **Smazání účtu v appce** (povinné pro App Store) → Edge Function `delete-account` (smaže `user_data`, fotky, push tokeny a uživatele).
- Volitelně později: Přihlásit přes Apple / Google (pokud přidáme Google, Apple vyžaduje i „Sign in with Apple“).

### Premium

Apple a Google vyžadují pro digitální předplatné vlastní platby (provize 15 % / 30 %). Návrh: **RevenueCat** (zdarma do 2 500 $ měsíčně)
– sjednotí nákupy na iOS i Androidu a přes webhook zapíše stav Premium k účtu v Supabase, takže **Premium koupené v telefonu platí i na webu**.

---

## FÁZE 6 – Testování a publikování

### Testování

| Úroveň | Nástroj | Co |
|---|---|---|
| Jednotkové testy logiky | Jest | výpočty (FIFO, XIRR, změny, filtry), synchronizace proti falešnému serveru (stejný scénář jako dnes na webu, 12+ případů) |
| Komponenty | React Native Testing Library | formuláře, validace, stavy prázdný/chyba/načítání |
| End-to-end na zařízení | Maestro (EAS Workflows) | přihlášení → přidání položky → synchronizace na druhé zařízení → prodej → alert |
| Ruční | development build na iPhonu + Androidu | plynulost (60/120 fps), haptika, klávesnice, malé/velké displeje, tmavý režim |
| Kompatibilita dat | skript | účet s daty z webu otevřít v mobilu a naopak, porovnat hodnoty |

### Publikování

1. **Účty (založíš ty):** Apple Developer Program 99 $/rok, Google Play Console 25 $ jednorázově, Expo (EAS) – zdarma pro začátek, RevenueCat – zdarma.
2. **EAS Build** v cloudu – **Mac není potřeba**, iOS se sestaví na serverech Expo.
3. **Interní test:** TestFlight (iOS) a interní testování Google Play – ty + pár testerů.
4. **Podklady:** ikona 1024 px, snímky obrazovek (6,9″, 6,5″, Android), popis CZ/EN, **zásady ochrany soukromí** a **podmínky** (veřejná URL), dotazník soukromí (Apple „Nutrition labels“, Google „Data safety“), věkové hodnocení.
5. **Kontrola Apple / Google** (obvykle 1–3 dny), pak zveřejnění.
6. **Aktualizace:** drobné opravy přes EAS Update bez nového schvalování, nové funkce přes nové sestavení.

---

## Rizika

| Riziko | Dopad | Opatření |
|---|---|---|
| **Licence dat a obrázků** (Cardmarket price guide, obrázky z TCGplayer CDN) při placené appce v obchodech | vysoký – může vést k zamítnutí / stažení | před zveřejněním ověřit podmínky; připravit náhradu obrázků (vlastní fotky, logo edice) a uvést zdroje |
| **Ochranné známky** (Pokémon, One Piece, Riot) v názvu/ikoně/snímcích | střední | nepoužívat jejich loga a názvy v ikoně a názvu appky, jasné „neoficiální“ upozornění |
| **Apple odmítne Premium bez IAP** | vysoký | RevenueCat od první verze s placením |
| **Chybějící smazání účtu v appce** | vysoký (zamítnutí) | Edge Function `delete-account` ve verzi 1.0 |
| **Skener čárových kódů** – neexistuje veřejná databáze EAN kódů sealed produktů | střední | v 1.0 skener → vyhledání EAN ve vlastní tabulce, kterou si appka „učí“ (uživatel jednou spáruje kód s produktem, dál funguje všem); případně placená služba |
| **Velké fotky v DB** (limit 500 MB zdarma) | střední | Supabase Storage + zmenšení na ~1 200 px |
| **E-maily** – vestavěné odesílání Supabase posílá jen pár e-mailů/hod | vysoký pro spuštění | dokončit vlastní SMTP (rozpracováno: Gmail sealedvault.support) |
| **Dvě sady UI (web + mobil)** – víc údržby | střední | sdílená logika v `shared/`, UI zvlášť |
| **Výkon grafů a dlouhých seznamů** | střední | Skia + FlashList, testy na starším Androidu |
| **Plán GitHub Actions** (plánované běhy se vypnou po 60 dnech bez aktivity v repo) | nízký | denní commit cen udržuje repozitář aktivní; hlídat |

---

## Odhad náročnosti

| Etapa | Obsah | Odhad |
|---|---|---|
| A. Základ | Expo projekt, Router, design systém, převzetí logiky, SQLite, testy logiky | 1 týden |
| B. Účty a synchronizace | Supabase Auth, secure store, synchronizace (protokol z webu), odkazy z e-mailů | 1 týden |
| C. Portfolio + detail | dashboard, seznam, filtry, detail s grafem (Skia) | 1,5 týdne |
| D. Přidání a prodej | formuláře, vyhledávání, fotoaparát, skener (základ) | 1,5 týdne |
| E. Analýza, wishlist, účet | grafy, KPI, výkon, wishlist, nastavení, záloha | 1,5 týdne |
| F. Backend | Edge Functions (push alerty, smazání účtu), Storage pro fotky, `push_tokens` | 1 týden |
| G. Premium | RevenueCat, produkty v obchodech, propojení s účtem | 0,5–1 týden |
| H. Testy, ladění, podklady | Maestro, ladění na zařízeních, snímky, texty, soukromí | 1–1,5 týdne |
| I. Schvalování a vydání | TestFlight, kontrola Apple/Google, opravy | 0,5–1 týden |
| **Celkem** | | **≈ 9–11 týdnů** (první testovatelná verze po etapě E, ≈ 6–8 týdnů) |

Postup po etapách – po každé je appka spustitelná na telefonu (development build / TestFlight).

---

## Jak zachovat současná data a funkce

1. **Web se nemění** – běží dál na GitHub Pages, PC verze taky.
2. **Jeden účet, jedna databáze** – mobil čte a zapisuje stejné záznamy ve stejném formátu; synchronizace funguje web ↔ PC ↔ mobil.
3. **Uživatel bez účtu** – v mobilu si data založí znovu, nebo **naimportuje zálohu JSON** z webu (stejný formát), nebo se přihlásí a data se stáhnou.
4. **Změny DB jen přidáváním** (nové tabulky / bucket), žádné mazání ani přejmenování; každá změna jako SQL soubor v `supabase/` ke schválení.
5. **Tajné klíče jen na backendu** (Supabase secrets / GitHub secrets), v appce jen veřejný `sb_publishable_…`.
6. **Funkční shoda** – checklist všech funkcí webu (portfolia, dávky, FIFO, alerty, wishlist, analytika, sdílení, záloha, CZ/EN, Kč/€) se před vydáním odškrtá v mobilu.

---

## K rozhodnutí před startem

1. Schválit architekturu (samostatná `mobile/` appka, stejný Supabase, data z GitHub Pages).
2. Sdílení logiky: **kopie teď → sdílená složka `shared/` později** (doporučeno), nebo hned sdílená složka (drobná úprava webu).
3. Fotky do Supabase Storage (doporučeno) vs. nechat v JSON.
4. Premium přes RevenueCat (doporučeno) vs. první verze bez placení (jen zdarma + zkušební verze).
5. Skener: v 1.0 jen základ (vlastní učící se databáze kódů), nebo odložit na 1.1.
6. Rozsah 1.0: vše výše, nebo menší první verze (Portfolio + detail + přidání + účet + synchronizace) za ≈ 5–6 týdnů a zbytek v aktualizacích.
