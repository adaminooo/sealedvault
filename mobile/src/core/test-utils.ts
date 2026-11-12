import type { PortfolioItem } from './types';

/** Testovací dávka s rozumnými výchozími hodnotami */
export function lot(p: Partial<PortfolioItem> = {}): PortfolioItem {
  return {
    id: p.id ?? 'a',
    name: 'Prismatic Evolutions ETB',
    game: 'Pokémon',
    set: 'Prismatic Evolutions',
    type: 'ETB',
    quantity: 2,
    buyPrice: 1000,
    buyDate: '2025-01-01',
    fees: 0,
    currentPrice: 1500,
    note: '',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...p,
  } as PortfolioItem;
}
