import { describe, expect, it } from 'vitest';
import { WOOD_SPECIES } from '../design-values/woodSpecies.ts';
import { BeamChecks } from './checks.ts';
import { type ClearWoodDeflectionInput, clearWoodChecks } from './clearWood.ts';

// Hand-checked examples from #275 and #288: a 3/4" × 13" shelf, simply supported, 40 lb per foot
// of records (illustrative) as a long-term load. I = 13 × 0.75³ / 12 = 0.45703 in⁴,
// w = 40/12 lb/in, δ = 5wL⁴ / (384EI), long-term = 1.5 × immediate.

function shelf(species: string, span: number, over: Partial<ClearWoodDeflectionInput> = {}) {
  const input: ClearWoodDeflectionInput = {
    member: {
      subject: 'Shelf',
      breadth: 13,
      depth: 0.75,
      sizeBasis: 'Panel size',
      supportsX: [0, span],
    },
    species: { value: species },
    creep: 'seasoned-dry',
    loadCase: {
      name: 'Records',
      longTerm: { value: { points: [], uniform: { w: 40 / 12, label: 'Records' } } },
      shortTerm: { points: [] },
      working: [],
      assumptions: [],
      limitRatio: { value: 144 },
    },
    assumptions: [],
    ...over,
  };
  return clearWoodChecks(input);
}

function deflection(checks: BeamChecks) {
  const d = checks.deflection;
  if (d.status !== 'computed') throw new Error(d.status);
  const immediate = d.steps.find((q) => q.symbol === 'Δ_LT')?.value;
  return { immediate, total: d.computed.value, margin: d.margin, allowed: d.allowable.value };
}

describe('clear-wood species data', () => {
  it('matches Table 5-3b at 12% for the species the examples use', () => {
    const E = (id: string) => WOOD_SPECIES.find((s) => s.id === id)?.clearWood.E;
    expect(E('black-cherry')).toBe(1_490_000);
    expect(E('black-walnut')).toBe(1_680_000);
    expect(E('white-oak')).toBe(1_780_000);
  });
});

describe('clearWoodChecks', () => {
  it('matches the hand-checked shelves', () => {
    const cases: [string, number, number, number][] = [
      ['black-cherry', 24, 0.02115, 0.03172],
      ['black-cherry', 32, 0.06683, 0.10025],
      ['black-walnut', 32, 0.05927, 0.08891],
      ['white-oak', 32, 0.05594, 0.08392],
    ];
    for (const [species, span, immediate, total] of cases) {
      const r = deflection(shelf(species, span));
      expect(r.immediate, `${species} ${span}`).toBeCloseTo(immediate, 5);
      expect(r.total, `${species} ${span}`).toBeCloseTo(total, 5);
    }
  });

  it('works the cherry shelf at 24" exactly', () => {
    // 5 × (40/12) × 24⁴ / (384 × 1,490,000 × 0.45703125) = 5,529,600 / 261,495,000
    const r = deflection(shelf('black-cherry', 24));
    expect(r.immediate).toBeCloseTo(5_529_600 / 261_495_000, 12);
    expect(r.total).toBeCloseTo((1.5 * 5_529_600) / 261_495_000, 12);
    expect(r.allowed).toBe(24 / 144);
    expect(r.margin).toBeCloseTo(24 / 144 / r.total, 12);
  });

  it('applies creep only to long-term loads', () => {
    const noLongTerm = shelf('black-cherry', 24, {
      loadCase: {
        name: 'Short only',
        longTerm: { value: { points: [] } },
        shortTerm: { points: [], uniform: { w: 40 / 12, label: 'Records' } },
        working: [],
        assumptions: [],
        limitRatio: { value: 144 },
      },
    });
    expect(deflection(noLongTerm).total).toBeCloseTo(5_529_600 / 261_495_000, 12);
  });

  it('uses 2.0 for unseasoned lumber or wet service', () => {
    const wet = deflection(shelf('black-cherry', 24, { creep: 'unseasoned-or-wet' }));
    expect(wet.total).toBeCloseTo((2 * 5_529_600) / 261_495_000, 12);
  });

  it('puts bending and shear on the checklist, and parses as stored checks', () => {
    const checks = shelf('black-cherry', 24);
    expect(checks.bending.status).toBe('not-computed');
    expect(checks.shear.status).toBe('not-computed');
    expect(() => BeamChecks.parse(checks)).not.toThrow();
  });

  it('lists missing inputs, never a stand-in value', () => {
    const checks = shelf('black-cherry', 24, {
      species: { missing: [{ key: 'species', label: 'Species' }] },
    });
    expect(checks.deflection).toMatchObject({
      status: 'input-needed',
      missing: [{ key: 'species', label: 'Species' }],
    });
  });

  it('refuses a load outside the supports', () => {
    const checks = shelf('black-cherry', 24, {
      loadCase: {
        name: 'Records',
        longTerm: { value: { points: [{ x: 30, P: 10, label: 'Speaker' }] } },
        shortTerm: { points: [] },
        working: [],
        assumptions: [],
        limitRatio: { value: 144 },
      },
    });
    expect(checks.deflection.status).toBe('not-computed');
  });
});
