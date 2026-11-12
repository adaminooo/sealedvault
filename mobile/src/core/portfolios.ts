import type { PortfolioItem } from './types';

export interface Portfolio {
  id: string;
  name: string;
}

export const MAIN_ID = 'main';
/** „Vše“ = všechna portfolia dohromady */
export const ALL_ID = 'all';
export const DEFAULT_PORTFOLIOS = { list: [{ id: MAIN_ID, name: 'Hlavní' }] as Portfolio[] };

export const portfolioOf = (it: Pick<PortfolioItem, 'portfolioId'>) => it.portfolioId || MAIN_ID;

export function newPortfolioId(): string {
  return 'p' + Math.random().toString(36).slice(2, 9);
}
