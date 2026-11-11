import type { HistoryData } from './portfolio';
import { getData } from './data';

/** Nejstarší den v archivu cen (TCGCSV archiv TCGplayeru začíná 8. 2. 2024) */
export const HISTORY_START = '2024-02-08';

interface Bucket {
  /** id produktu → [[datum, cena v měně zdroje]] */
  s: Record<string, [string, number][]>;
  /** id produktu → poslední den doplněný z archivu TCGplayeru */
  e: Record<string, string>;
}
interface Meta {
  ownSince: string | null;
  buckets: number;
}

/**
 * Historie cen produktů + kurzy ČNB od data `from`.
 * Data jsou ve statických souborech rozdělená do košů (id % počet košů) – stáhnou se jen potřebné.
 */
export async function fetchHistory(ids: number[], from: string): Promise<HistoryData> {
  const uniq = [...new Set(ids)];
  const [meta, rates] = await Promise.all([getData<Meta>('h/meta.json'), getData<HistoryData['rates']>('rates.json')]);
  const n = meta.buckets || 64;
  const buckets = new Map(
    await Promise.all([...new Set(uniq.map((id) => id % n))].map(async (b) => [b, await getData<Bucket>(`h/${b}.json`)] as const)),
  );
  const series: HistoryData['series'] = {};
  const estimated: Record<string, string> = {};
  let recordedSince: string | null = null;
  for (const id of uniq) {
    const b = buckets.get(id % n);
    const pts = (b?.s[id] ?? []).filter(([d]) => d >= from);
    series[id] = pts;
    if (pts[0] && (!recordedSince || pts[0][0] < recordedSince)) recordedSince = pts[0][0];
    if (b?.e[id] && b.e[id] >= from) estimated[id] = b.e[id];
  }
  // kurzy i pár dní před začátkem (víkend / svátek na prvním dni přebírá předchozí kurz)
  const rateFrom = new Date(Date.parse(from + 'T12:00:00Z') - 10 * 864e5).toISOString().slice(0, 10);
  const shownRates = Object.fromEntries(Object.entries(rates).filter(([d]) => d >= rateFrom));
  return { recordedSince, ownSince: meta.ownSince, series, rates: shownRates, estimated };
}
