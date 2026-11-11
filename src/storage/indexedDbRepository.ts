import type { PortfolioItem, WishlistItem } from '../types';
import type { PortfolioRepository, Repository } from './repository';

const DB_NAME = 'tcg-sealed-portfolio';
/** v2: přidán wishlist */
const DB_VERSION = 2;
const STORES = ['items', 'wishlist'] as const;
type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Obecné úložiště záznamů s `id` v jedné IndexedDB tabulce */
export class IndexedDbStore<T extends { id: string }> implements Repository<T> {
  constructor(private store: StoreName) {}

  async getAll(): Promise<T[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(this.store, 'readonly').objectStore(this.store).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  }

  async put(item: T): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(this.store, 'readwrite');
    tx.objectStore(this.store).put(item);
    return done(tx);
  }

  async remove(id: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(this.store, 'readwrite');
    tx.objectStore(this.store).delete(id);
    return done(tx);
  }

  async replaceAll(items: T[]): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(this.store, 'readwrite');
    const s = tx.objectStore(this.store);
    s.clear();
    for (const item of items) s.put(item);
    return done(tx);
  }
}

export class IndexedDbRepository extends IndexedDbStore<PortfolioItem> implements PortfolioRepository {
  constructor() {
    super('items');
  }
}

export class WishlistRepository extends IndexedDbStore<WishlistItem> {
  constructor() {
    super('wishlist');
  }
}
