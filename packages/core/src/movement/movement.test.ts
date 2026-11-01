import { describe, expect, it } from 'vitest';
import { WOOD_SPECIES, WoodSpecies } from '../design-values/woodSpecies.ts';
import { type MovementInput, MovementResult, woodMovement } from './movement.ts';

// Hand-checked examples from #276 and DOMAIN.md, Wood movement: a 16" panel between 6% and 10%.

function input(over: Partial<MovementInput> = {}): MovementInput {
  return {
    subject: 'Panel',
    width: 16,
    species: { value: 'black-cherry' },
    orientation: { value: 'flatsawn' },
    moisture: { value: { low: 6, high: 10 } },
    ...over,
  };
}

function change(over: Partial<MovementInput>): number {
  const result = woodMovement(input(over));
  if (result.status !== 'computed') throw new Error(result.status);
  return result.change.value;
}

describe('species data', () => {
  it('parses, with unique ids', () => {
    for (const s of WOOD_SPECIES) expect(() => WoodSpecies.parse(s)).not.toThrow();
    const ids = WOOD_SPECIES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('matches Table 13-5 for the rows the examples use', () => {
    const row = (id: string) => WOOD_SPECIES.find((s) => s.id === id)?.dimensionalChange;
    expect(row('black-cherry')).toMatchObject({ radial: 0.00126, tangential: 0.00248 });
    expect(row('black-walnut')).toMatchObject({ radial: 0.0019, tangential: 0.00274 });
    expect(row('white-oak')).toMatchObject({ radial: 0.00194, tangential: 0.00376 });
  });
});

describe('woodMovement', () => {
  it('matches the hand-checked 16" panels', () => {
    expect(change({})).toBeCloseTo(0.15872, 10);
    expect(change({ species: { value: 'black-walnut' } })).toBeCloseTo(0.17536, 10);
    expect(change({ species: { value: 'white-oak' } })).toBeCloseTo(0.24064, 10);
    expect(
      change({ species: { value: 'white-oak' }, orientation: { value: 'quartersawn' } }),
    ).toBeCloseTo(0.12416, 10);
  });

  it('uses the tangential coefficient when ring orientation is unknown', () => {
    expect(change({ orientation: { value: 'unknown' } })).toBe(change({}));
  });

  it('shows its working, and parses as a stored result', () => {
    const result = woodMovement(input());
    expect(() => MovementResult.parse(result)).not.toThrow();
    if (result.status !== 'computed') throw new Error(result.status);
    expect(result.formulas).toEqual(['ΔD = D · C_T · (M_F − M_I)']);
    expect(result.inputs.map((q) => [q.symbol, q.value])).toEqual([
      ['D', 16],
      ['C_T', 0.00248],
      ['M_I', 6],
      ['M_F', 10],
    ]);
    expect(result.sources.map((s) => s.locator)).toContain('Chapter 13, Eq. 13-3, p. 13-16');
  });

  it('lists every missing input, never a stand-in value', () => {
    const result = woodMovement(
      input({
        orientation: { missing: [{ key: 'grain', label: 'Ring orientation' }] },
        moisture: { missing: [{ key: 'moisture', label: 'Moisture content range' }] },
      }),
    );
    expect(result).toEqual({
      subject: 'Panel',
      status: 'input-needed',
      missing: [
        { key: 'grain', label: 'Ring orientation' },
        { key: 'moisture', label: 'Moisture content range' },
      ],
    });
  });

  it('refuses moisture content outside 6% to 14%, or a range the wrong way round', () => {
    for (const range of [
      { low: 5, high: 10 },
      { low: 6, high: 15 },
      { low: 10, high: 6 },
      { low: 8, high: 8 },
    ]) {
      expect(
        woodMovement(input({ moisture: { value: range } })).status,
        JSON.stringify(range),
      ).toBe('not-computed');
    }
    expect(woodMovement(input({ moisture: { value: { low: 6, high: 14 } } })).status).toBe(
      'computed',
    );
  });

  it('throws on an unknown species or a width that is not positive', () => {
    expect(() => woodMovement(input({ species: { value: 'balsa' } }))).toThrow();
    expect(() => woodMovement(input({ width: 0 }))).toThrow();
  });
});
