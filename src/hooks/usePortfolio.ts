import { useCallback, useEffect, useRef, useState } from 'react';
import type { PortfolioItem, PortfolioItemInput } from '../types';
import type { PortfolioRepository } from '../storage/repository';
import { newId } from '../lib/format';

export function usePortfolio(repo: PortfolioRepository) {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    repo
      .getAll()
      .then(setItems)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
    // změny z jiného zařízení (synchronizace) → načíst znovu
    const reload = () => void repo.getAll().then(setItems).catch(() => {});
    window.addEventListener('sv:data-changed', reload);
    return () => window.removeEventListener('sv:data-changed', reload);
  }, [repo]);

  const add = useCallback(
    async (input: PortfolioItemInput) => {
      const now = new Date().toISOString();
      const item: PortfolioItem = { ...input, id: newId(), createdAt: now, updatedAt: now };
      await repo.put(item);
      setItems((prev) => [...prev, item]);
    },
    [repo],
  );

  const update = useCallback(
    async (id: string, input: PortfolioItemInput) => {
      const existing = itemsRef.current.find((it) => it.id === id);
      if (!existing) return;
      const updated: PortfolioItem = { ...existing, ...input, updatedAt: new Date().toISOString() };
      await repo.put(updated);
      setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
    },
    [repo],
  );

  const remove = useCallback(
    async (id: string) => {
      await repo.remove(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
    },
    [repo],
  );

  const replaceAll = useCallback(
    async (next: PortfolioItem[]) => {
      await repo.replaceAll(next);
      setItems(next);
    },
    [repo],
  );

  return { items, loading, error, add, update, remove, replaceAll };
}
