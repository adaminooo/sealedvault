export type StoreName = 'items' | 'wishlist';

/** Nízkoúrovňové úložiště JSON záznamů (SQLite v telefonu, localStorage ve webovém náhledu) */
export interface Driver {
  all(store: StoreName): Promise<string[]>;
  put(store: StoreName, id: string, json: string): Promise<void>;
  remove(store: StoreName, id: string): Promise<void>;
  replace(store: StoreName, rows: [string, string][]): Promise<void>;
}
