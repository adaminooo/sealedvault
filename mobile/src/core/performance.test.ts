import { portfolioChange, xirr } from './performance';

describe('performance', () => {
  it('XIRR: +10 % za rok', () => {
    const r = xirr([
      { date: '2024-01-01', amount: -1000 },
      { date: '2024-12-31', amount: 1100 },
    ]);
    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(0.1, 2);
  });

  it('XIRR: kratší období než 30 dní nevrací číslo', () => {
    expect(xirr([{ date: '2025-01-01', amount: -1 }, { date: '2025-01-10', amount: 2 }])).toBeNull();
  });

  it('změna portfolia je očištěná o nákupy', () => {
    const pts = [
      { date: '2025-01-01', invested: 1000, value: 1000, eur: 25 },
      { date: '2025-01-08', invested: 2000, value: 2300, eur: 25 },
    ];
    expect(portfolioChange(pts, 7)).toEqual({ abs: 300, pct: 30 });
  });
});
