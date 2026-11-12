import type { Driver, StoreName } from './types';

/** Webový náhled appky (jen pro vývoj) – místo SQLite drží záznamy v localStorage */
const key = (s: StoreName) => `sv-mobile:${s}`;
const read = (s: StoreName): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(key(s)) ?? '{}');
  } catch {
    return {};
  }
};
const write = (s: StoreName, v: Record<string, string>) => localStorage.setItem(key(s), JSON.stringify(v));

export const driver: Driver = {
  async all(store) {
    return Object.values(read(store));
  },
  async put(store, id, json) {
    write(store, { ...read(store), [id]: json });
  },
  async remove(store, id) {
    const v = read(store);
    delete v[id];
    write(store, v);
  },
  async replace(store, rows) {
    write(store, Object.fromEntries(rows));
  },
};
