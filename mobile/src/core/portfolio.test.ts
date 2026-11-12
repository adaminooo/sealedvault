import { allocateSale, groupPositions, portfolioSeries, positionKey } from './portfolio';
import { lot } from './test-utils';

jest.mock('expo-crypto', () => ({ randomUUID: () => Math.random().toString(36).slice(2) }));

describe('portfolio', () => {
  it('seskupí dávky stejného produktu do pozice', () => {
    const items = [lot({ id: 'a', cmProductId: 7 }), lot({ id: 'b', cmProductId: 7, buyDate: '2024-06-01' }), lot({ id: 'c', cmProductId: 8 })];
    const pos = groupPositions(items);
    expect(pos).toHaveLength(2);
    const p7 = pos.find((p) => p.key === 'p:7')!;
    expect(p7.lots.map((l) => l.id)).toEqual(['b', 'a']);
    expect(p7.stats.held).toBe(4);
  });

  it('klíč bez id trhu podle hry a názvu', () => {
    expect(positionKey(lot({ name: ' Booster Box ' }))).toBe('n:Pokémon|booster box');
  });

  it('prodej rozdělí FIFO mezi dávky a rozpočítá poplatky', () => {
    const lots = [lot({ id: 'new', buyDate: '2025-03-01', buyPrice: 200 }), lot({ id: 'old', buyDate: '2025-01-01', buyPrice: 100 })];
    const { updated, realized } = allocateSale(lots, { date: '2025-04-01', quantity: 3, price: 300, fees: 30 });
    expect(updated.map((l) => l.id)).toEqual(['old', 'new']);
    expect(updated[0].sales![0]).toMatchObject({ quantity: 2, fees: 20 });
    expect(updated[1].sales![0]).toMatchObject({ quantity: 1, fees: 10 });
    expect(realized).toBe(3 * 300 - 30 - (2 * 100 + 200));
  });

  it('řada portfolia: investováno od nákupu, hodnota od záznamu cen', () => {
    const items = [lot({ quantity: 1, buyPrice: 1000, currentPrice: 1200, buyDate: '2025-01-01', cmProductId: 5 })];
    const pts = portfolioSeries(
      items,
      { recordedSince: '2025-01-02', series: { '5': [['2025-01-02', 40]] }, rates: { '2025-01-01': [25, 22] } },
      '2025-01-03',
    );
    expect(pts.map((p) => p.date)).toEqual(['2025-01-01', '2025-01-02', '2025-01-03']);
    expect(pts[0].value).toBeNull();
    expect(pts[1].value).toBe(1000); // 40 € × 25 Kč
    expect(pts[2].value).toBe(1200); // dnešek = aktuální cena
    expect(pts.every((p) => p.invested === 1000)).toBe(true);
  });
});
