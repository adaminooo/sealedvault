import { Collection, setChangeListener } from './store';

const mockMem = new Map<string, string>();
jest.mock('./driver', () => ({
  driver: {
    all: async () => [...mockMem.values()],
    put: async (_s: string, id: string, j: string) => {
      mockMem.set(id, j);
    },
    remove: async (_s: string, id: string) => {
      mockMem.delete(id);
    },
    replace: async (_s: string, rows: [string, string][]) => {
      mockMem.clear();
      for (const [id, j] of rows) mockMem.set(id, j);
    },
  },
}));

describe('Collection', () => {
  it('ukládá, maže a hlásí změny synchronizaci', async () => {
    const log: string[] = [];
    setChangeListener((k, id, del) => log.push(`${k}:${id}:${del}`));
    const c = new Collection<{ id: string; v: number }>('items');
    await c.put({ id: 'a', v: 1 });
    await c.put({ id: 'b', v: 2 });
    await c.putRaw({ id: 'c', v: 3 });
    await c.remove('a');
    expect((await c.getAll()).map((x) => x.id)).toEqual(['b', 'c']);
    expect([...mockMem.keys()]).toEqual(['b', 'c']);
    expect(log).toEqual(['item:a:false', 'item:b:false', 'item:a:true']);

    log.length = 0;
    await c.replaceAll([{ id: 'b', v: 2 }, { id: 'd', v: 4 }]);
    expect(log).toEqual(['item:d:false', 'item:c:true']);
  });
});
