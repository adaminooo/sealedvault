import { useCallback, useEffect, useState } from 'react';
import type { WishlistItem } from '../types';
import { WishlistRepository } from '../storage/indexedDbRepository';
import { newId } from '../lib/format';

const repo = new WishlistRepository();

export function useWishlist() {
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);

  useEffect(() => {
    const load = () => void repo.getAll().then(setWishlist).catch(() => {});
    load();
    window.addEventListener('sv:data-changed', load);
    return () => window.removeEventListener('sv:data-changed', load);
  }, []);

  const addWish = useCallback(async (w: Omit<WishlistItem, 'id' | 'createdAt'>) => {
    const item: WishlistItem = { ...w, id: newId(), createdAt: new Date().toISOString() };
    await repo.put(item);
    setWishlist((prev) => [...prev, item]);
    return item;
  }, []);

  const updateWish = useCallback(async (w: WishlistItem) => {
    await repo.put(w);
    setWishlist((prev) => prev.map((x) => (x.id === w.id ? w : x)));
  }, []);

  const removeWish = useCallback(async (id: string) => {
    await repo.remove(id);
    setWishlist((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const replaceWishlist = useCallback(async (list: WishlistItem[]) => {
    await repo.replaceAll(list);
    setWishlist(list);
  }, []);

  return { wishlist, addWish, updateWish, removeWish, replaceWishlist };
}
