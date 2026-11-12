import { holdingsTrend, rateLookup, seriesInCzk } from './trend';
import { lot } from './test-utils';

const NOW = Date.parse('2025-03-31T12:00:00Z');

describe('trend', () => {
  it('kurz bere poslední známý den', () => {
    const r = rateLookup({ '2025-01-01': [25, 22], '2025-01-03': [24, 21] });
    expect(r('2025-01-02', 0)).toBe(25);
    expect(r('2025-01-05', 1)).toBe(21);
    expect(r('2024-12-31', 0)).toBeNull();
  });

  it('křivka držených kusů končí dnešní hodnotou', () => {
    const items = [lot({ quantity: 2, currentPrice: 1200, cmProductId: 9 })];
    const hist = { recordedSince: '2025-01-01', rates: { '2024-12-01': [25, 22] as [number, number] }, series: { '9': [['2024-12-01', 40], ['2025-03-01', 44]] as [string, number][] } };
    const tr = holdingsTrend(hist, items, 90, NOW)!;
    expect(tr.length).toBeGreaterThan(20);
    expect(tr[0]).toBe(2 * 40 * 25);
    expect(tr[tr.length - 1]).toBe(2400);
  });

  it('bez historie žádná křivka', () => {
    expect(holdingsTrend(null, [lot()])).toBeNull();
  });

  it('řada produktu v Kč (USD produkty kurzem USD)', () => {
    const hist = { recordedSince: null, rates: { '2025-01-01': [25, 20] as [number, number] }, series: { '1000000001': [['2025-01-02', 10]] as [string, number][] } };
    expect(seriesInCzk(hist, 1000000001)).toEqual([['2025-01-02', 200]]);
  });
});
