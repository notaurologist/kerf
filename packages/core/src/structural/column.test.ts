import { describe, expect, it } from 'vitest';
import { STOCK_SIZE_SOURCES } from '../lumber/stock.ts';
import { VERDICT_WORDS } from '../testing.ts';
import type { LoadFactor } from './checks.ts';
import { type ColumnCheckInput, columnCheck, columnStabilityFactor } from './column.ts';
import type { ServiceConditions } from './factors.ts';
import type { CheckResult, ComputedCheck } from './types.ts';

// Hand-checked worked examples for the generic column check (NDS 2024 3.6.3 and 3.7.1), on a
// made-up 4x4 post of Southern Pine No.2 (Table 4B, 2"-4" wide: Fc = 1450, Emin = 510,000 psi).
// Two directions: ℓ = 60 with Ke = 1.0, and ℓ = 70 with Ke = 1.2, so ℓe/d is 60/3.5 = 17.14 and
// 84/3.5 = 24.0, and 24.0 governs (3.7.1.3).
//
// Dry service, C_D = 1.0: Fc* = 1450, Emin' = 510,000.
//   F_cE = 0.822 · 510,000 / 24² = 727.8125; F_cE/Fc* = 0.501940
//   C_P = 1.501940/1.6 − √(0.938712² − 0.501940/0.8) = 0.938712 − 0.503742 = 0.434970
//   Fc' = 1450 · 0.434970 = 630.71 psi
// Load: 1000 lb multiplied by the factor 1.5, plus 200 lb that is not: P = 1700, f_c = 1700/12.25
// = 138.78 psi, margin 630.71/138.78 = 4.54. Break-even: (630.71 · 12.25 − 200)/1000 = 7.526.

const DRY: ServiceConditions = {
  wet: { value: false, reason: 'Indoors.' },
  temperature: { value: 'up-to-100F', reason: 'Room temperature.' },
  loadDuration: { value: 'ten-years', reason: 'Occupancy.' },
  repetitive: { value: false, reason: 'One post.' },
  waterborneTreatment: false,
};

const factor = (value?: number): LoadFactor => ({
  key: 'factor',
  symbol: 'C',
  label: 'Load factor',
  basis: 'Entered',
  value: value === undefined ? { missing: [{ key: 'factor', label: 'Load factor' }] } : { value },
});

function post(overrides: Partial<ColumnCheckInput> = {}): ColumnCheckInput {
  return {
    member: {
      subject: 'Post, 4x4',
      nominal: '4x4',
      breadth: 3.5,
      depth: 3.5,
      sizeSources: STOCK_SIZE_SOURCES,
      axes: [
        { label: 'East to west', d: 3.5, length: 60, Ke: 1, basis: 'Pinned at both ends.' },
        { label: 'North to south', d: 3.5, length: 70, Ke: 1.2, basis: 'Fixed, free to sway.' },
      ],
    },
    material: { value: { speciesGrade: 'southern-pine-no2', incised: false } },
    conditions: DRY,
    loadCase: 'Strength',
    load: { value: { factored: 1000, unfactored: 200, working: [], assumptions: [] } },
    factor: factor(1.5),
    assumptions: [],
    ...overrides,
  };
}

function computed(r: CheckResult): ComputedCheck {
  if (r.status !== 'computed') throw new Error(`Expected a computed check: ${JSON.stringify(r)}`);
  return r;
}

const step = (r: ComputedCheck, symbol: string) => r.steps.find((s) => s.symbol === symbol)?.value;

describe('column stability factor (NDS 3.7.1.5)', () => {
  it('matches the hand check', () => {
    const { FcE, CP } = columnStabilityFactor(1450, 510_000, 24);
    expect(FcE).toBeCloseTo(727.8125, 4);
    expect(CP).toBeCloseTo(0.43497, 5);
  });

  it('approaches 1.0 for a short column and falls as it gets more slender', () => {
    expect(columnStabilityFactor(1450, 510_000, 1).CP).toBeGreaterThan(0.99);
    const ratios = [10, 20, 30, 40, 50];
    const cps = ratios.map((r) => columnStabilityFactor(1450, 510_000, r).CP);
    for (let i = 1; i < cps.length; i++) expect(cps[i]).toBeLessThan(cps[i - 1] as number);
  });
});

describe('column check', () => {
  it('matches the hand-checked post, with the larger ℓe/d governing', () => {
    const r = computed(columnCheck(post()));
    expect(r.kind).toBe('column');
    expect(r.title).toBe('Compression');
    expect(step(r, 'ℓe1/d1')).toBeCloseTo(60 / 3.5, 9);
    expect(step(r, 'ℓe2/d2')).toBeCloseTo(24, 9);
    expect(step(r, 'ℓe/d')).toBeCloseTo(24, 9);
    expect(step(r, 'Fc*')).toBe(1450);
    expect(step(r, "Emin'")).toBe(510_000);
    expect(step(r, 'C_P')).toBeCloseTo(0.43497, 5);
    expect(step(r, 'P')).toBeCloseTo(1700, 9);
    expect(step(r, 'A')).toBeCloseTo(12.25, 9);
    expect(r.computed.value).toBeCloseTo(138.7755, 3);
    expect(r.allowable.value).toBeCloseTo(630.707, 2);
    expect(r.margin).toBeCloseTo(4.5448, 3);
    expect(r.breakEven?.value).toBeCloseTo(7.5262, 3);
  });

  it('applies wet service and incising to Fc and Emin', () => {
    // Fc* = 1450 · 0.8 · 0.8 = 928; Emin' = 510,000 · 0.9 · 0.95 = 436,050.
    // F_cE = 0.822 · 436,050 / 576 = 622.28; C_P = 0.542159; Fc' = 503.12; margin 503.12/138.78.
    const r = computed(
      columnCheck(
        post({
          material: { value: { speciesGrade: 'southern-pine-no2', incised: true } },
          conditions: { ...DRY, wet: { value: true, reason: 'Outdoors.' } },
        }),
      ),
    );
    expect(step(r, 'Fc*')).toBeCloseTo(928, 9);
    expect(step(r, "Emin'")).toBeCloseTo(436_050, 6);
    expect(step(r, 'C_P')).toBeCloseTo(0.542159, 5);
    expect(r.allowable.value).toBeCloseTo(503.124, 2);
    expect(r.margin).toBeCloseTo(3.6254, 3);
    const fc = r.factors.filter((f) => f.appliesTo.includes('Fc'));
    expect(fc.map((f) => [f.symbol, f.value])).toEqual([
      ['C_D', 1],
      ['C_M', 0.8],
      ['C_t', 1],
      ['C_F', 1],
      ['C_i', 0.8],
    ]);
  });

  it('takes the stress on the net area when one is given', () => {
    const r = computed(
      columnCheck(
        post({
          member: { ...post().member, netArea: { value: 10.28125, basis: 'One 9/16" hole.' } },
        }),
      ),
    );
    expect(step(r, 'A_n')).toBe(10.28125);
    expect(r.computed.value).toBeCloseTo(1700 / 10.28125, 9);
    expect(r.breakEven?.value).toBeCloseTo((630.70665 * 10.28125 - 200) / 1000, 4);
  });

  it('is not computed past ℓe/d = 50, the NDS limit (3.7.1.4)', () => {
    // 1.2 · 150 / 3.5 = 51.43.
    const member = post().member;
    const r = columnCheck(
      post({
        member: {
          ...member,
          axes: [{ label: 'North to south', d: 3.5, length: 150, Ke: 1.2, basis: 'Free to sway.' }],
        },
      }),
    );
    expect(r.status).toBe('not-computed');
    if (r.status !== 'not-computed') return;
    expect(r.reason).toBe(
      'ℓe/d is 51.4 north to south, over 50, the NDS limit for a solid column. Free to sway.',
    );
    expect(r.sources.map((s) => s.locator)).toContain('3.7.1.4, p. 23');
  });

  it('is computed at ℓe/d = 50 exactly', () => {
    const member = post().member;
    const r = columnCheck(
      post({
        member: {
          ...member,
          axes: [{ label: 'North to south', d: 3.5, length: 175, Ke: 1, basis: 'Pinned.' }],
        },
      }),
    );
    expect(computed(r).steps.find((s) => s.symbol === 'ℓe/d')?.value).toBe(50);
  });

  it('is not computed when the template gives no end conditions in some direction', () => {
    const r = columnCheck(
      post({ member: { ...post().member, axes: { reason: 'Nothing holds it.' } } }),
    );
    expect(r).toMatchObject({ status: 'not-computed', reason: 'Nothing holds it.' });
  });

  it('reports slenderness before missing inputs, since it needs none', () => {
    const r = columnCheck(
      post({
        member: { ...post().member, axes: { reason: 'Nothing holds it.' } },
        material: { missing: [{ key: 'grade', label: 'Grade' }] },
      }),
    );
    expect(r.status).toBe('not-computed');
  });

  it('lists missing material, load, and factor inputs', () => {
    const r = columnCheck(
      post({
        material: { missing: [{ key: 'grade', label: 'Grade' }] },
        load: { missing: [{ key: 'load', label: 'Load' }] },
        factor: factor(),
      }),
    );
    expect(r).toMatchObject({
      status: 'input-needed',
      missing: [
        { key: 'grade', label: 'Grade' },
        { key: 'load', label: 'Load' },
        { key: 'factor', label: 'Load factor' },
      ],
    });
  });

  it('gives the break-even factor while only the factor is missing', () => {
    const r = columnCheck(post({ factor: factor() }));
    if (r.status !== 'input-needed') throw new Error(`Expected input needed: ${r.status}`);
    expect(r.breakEven?.value).toBeCloseTo(7.5262, 3);
  });

  it('refuses load duration factors above 1.6 for lumber treated with water-borne preservatives', () => {
    const r = columnCheck(
      post({
        conditions: {
          ...DRY,
          loadDuration: { value: 'impact', reason: 'Impact.' },
          waterborneTreatment: true,
        },
      }),
    );
    expect(r.status).toBe('not-computed');
  });

  it('is not computed for a size with no design values', () => {
    const r = columnCheck(post({ member: { ...post().member, nominal: '6x6' } }));
    expect(r).toMatchObject({ status: 'not-computed' });
  });

  it('reports a margin, never a verdict', () => {
    for (const r of [columnCheck(post()), columnCheck(post({ factor: factor() }))]) {
      expect(JSON.stringify(r)).not.toMatch(VERDICT_WORDS);
    }
  });
});
