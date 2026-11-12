/**
 * Synchronizace proti falešnému serveru (chová se jako tabulka user_data v Supabase):
 * nahrání, stažení, mazání oběma směry, konflikt (novější vyhrává), nastavení, wishlist.
 */
import { items, wishlist } from '@/db/store';

import { __test, recordChange, syncNow } from './cloud';

const mockMem = { items: new Map<string, string>(), wishlist: new Map<string, string>() };
jest.mock('@/db/driver', () => ({
  driver: {
    all: async (s: 'items' | 'wishlist') => [...mockMem[s].values()],
    put: async (s: 'items' | 'wishlist', id: string, j: string) => {
      mockMem[s].set(id, j);
    },
    remove: async (s: 'items' | 'wishlist', id: string) => {
      mockMem[s].delete(id);
    },
    replace: async () => {},
  },
}));
jest.mock('./session-storage', () => ({ sessionStorage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } }));

// localStorage se čte až při synchronizaci, náhradu stačí nastavit tady
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};


type ServerRow = { user_id: string; kind: string; id: string; data: unknown; deleted: boolean; client_at: string; updated_at: string };

/** Falešný server: upsert podle (user, kind, id), updated_at roste s každým zápisem */
function fakeServer() {
  const rows: ServerRow[] = [];
  let clock = 0;
  const stamp = () => new Date(Date.UTC(2030, 0, 1) + ++clock * 1000).toISOString();
  return {
    rows,
    /** zápis „z jiného zařízení“ */
    write(r: Omit<ServerRow, 'updated_at' | 'user_id'>) {
      const i = rows.findIndex((x) => x.kind === r.kind && x.id === r.id);
      const row = { ...r, user_id: 'u1', updated_at: stamp() };
      if (i >= 0) rows[i] = row;
      else rows.push(row);
    },
    client: {
      from: () => {
        let since = '';
        let limit = 1000;
        const q = {
          select: () => q,
          gt: (_c: string, v: string) => ((since = v), q),
          order: () => q,
          limit: (n: number) => ((limit = n), q),
          then: (res: (v: { data: ServerRow[]; error: null }) => unknown) =>
            res({ data: rows.filter((r) => r.updated_at > since).sort((a, b) => a.updated_at.localeCompare(b.updated_at)).slice(0, limit), error: null }),
          upsert: async (list: ServerRow[]) => {
            for (const r of list) {
              const i = rows.findIndex((x) => x.kind === r.kind && x.id === r.id);
              const row = { ...r, updated_at: stamp() };
              if (i >= 0) rows[i] = row;
              else rows.push(row);
            }
            return { error: null };
          },
        };
        return q;
      },
    },
  };
}

const item = (id: string, updatedAt: string, extra: object = {}) =>
  ({ id, name: `P ${id}`, game: 'Pokémon', set: 'S', type: 'ETB', quantity: 1, buyPrice: 100, buyDate: '2025-01-01', fees: 0, currentPrice: 100, note: '', createdAt: updatedAt, updatedAt, ...extra }) as never;

describe('synchronizace', () => {
  const srv = fakeServer();
  beforeAll(() => {
    __test.setClient(srv.client);
  });
  afterAll(() => {
    __test.setUser(null);
    __test.stop();
  });

  it('po prvním přihlášení nahraje lokální data', async () => {
    await items.put(item('a', '2025-01-01T00:00:00Z'));
    await wishlist.put({ id: 'w1', name: 'W', game: 'Pokémon', set: 'S', type: 'ETB', createdAt: '2025-01-01T00:00:00Z' } as never);
    __test.setUser({ id: 'u1' });
    await syncNow();
    expect(srv.rows.map((r) => `${r.kind}:${r.id}`).sort()).toEqual(['item:a', 'wish:w1']);
    expect(JSON.parse(store.get('sv:outbox')!)).toEqual({});
  });

  it('stáhne změny z jiného zařízení (nový i smazaný záznam)', async () => {
    srv.write({ kind: 'item', id: 'b', data: item('b', '2030-02-01T00:00:00Z'), deleted: false, client_at: '2030-02-01T00:00:00Z' });
    srv.write({ kind: 'wish', id: 'w1', data: null, deleted: true, client_at: '2030-02-01T00:00:00Z' });
    await syncNow();
    expect((await items.getAll()).map((x) => x.id).sort()).toEqual(['a', 'b']);
    expect(await wishlist.getAll()).toEqual([]);
    expect(mockMem.items.has('b')).toBe(true);
  });

  it('smazání v telefonu se odešle na server', async () => {
    await items.remove('a');
    await syncNow();
    expect(srv.rows.find((r) => r.id === 'a')).toMatchObject({ deleted: true, data: null });
  });

  it('konflikt: novější změna vyhrává', async () => {
    // telefon změnil „b“ později než druhé zařízení → serverová verze se přeskočí, odešle se telefonní
    srv.write({ kind: 'item', id: 'b', data: item('b', '2030-03-01T00:00:00Z', { note: 'server' }), deleted: false, client_at: '2030-03-01T00:00:00Z' });
    recordChange('item', 'b', false, '2030-04-01T00:00:00Z');
    await items.putRaw(item('b', '2030-04-01T00:00:00Z', { note: 'telefon' }));
    await syncNow();
    expect((await items.get('b'))!.note).toBe('telefon');
    expect((srv.rows.find((r) => r.id === 'b')!.data as { note: string }).note).toBe('telefon');

    // starší lokální změna prohraje se novější serverovou
    recordChange('item', 'b', false, '2030-04-02T00:00:00Z');
    srv.write({ kind: 'item', id: 'b', data: item('b', '2030-05-01T00:00:00Z', { note: 'pc' }), deleted: false, client_at: '2030-05-01T00:00:00Z' });
    await syncNow();
    expect((await items.get('b'))!.note).toBe('pc');
  });

  it('sdílená nastavení (seznam portfolií) se přenesou', async () => {
    srv.write({ kind: 'settings', id: 'portfolios', data: { list: [{ id: 'main', name: 'Hlavní' }] }, deleted: false, client_at: '2030-06-01T00:00:00Z' });
    await syncNow();
    expect(JSON.parse(store.get('tcg-portfolio:portfolios')!)).toEqual({ list: [{ id: 'main', name: 'Hlavní' }] });
  });
});
