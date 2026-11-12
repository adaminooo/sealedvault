import { changeAbs, priceChanges } from './changes';

describe('changes', () => {
  it('denní a týdenní změna ceny', () => {
    const m = priceChanges({
      recordedSince: '2025-01-01',
      rates: {},
      series: { '1': [['2025-01-01', 100], ['2025-01-07', 110], ['2025-01-08', 121]] },
    });
    expect(m.get(1)!.d1).toBeCloseTo(10);
    expect(m.get(1)!.d7).toBeCloseTo(21);
  });

  it('změna v Kč z procent', () => {
    expect(changeAbs(110, 10)).toBeCloseTo(10);
    expect(changeAbs(110, null)).toBeNull();
  });
});
