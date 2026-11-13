import { useEffect, useRef } from 'react';

import { setEurRate } from '@/core/format';
import { autoPriceFor, bestMatch, productImageFor } from '@/core/market';
import { items as itemsStore, useCollection, wishlist as wishStore } from '@/db/store';

import { useMarket } from './queries';

/**
 * Po načtení cen (stejně jako web):
 *  - položky bez spárovaného produktu se jistou shodou se spárují samy,
 *  - spárované s automatickou cenou převezmou dnešní cenu,
 *  - spárované bez fotky si dohledají obrázek produktu.
 *
 * Cena se přepisuje jen jednou za ceník (priceUpdatedAt ≠ datum ceníku) – když už ji pro dnešní
 * ceník nastavilo jiné zařízení (třeba web s jiným způsobem ocenění), telefon ji nepřepíše
 * a zařízení si ceny nepřehazují tam a zpět.
 */
export function useAutoPrices() {
  const list = useCollection(itemsStore);
  const wishes = useCollection(wishStore);
  const { data: market } = useMarket();

  useEffect(() => setEurRate(market?.eurCzk), [market]);

  useEffect(() => {
    if (!market) return;
    const now = new Date().toISOString();
    for (const orig of list) {
      let it = orig;
      let changed = false;
      // napárováno na produkt, který v ceníku není (např. neanglická verze) → spárovat znovu
      if (it.cmProductId && !market.byId.has(it.cmProductId)) {
        it = { ...it, cmProductId: undefined, cmName: undefined, productImage: undefined, priceAuto: it.priceAuto === false ? false : undefined };
        changed = true;
      }
      if (!it.cmProductId && it.priceAuto === undefined) {
        const p = bestMatch(market.products, { game: it.game, set: it.set, type: it.type, name: it.name });
        if (p) {
          it = { ...it, cmProductId: p.id, cmName: p.name, priceAuto: true };
          changed = true;
        }
      }
      if (it.priceUpdatedAt !== market.priceDate) {
        const price = autoPriceFor(it, market);
        if (price != null) {
          it = { ...it, currentPrice: price, priceUpdatedAt: market.priceDate };
          changed = true;
        }
      }
      if (changed) void itemsStore.put({ ...it, updatedAt: now });
    }
  }, [market, list]);

  // obrázky produktů (jednou za spuštění pro každou položku)
  const tried = useRef(new Set<string>());
  useEffect(() => {
    if (!market) return;
    const todo = list.filter((it) => it.cmProductId && !it.productImage && !tried.current.has(`${it.id}:${it.cmProductId}`));
    if (!todo.length) return;
    (async () => {
      for (const it of todo) {
        tried.current.add(`${it.id}:${it.cmProductId}`);
        const p = market.byId.get(it.cmProductId!);
        if (!p) continue;
        const url = await productImageFor(p).catch(() => null);
        if (url) {
          const fresh = await itemsStore.get(it.id);
          if (fresh && !fresh.productImage) await itemsStore.put({ ...fresh, productImage: url, updatedAt: new Date().toISOString() });
        }
      }
    })();
  }, [market, list]);

  // obrázky i u produktů z wishlistu
  const triedWish = useRef(new Set<string>());
  useEffect(() => {
    if (!market) return;
    const todo = wishes.filter((w) => w.cmProductId && !w.productImage && !triedWish.current.has(`${w.id}:${w.cmProductId}`));
    if (!todo.length) return;
    (async () => {
      for (const w of todo) {
        triedWish.current.add(`${w.id}:${w.cmProductId}`);
        const p = market.byId.get(w.cmProductId!);
        if (!p) continue;
        const url = await productImageFor(p).catch(() => null);
        if (url) {
          const fresh = await wishStore.get(w.id);
          if (fresh && !fresh.productImage) await wishStore.put({ ...fresh, productImage: url });
        }
      }
    })();
  }, [market, wishes]);
}
