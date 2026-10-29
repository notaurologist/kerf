import { describe, expect, it } from 'vitest';
import {
  edgeDistance,
  endDistance,
  formatDiameters,
  fullValueEndDistance,
  shortfalls,
  spacingBetweenRows,
  spacingInRow,
  spreadAcrossGrain,
} from './boltDistances.ts';

// NDS 2024 Tables 12.5.1A to 12.5.1D (pp. 98-99) for a 1/2" bolt, worked by hand: D = 0.5.
const D = 0.5;
const rows = (d: ReturnType<typeof endDistance>) =>
  d.requirements.map((r) => [r.multiple, r.value, r.gives.split(' (')[0]]);

describe('bolt distances against NDS 2024', () => {
  it('end distance, load parallel to grain: both directions, softwood and hardwood', () => {
    expect(rows(endDistance('Crossbar', 3.5, D, 'parallel', 'softwood'))).toEqual([
      ['2D', 1, 'reduced design value'],
      ['4D', 2, 'full design value'],
      ['3.5D', 1.75, 'reduced design value'],
      ['7D', 3.5, 'full design value'],
    ]);
    const hardwood = endDistance('Crossbar', 3.5, D, 'parallel', 'hardwood').requirements;
    expect(hardwood.slice(2).map((r) => [r.multiple, r.value])).toEqual([
      ['2.5D', 1.25],
      ['5D', 2.5],
    ]);
    expect(fullValueEndDistance(D, 'softwood')).toBe(3.5);
    expect(fullValueEndDistance(D, 'hardwood')).toBe(2.5);
  });

  it('end distance, load perpendicular to grain: 2D and 4D', () => {
    expect(rows(endDistance('Beam', 13.75, D, 'perpendicular', 'softwood'))).toEqual([
      ['2D', 1, 'reduced design value'],
      ['4D', 2, 'full design value'],
    ]);
  });

  it('edge distance: 1.5D along the grain for ℓ/D ≤ 6, else the greater of 1.5D and half the row spacing', () => {
    expect(rows(edgeDistance('Crossbar', 1.375, D, 'parallel', 3))).toEqual([
      ['1.5D', 0.75, 'minimum'],
    ]);
    // ℓ/D = 7, rows 2.75 apart: 1.5D = 0.75 or 2.75 / 2 = 1.375, whichever is greater.
    expect(edgeDistance('Crossbar', 1.375, D, 'parallel', 7, 2.75).requirements[0]?.value).toBe(
      1.375,
    );
    expect(rows(edgeDistance('Leg', 1.75, D, 'perpendicular', 3))).toEqual([
      ['4D', 2, 'minimum'],
      ['1.5D', 0.75, 'minimum'],
    ]);
  });

  it('spacing in a row and between rows', () => {
    expect(rows(spacingInRow('Leg', 2.9, D, 'parallel'))).toEqual([
      ['3D', 1.5, 'minimum'],
      ['4D', 2, 'full design value'],
    ]);
    expect(rows(spacingInRow('Leg', 2.9, D, 'perpendicular'))).toEqual([['3D', 1.5, 'minimum']]);
    expect(rows(spacingBetweenRows('Crossbar', 2.75, D, 'parallel', 3))).toEqual([
      ['1.5D', 0.75, 'minimum'],
    ]);
    // Perpendicular: ℓ/D ≤ 2 gives 2.5D = 1.25; ℓ/D = 3 (ℓ = 1.5) gives (5·1.5 + 10·0.5) / 8 =
    // 1.5625; ℓ/D ≥ 6 gives 5D = 2.5.
    const between = (lOverD: number) =>
      spacingBetweenRows('Crossbar', 2.75, D, 'perpendicular', lOverD).requirements[0]?.value;
    expect(between(2)).toBe(1.25);
    expect(between(3)).toBe(1.5625);
    expect(between(6)).toBe(2.5);
  });

  it('caps the outermost bolts across the grain at 5"', () => {
    expect(spreadAcrossGrain('Gusset', 5.5).requirements[0]).toMatchObject({
      value: 5,
      gives: 'maximum',
    });
  });

  it('lists only the rows a distance falls short of, worst first, with no margin for rounding', () => {
    const leg = edgeDistance('Leg', 1.75, D, 'perpendicular', 3);
    expect(shortfalls(leg).map((r) => r.multiple)).toEqual(['4D']);
    const end = endDistance('Crossbar', 1.8625, D, 'parallel', 'softwood');
    expect(shortfalls(end).map((r) => r.multiple)).toEqual(['7D', '4D']);
    // Laid out to exactly 7D, with the last bit of floating-point rounding: no shortfall.
    expect(shortfalls(endDistance('Crossbar', 3.5 - 1e-12, D, 'parallel', 'softwood'))).toEqual([]);
    expect(shortfalls(spreadAcrossGrain('Gusset', 5.5)).map((r) => r.multiple)).toEqual(['5"']);
    expect(shortfalls(spreadAcrossGrain('Gusset', 3.625))).toEqual([]);
  });

  it('writes a distance in bolt diameters to one decimal place', () => {
    expect(formatDiameters(1.8625, D)).toBe('3.7D');
    expect(formatDiameters(3.5, D)).toBe('7.0D');
  });

  it('cites the table and page for every row', () => {
    const all = [
      endDistance('A', 1, D, 'parallel', 'softwood'),
      edgeDistance('A', 1, D, 'perpendicular', 3),
      spacingInRow('A', 1, D, 'parallel'),
      spacingBetweenRows('A', 1, D, 'perpendicular', 3),
      spreadAcrossGrain('A', 1),
    ].flatMap((d) => d.requirements);
    for (const r of all) {
      expect(r.citation.source).toBe('nds-2024');
      expect(r.citation.locator).toMatch(/p\. 9[89]$/);
    }
  });
});
