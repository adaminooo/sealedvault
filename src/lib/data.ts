import { PUBLIC_URL } from '../config';

/**
 * Data appky jsou statické soubory (generuje je jednou denně GitHub Actions – scripts/build-data.mjs).
 * Nasazená appka je čte ze své adresy; PC verze na localhostu, která je u sebe nemá, je bere z veřejné adresy.
 */
const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const LOCAL_BASE = `${import.meta.env.BASE_URL}data/`;
const REMOTE_BASE = `${PUBLIC_URL}data/`;

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
  const p = get(LOCAL_BASE + path)
    .catch((e) => (isLocal ? get(REMOTE_BASE + path) : Promise.reject(e)))
    .catch((e) => {
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
