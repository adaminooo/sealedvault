import { expandQuery, numStr, parseNum, setFromName } from './form';

describe('form', () => {
  it('čte česká i anglická čísla', () => {
    expect(parseNum('1 299,50')).toBe(1299.5);
    expect(parseNum('1299.5')).toBe(1299.5);
    expect(parseNum('')).toBeNaN();
    expect(parseNum('abc')).toBeNaN();
  });

  it('zapíše číslo do pole', () => {
    expect(numStr(1299.5)).toBe('1299,5');
    expect(numStr(0)).toBe('');
  });

  it('rozbalí zkratky', () => {
    expect(expandQuery('charizard upc')).toBe('charizard ultra premium collection');
  });

  it('najde edici v názvu (nejdelší shoda)', () => {
    const cat = [
      { id: '1', name: 'Evolutions', game: 'Pokémon' as const },
      { id: '2', name: 'Prismatic Evolutions', game: 'Pokémon' as const },
    ];
    expect(setFromName('Prismatic Evolutions Elite Trainer Box', cat)?.name).toBe('Prismatic Evolutions');
  });
});
