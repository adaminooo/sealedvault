import { useSyncExternalStore } from 'react';

import type { PortfolioItem, WishlistItem } from '@/core/types';

import { driver } from './driver';
import type { StoreName } from './types';

type Rec = { id: string; updatedAt?: string; createdAt?: string };
export type ChangeKind = 'item' | 'wish';
const KIND: Record<StoreName, ChangeKind> = { items: 'item', wishlist: 'wish' };

/** Posluchač změn pro synchronizaci (napojí se v etapě B – účty) */
type ChangeListener = (kind: ChangeKind, id: string, deleted: boolean, at?: string) => void;
let onChange: ChangeListener = () => {};
export function setChangeListener(fn: ChangeListener) {
  onChange = fn;
}

const stamp = (v: Rec) => v.updatedAt ?? new Date().toISOString();

/**
 * Kolekce záznamů: data v paměti (okamžité vykreslení) + trvale v databázi.
 * Stejné rozhraní jako webové úložiště (get/getAll/put/remove/putRaw/removeRaw/replaceAll).
 */
export class Collection<T extends Rec> {
  private rows: T[] = [];
  private loaded: Promise<void> | null = null;
  private listeners = new Set<() => void>();

  constructor(private store: StoreName) {}

  load(): Promise<void> {
    this.loaded ??= driver.all(this.store).then((list) => {
      this.rows = list.flatMap((j) => {
        try {
          return [JSON.parse(j) as T];
        } catch {
          return [];
        }
      });
      this.emit();
    });
    return this.loaded;
  }

  private emit() {
    this.rows = [...this.rows];
    for (const l of this.listeners) l();
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    this.load();
    return () => {
      this.listeners.delete(l);
    };
  };
  snapshot = () => this.rows;

  async get(id: string) {
    await this.load();
    return this.rows.find((r) => r.id === id);
  }
  async getAll() {
    await this.load();
    return this.rows;
  }

  /** Zápis bez nahlášení synchronizaci (data přišla ze serveru) */
  async putRaw(item: T) {
    await this.load();
    const i = this.rows.findIndex((r) => r.id === item.id);
    if (i >= 0) this.rows[i] = item;
    else this.rows.push(item);
    this.emit();
    await driver.put(this.store, item.id, JSON.stringify(item));
  }
  async removeRaw(id: string) {
    await this.load();
    this.rows = this.rows.filter((r) => r.id !== id);
    this.emit();
    await driver.remove(this.store, id);
  }

  async put(item: T) {
    await this.putRaw(item);
    onChange(KIND[this.store], item.id, false, stamp(item));
  }
  async remove(id: string) {
    await this.removeRaw(id);
    onChange(KIND[this.store], id, true);
  }
  async replaceAll(next: T[]) {
    await this.load();
    const before = new Map(this.rows.map((x) => [x.id, JSON.stringify(x)]));
    const after = new Set(next.map((x) => x.id));
    this.rows = [...next];
    this.emit();
    await driver.replace(this.store, next.map((x) => [x.id, JSON.stringify(x)]));
    for (const it of next) if (before.get(it.id) !== JSON.stringify(it)) onChange(KIND[this.store], it.id, false, stamp(it));
    for (const id of before.keys()) if (!after.has(id)) onChange(KIND[this.store], id, true);
  }
}

export const items = new Collection<PortfolioItem>('items');
export const wishlist = new Collection<WishlistItem>('wishlist');

/** Živý seznam záznamů kolekce (překreslí se po každé změně) */
export function useCollection<T extends Rec>(c: Collection<T>): T[] {
  return useSyncExternalStore(c.subscribe, c.snapshot, c.snapshot);
}
