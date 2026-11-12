import type { PortfolioItem, WishlistItem } from './types';

/** Záloha ve stejném formátu jako web (Nastavení → Záloha) – jde nahrát zpět na webu i v appce */
export function toJson(items: PortfolioItem[], wishlist: WishlistItem[] = []): string {
  return JSON.stringify({ app: 'sealedvault', version: 2, exportedAt: new Date().toISOString(), items, wishlist }, null, 2);
}

export function backupFilename(ext: string): string {
  return `sealed-portfolio-${new Date().toISOString().slice(0, 10)}.${ext}`;
}
