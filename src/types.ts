export const GAMES = ['Pokémon', 'One Piece', 'Riftbound'] as const;
export type Game = (typeof GAMES)[number];

export const PRODUCT_TYPES = [
  'Booster box',
  'ETB',
  'Display',
  'Booster bundle',
  'UPC',
  'Premium Collection',
  'Collection box',
  'Tin',
  'Blister',
  'Booster',
  'Deck',
  'Jiné',
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export type Currency = 'CZK' | 'EUR';

/** Štítky stavu produktu; „good“ = v pořádku, „warn“ = vada, „bad“ = otevřené */
export const CONDITIONS = [
  { id: 'Perfektní', tone: 'good' },
  { id: 'Natržená fólie', tone: 'warn' },
  { id: 'Bez fólie', tone: 'warn' },
  { id: 'Promáčklý roh', tone: 'warn' },
  { id: 'Poškozená krabice', tone: 'warn' },
  { id: 'Vybledlé', tone: 'warn' },
  { id: 'Otevřené', tone: 'bad' },
] as const;
export type Condition = (typeof CONDITIONS)[number]['id'];
export const conditionTone = (c: string): 'good' | 'warn' | 'bad' =>
  CONDITIONS.find((x) => x.id === c)?.tone ?? 'warn';

/** Prodej části nebo celé nákupní dávky */
export interface Sale {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  quantity: number;
  /** Prodejní cena za kus (Kč) */
  price: number;
  /** Poplatky a poštovné za tento prodej celkem (Kč) */
  fees: number;
  note?: string;
}

/** Jedna položka = jedna nákupní dávka (stejný produkt může mít víc dávek) */
export interface PortfolioItem {
  id: string;
  name: string;
  game: Game;
  set: string;
  type: ProductType;
  quantity: number;
  /** Nákupní cena za kus */
  buyPrice: number;
  /** ISO datum (YYYY-MM-DD) */
  buyDate: string;
  /** Poštovné / poplatky celkem za položku */
  fees: number;
  /** Aktuální tržní cena za kus (ruční zadání) */
  currentPrice: number;
  note: string;
  /** Stav produktu – štítky (např. „Natržená fólie“) */
  condition?: string[];
  /** Prodeje z této nákupní dávky (částky v Kč) */
  sales?: Sale[];
  /** Další fotky produktu (zmenšené data URL), např. detail poškození */
  photos?: string[];
  /** Cenový alert: upozornit, když aktuální cena / ks stoupne nad (Kč) */
  alertAbove?: number;
  /** Cenový alert: upozornit, když aktuální cena / ks klesne pod (Kč) */
  alertBelow?: number;
  /** Vlastní obrázek produktu: zmenšená fotka (data URL) nebo odkaz (https://…) */
  image?: string;
  /** Logo edice z katalogu – použije se, když chybí vlastní obrázek */
  setLogo?: string;
  /** Obrázek produktu z TCGplayeru (doplní se sám po spárování) */
  productImage?: string;
  /** Napárovaný produkt na Cardmarketu (idProduct) */
  cmProductId?: number;
  cmName?: string;
  /** true/undefined = aktuální cena se bere z Cardmarketu; false = ruční */
  priceAuto?: boolean;
  /** Kdy byla aktuální cena naposledy převzata z Cardmarketu */
  priceUpdatedAt?: string;
  /** Portfolio, do kterého položka patří (prázdné = Hlavní) */
  portfolioId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Produkt, který chceš koupit */
export interface WishlistItem {
  id: string;
  name: string;
  game: Game;
  set: string;
  type: ProductType;
  cmProductId?: number;
  productImage?: string;
  /** Cílová nákupní cena / ks (Kč) – při dosažení přijde upozornění */
  targetPrice?: number;
  note?: string;
  createdAt: string;
}

/** Data formuláře – bez systémových polí */
export type PortfolioItemInput = Omit<PortfolioItem, 'id' | 'createdAt' | 'updatedAt'>;
