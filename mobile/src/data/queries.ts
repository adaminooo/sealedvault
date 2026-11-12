import { focusManager, onlineManager, QueryClient, useQuery } from '@tanstack/react-query';
import { AppState } from 'react-native';

import { fetchHistory } from '@/core/history';
import { cachedMarket, fetchMarket, isStale } from '@/core/market';

/**
 * Sdílený klient dat. Ceny se mění jednou denně – obnovují se při návratu do appky,
 * když jsou starší než 6 h (stejné pravidlo jako web), nebo ručně tahem dolů.
 */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 6 * 60 * 60e3, gcTime: 24 * 60 * 60e3 } },
});

// návrat appky do popředí = „focus“ (obnoví zastaralá data)
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener('change', (s) => setFocused(s === 'active'));
  return () => sub.remove();
});
onlineManager.setOnline(true);

/** Denní ceny z Cardmarketu / TCGplayeru: hned z mezipaměti, na pozadí čerstvé */
export function useMarket() {
  return useQuery({
    queryKey: ['market'],
    queryFn: fetchMarket,
    initialData: () => cachedMarket() ?? undefined,
    initialDataUpdatedAt: () => {
      const m = cachedMarket();
      return m && !isStale(m) ? new Date(m.fetchedAt).getTime() : 0;
    },
  });
}

/** Historie cen vybraných produktů od data `from` (koše se stahují jen potřebné) */
export function useHistory(ids: number[], from: string) {
  const key = [...new Set(ids)].sort((a, b) => a - b);
  return useQuery({
    queryKey: ['history', from, key],
    queryFn: () => fetchHistory(key, from),
    enabled: key.length > 0,
  });
}
