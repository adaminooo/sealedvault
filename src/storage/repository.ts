import type { PortfolioItem } from '../types';

/**
 * Abstrakce úložiště. Aplikace pracuje jen s tímto rozhraním,
 * takže později jde přidat např. CloudRepository (Supabase, Firebase…)
 * nebo SyncRepository, který kombinuje lokální a cloudová data.
 */
export interface Repository<T extends { id: string }> {
  getAll(): Promise<T[]>;
  put(item: T): Promise<void>;
  remove(id: string): Promise<void>;
  /** Nahradí všechna data (použito při importu) */
  replaceAll(items: T[]): Promise<void>;
}

export type PortfolioRepository = Repository<PortfolioItem>;
