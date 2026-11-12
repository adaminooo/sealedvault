import { useCallback, useSyncExternalStore } from 'react';

import { onRemoteSetting, recordChange, SYNCED_SETTINGS } from '@/sync/cloud';

/**
 * Drobná nastavení (měna, filtry, vybrané portfolio) – stejné klíče `tcg-portfolio:*` jako web.
 * Klíče ze SYNCED_SETTINGS (seznam portfolií) se synchronizují s účtem.
 * Hodnota je sdílená mezi obrazovkami (změna na jedné se hned projeví na ostatních).
 */
const listeners = new Map<string, Set<() => void>>();
const cache = new Map<string, unknown>();

const storageKey = (k: string) => `tcg-portfolio:${k}`;

function read<T>(key: string, initial: T): T {
  if (cache.has(key)) return cache.get(key) as T;
  let v = initial;
  try {
    const raw = globalThis.localStorage?.getItem(storageKey(key));
    if (raw != null) {
      const parsed = JSON.parse(raw);
      // u objektů doplň nové klíče z výchozí hodnoty
      v = typeof initial === 'object' && initial !== null && !Array.isArray(initial) ? { ...initial, ...parsed } : parsed;
    }
  } catch {
    /* výchozí hodnota */
  }
  cache.set(key, v);
  return v;
}

function emit(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

// změna ze serveru (jiné zařízení) → načíst znovu
onRemoteSetting((id) => {
  cache.delete(id);
  emit(id);
});

export function useStoredState<T>(key: string, initial: T) {
  const subscribe = useCallback(
    (l: () => void) => {
      const set = listeners.get(key) ?? listeners.set(key, new Set()).get(key)!;
      set.add(l);
      return () => {
        set.delete(l);
      };
    },
    [key],
  );
  const value = useSyncExternalStore(subscribe, () => read(key, initial));

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = read(key, initial);
      const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      cache.set(key, v);
      try {
        globalThis.localStorage?.setItem(storageKey(key), JSON.stringify(v));
      } catch {
        /* nevadí */
      }
      if ((SYNCED_SETTINGS as readonly string[]).includes(key)) recordChange('settings', key);
      emit(key);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return [value, setValue] as const;
}
