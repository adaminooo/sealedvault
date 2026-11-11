import { useEffect, useRef, useState } from 'react';
import { recordChange, SYNCED_SETTINGS } from '../lib/cloud';

/** Drobné UI preference (měna, filtry) v localStorage – samotná data jsou v IndexedDB.
 *  Klíče ze SYNCED_SETTINGS (např. seznam portfolií) se synchronizují s účtem. */
export function usePersistentState<T>(key: string, initial: T) {
  const storageKey = `tcg-portfolio:${key}`;
  const synced = (SYNCED_SETTINGS as readonly string[]).includes(key);
  const read = (): T => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return initial;
      const parsed = JSON.parse(raw);
      // u objektů doplň nové klíče z výchozí hodnoty
      return typeof initial === 'object' && initial !== null && !Array.isArray(initial) ? { ...initial, ...parsed } : parsed;
    } catch {
      return initial;
    }
  };
  const [value, setValue] = useState<T>(read);
  const fromRemote = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* úložiště nedostupné – ignoruj */
    }
    if (synced && !first.current && !fromRemote.current) recordChange('settings', key);
    first.current = false;
    fromRemote.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, value]);

  // změna ze serveru (jiné zařízení)
  useEffect(() => {
    if (!synced) return;
    const onRemote = (e: Event) => {
      if ((e as CustomEvent).detail !== key) return;
      fromRemote.current = true;
      setValue(read());
    };
    window.addEventListener('sv:settings-changed', onRemote);
    return () => window.removeEventListener('sv:settings-changed', onRemote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synced, key]);

  return [value, setValue] as const;
}
