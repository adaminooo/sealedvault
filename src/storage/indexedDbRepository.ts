import type { PortfolioItem, WishlistItem } from '../types';
import type { PortfolioRepository, Repository } from './repository';
import { recordChange, setLocalAdapter } from '../lib/cloud';

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

const KIND = { items: 'item', wishlist: 'wish' } as const;
/** čas změny záznamu (pro rozhodnutí, která verze je novější) */
const stamp = (v: unknown) => (v as { updatedAt?: string; createdAt?: string })?.updatedAt ?? new Date().toISOString();

/** Obecné úložiště záznamů s `id` v jedné IndexedDB tabulce (každou změnu hlásí synchronizaci) */
export class IndexedDbStore<T extends { id: string }> implements Repository<T> {
  constructor(private store: StoreName) {}

  async get(id: string): Promise<T | undefined> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(this.store, 'readonly').objectStore(this.store).get(id);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(): Promise<T[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(this.store, 'readonly').objectStore(this.store).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  }

  /** zápis bez nahlášení synchronizaci (data přišla ze serveru) */
  async putRaw(item: T): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(this.store, 'readwrite');
    tx.objectStore(this.store).put(item);
    return done(tx);
  }

  async removeRaw(id: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(this.store, 'readwrite');
    tx.objectStore(this.store).delete(id);
    return done(tx);
  }

  async put(item: T): Promise<void> {
    await this.putRaw(item);
    recordChange(KIND[this.store], item.id, false, stamp(item));
  }

  async remove(id: string): Promise<void> {
    await this.removeRaw(id);
    recordChange(KIND[this.store], id, true);
  }

  async replaceAll(items: T[]): Promise<void> {
    // nahlásit jen skutečné změny (nové, upravené, smazané)
    const before = new Map((await this.getAll()).map((x) => [x.id, JSON.stringify(x)]));
    const after = new Set(items.map((x) => x.id));
    for (const it of items) if (before.get(it.id) !== JSON.stringify(it)) recordChange(KIND[this.store], it.id, false, stamp(it));
    for (const id of before.keys()) if (!after.has(id)) recordChange(KIND[this.store], id, true);
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

// napojení synchronizace na lokální data
const stores = { item: new IndexedDbStore<{ id: string }>('items'), wish: new IndexedDbStore<{ id: string }>('wishlist') };
setLocalAdapter({
  get: (kind, id) => stores[kind].get(id),
  getAll: (kind) => stores[kind].getAll() as Promise<{ id: string; updatedAt?: string; createdAt?: string }[]>,
  putRaw: (kind, value) => stores[kind].putRaw(value as { id: string }),
  removeRaw: (kind, id) => stores[kind].removeRaw(id),
});
