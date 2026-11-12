# SealedVault – příprava na App Store

Stav k 13. 11. 2026. Mobilní appka je v `mobile/` (Expo SDK 58).

## Hotovo v repozitáři

| Co | Kde |
|---|---|
| Identifikátor appky `app.sealedvault` (iOS i Android) | `mobile/app.json` |
| Ikony 1024 px z loga webu | `mobile/assets/images/`, generuje `mobile/scripts/make-icons.mjs` |
| Nastavení sestavení (preview pro testery, production s automatickým číslem buildu) | `mobile/eas.json` |
| Texty do obchodu CZ + EN (název, podtitul, popis, klíčová slova, kategorie, věkové hodnocení) | `mobile/store.config.json` |
| Zásady ochrany soukromí CZ + EN | `docs/privacy.html` (zatím nezveřejněné) |
| Prohlášení o šifrování (jen standardní HTTPS) | `mobile/app.json` → `usesNonExemptEncryption: false` |
| Smazání účtu v appce (požadavek Applu) | Účet → Smazat účet |

## Co je potřeba od tebe

1. **Apple Developer Program** (99 $ ročně) – developer.apple.com/programs. Schválení může trvat i pár dní.
2. **Zveřejnit zásady soukromí** – URL `https://adaminooo.github.io/sealedvault/privacy.html` (stačí přidat soubor na web).
3. **Přihlášení k Applu při prvním sestavení** – `npx eas-cli@latest build -p ios --profile production` se zeptá na Apple ID; přihlášení zadáváš sám.
4. **Screenshoty** – min. 3 z iPhonu 6,9" (např. iPhone 16/17 Pro Max): Portfolio, detail produktu, Analýza, Wishlist.
5. **Testovací účet pro kontrolu Applu** – recenzent potřebuje přihlášení s ukázkovými daty (založ ho sám, údaje se zadávají v App Store Connect → App Review Information, ne do repozitáře).

## Dotazník „App Privacy“ v App Store Connect

Sledování (tracking): **Ne**.

| Kategorie Applu | Typ | Propojeno s uživatelem | Účel |
|---|---|---|---|
| Contact Info | Email Address | Ano | App Functionality |
| User Content | Photos or Videos | Ano | App Functionality |
| User Content | Other User Content (portfolio, wishlist, poznámky) | Ano | App Functionality |
| Identifiers | Device ID (push token) | Ano | App Functionality |

Nesbírá se: poloha, kontakty, zdraví, finanční údaje (platby), historie prohlížení, diagnostika, reklamní identifikátory.

## Rizika při kontrole

- **Ochranné známky** – „Pokémon“ / „One Piece“ v klíčových slovech a popisu jsou popisné (pro jaké produkty appka je). Apple je obvykle toleruje, ale při zamítnutí je stačí z klíčových slov odebrat.
- **Premium** – dokud není napojené přes nákupy v App Store (RevenueCat), nesmí appka nabízet placení jinou cestou. Mobilní appka zatím Premium nemá.
- **Push v Expo Go** – spolehlivě funguje až ve vlastním sestavení (TestFlight).
