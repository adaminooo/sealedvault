import * as SQLite from 'expo-sqlite';

import type { Driver, StoreName } from './types';

/**
 * Lokální databáze v telefonu (SQLite). Jedna tabulka pro portfolio i wishlist:
 * záznam = JSON stejného tvaru jako na webu, takže synchronizace přenáší data beze změn.
 */
let db: SQLite.SQLiteDatabase | null = null;
function open() {
  if (db) return db;
  db = SQLite.openDatabaseSync('sealedvault.db');
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS records (
      store TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (store, id)
    );
  `);
  return db;
}

export const driver: Driver = {
  async all(store: StoreName) {
    const rows = await open().getAllAsync<{ data: string }>('SELECT data FROM records WHERE store = ?', store);
    return rows.map((r) => r.data);
  },
  async put(store, id, json) {
    await open().runAsync('INSERT OR REPLACE INTO records (store, id, data) VALUES (?, ?, ?)', store, id, json);
  },
  async remove(store, id) {
    await open().runAsync('DELETE FROM records WHERE store = ? AND id = ?', store, id);
  },
  async replace(store, rows) {
    const d = open();
    await d.withTransactionAsync(async () => {
      await d.runAsync('DELETE FROM records WHERE store = ?', store);
      for (const [id, json] of rows) await d.runAsync('INSERT INTO records (store, id, data) VALUES (?, ?, ?)', store, id, json);
    });
  },
};
