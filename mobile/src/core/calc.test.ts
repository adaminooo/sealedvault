import { heldQty, itemStats, totalStats, unitCost } from './calc';
import { lot } from './test-utils';

describe('calc', () => {
  it('rozpočítá poplatky do ceny za kus', () => {
    expect(unitCost(lot({ quantity: 4, buyPrice: 100, fees: 40 }))).toBe(110);
  });

  it('počítá nerealizovaný i realizovaný zisk', () => {
    const it = lot({ quantity: 3, buyPrice: 100, currentPrice: 150, sales: [{ id: 's', date: '2025-02-01', quantity: 1, price: 200, fees: 10 }] });
    expect(heldQty(it)).toBe(2);
    const s = itemStats(it);
    expect(s.cost).toBe(200);
    expect(s.value).toBe(300);
    expect(s.profit).toBe(100);
    expect(s.profitPct).toBe(50);
    expect(s.realized).toBe(90);
  });

  it('sečte více dávek', () => {
    const t = totalStats([lot({ id: 'a' }), lot({ id: 'b', quantity: 1, buyPrice: 500, currentPrice: 400 })]);
    expect(t.held).toBe(3);
    expect(t.cost).toBe(2500);
    expect(t.value).toBe(3400);
    expect(t.count).toBe(3);
  });

  it('nulová investice nemá procento', () => {
    expect(itemStats(lot({ buyPrice: 0 })).profitPct).toBeNull();
  });
});
