import { useEffect, useState } from 'react';

/** Drobné UI preference (měna, filtry) v localStorage – samotná data jsou v IndexedDB */
export function usePersistentState<T>(key: string, initial: T) {
  const storageKey = `tcg-portfolio:${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return initial;
      const parsed = JSON.parse(raw);
      // u objektů doplň nové klíče z výchozí hodnoty
      return typeof initial === 'object' && initial !== null ? { ...initial, ...parsed } : parsed;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* úložiště nedostupné – ignoruj */
    }
  }, [storageKey, value]);

  return [value, setValue] as const;
}
