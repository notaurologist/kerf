import { describe, expect, it } from 'vitest';
import { partLetter, withLetters } from './letters.ts';

describe('part letters', () => {
  it('runs A to Z in cut-list order, then AA, AB, as spreadsheet columns do', () => {
    expect([0, 1, 2, 3, 4].map(partLetter)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(partLetter(25)).toBe('Z');
    expect(partLetter(26)).toBe('AA');
    expect(partLetter(27)).toBe('AB');
    expect(partLetter(51)).toBe('AZ');
    expect(partLetter(52)).toBe('BA');
    expect(partLetter(701)).toBe('ZZ');
    expect(partLetter(702)).toBe('AAA');
  });

  it('refuses an index that is not a position', () => {
    expect(() => partLetter(-1)).toThrow();
    expect(() => partLetter(1.5)).toThrow();
  });

  it('letters parts in their order, unique within the list', () => {
    const parts = withLetters(Array.from({ length: 30 }, (_, i) => ({ id: `p${i}` })));
    expect(parts[0]).toEqual({ id: 'p0', letter: 'A' });
    expect(new Set(parts.map((p) => p.letter)).size).toBe(30);
  });
});
