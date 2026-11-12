import { PUBLIC_URL } from '../config';

/**
 * Denní data jsou statické soubory na webu (generuje je GitHub Actions – scripts/build-data.mjs).
 * Mobilní appka je čte vždy z veřejné adresy.
 */
const BASE = `${PUBLIC_URL}data/`;

const memo = new Map<string, { at: number; p: Promise<unknown> }>();
const TTL = 30 * 60e3;

async function get(url: string) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** Načte datový soubor (data/<path>); výsledek drží 30 min v paměti */
export function getData<T>(path: string): Promise<T> {
  const c = memo.get(path);
  if (c && Date.now() - c.at < TTL) return c.p as Promise<T>;
  const p = get(BASE + path).catch((e) => {
    memo.delete(path);
    throw e;
  });
  memo.set(path, { at: Date.now(), p });
  return p as Promise<T>;
}

/** Zapomene načtená data (ruční „Obnovit ceny“) */
export function clearData() {
  memo.clear();
}
