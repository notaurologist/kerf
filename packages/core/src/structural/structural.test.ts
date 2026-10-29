import { describe, expect, it } from 'vitest';
import { STOCK_SIZE_SOURCES } from '../lumber/stock.ts';
import {
  deflectionTimesEIAt,
  maxDeflectionTimesEI,
  maxMoment,
  maxShear,
  reactions,
  type SpanLoad,
  type SpanLoads,
} from './beam.ts';
import { type BeamCheckInput, type BeamChecks, beamChecks, hardwareCheck } from './checks.ts';
import type { ServiceConditions } from './factors.ts';
import type { CheckResult, ComputedCheck } from './types.ts';

// Hand-checked worked examples for the generic checks, on a made-up member (each template tests
// its own structural model in its own folder). Expected values were computed independently from
// the textbook formulas, with deflection found by sampling the DA6 Figure 8 curve at 200,000
// points rather than by the exact method in beam.ts.

const pts = (points: SpanLoad[], w = 0): SpanLoads => ({ points, w });

describe('beam mechanics', () => {
  it('matches the symmetric two-load formulas (DA6 Figure 9)', () => {
    // L = 120, P = 500 at a = 30 from each support: M = P·a, V = P, δ·EI = P·a·(3L² − 4a²)/24.
    const loads = [
      { a: 30, P: 500 },
      { a: 90, P: 500 },
    ];
    expect(maxMoment(120, pts(loads))).toEqual({ M: 15000, x: 30 });
    expect(maxShear(120, pts(loads))).toBeCloseTo(500, 9);
    const d = maxDeflectionTimesEI(120, pts(loads));
    expect(d.deltaEI).toBeCloseTo((500 * 30 * (3 * 120 ** 2 - 4 * 30 ** 2)) / 24, 3);
    expect(d.x).toBeCloseTo(60, 6);
  });

  it('matches a single centered load (DA6 Figure 7)', () => {
    const loads = [{ a: 50, P: 1000 }];
    expect(maxMoment(100, pts(loads)).M).toBeCloseTo((1000 * 100) / 4, 9);
    expect(maxDeflectionTimesEI(100, pts(loads)).deltaEI).toBeCloseTo((1000 * 100 ** 3) / 48, 3);
  });

  it('matches an asymmetric pair of unequal loads', () => {
    // L = 100; 300 lb at 20, 100 lb at 70. R1 = (300·80 + 100·30)/100 = 270, R2 = 130.
    // M(20) = 270·20 = 5400; M(70) = 270·70 − 300·50 = 3900.
    const loads = [
      { a: 20, P: 300 },
      { a: 70, P: 100 },
    ];
    const R = reactions(100, pts(loads));
    expect(R.left).toBeCloseTo(270, 9);
    expect(R.right).toBeCloseTo(130, 9);
    expect(maxMoment(100, pts(loads))).toEqual({ M: 5400, x: 20 });
    const d = maxDeflectionTimesEI(100, pts(loads));
    expect(d.deltaEI).toBeCloseTo(5_218_658.94, 0);
    expect(d.x).toBeCloseTo(47.14, 2);
  });

  it('matches a uniform load alone (DA6 Figure 1): M = wL²/8, δ·EI = 5wL⁴/384', () => {
    const loads = pts([], 2);
    expect(reactions(100, loads).left).toBeCloseTo(100, 9);
    expect(maxMoment(100, loads).M).toBeCloseTo(2500, 9);
    expect(maxMoment(100, loads).x).toBeCloseTo(50, 9);
    const d = maxDeflectionTimesEI(100, loads);
    expect(d.deltaEI).toBeCloseTo((5 * 2 * 100 ** 4) / 384, 3);
    expect(d.x).toBeCloseTo(50, 6);
  });

  it('finds the largest moment between loads when a uniform load is added', () => {
    // L = 100, 100 lb at 20, w = 2: R1 = 80 + 100 = 180. Right of the load, V = 180 − 100 − 2x
    // is zero at x = 40, where M = 180·40 − 2·40²/2 − 100·20 = 3600.
    const loads = pts([{ a: 20, P: 100 }], 2);
    expect(maxMoment(100, loads)).toEqual({ M: 3600, x: 40 });
    const d = maxDeflectionTimesEI(100, loads);
    expect(d.deltaEI).toBeCloseTo(3_794_474.86, 0);
    expect(d.x).toBeCloseTo(48.01, 2);
  });

  it('gives the same deflection from either side of a load', () => {
    const loads = [{ a: 30, P: 200 }];
    expect(deflectionTimesEIAt(100, pts(loads), 30)).toBeCloseTo(
      (200 * 30 * 30 * 70 * 70) / (3 * 100),
      6,
    );
  });
});

const wetOutdoor: ServiceConditions = {
  wet: { value: true, reason: 'Outdoors, uncovered.' },
  temperature: { value: 'up-to-100F', reason: 'Ambient outdoor temperature.' },
  loadDuration: { value: 'ten-years', reason: 'Normal load duration.' },
  repetitive: { value: false, reason: 'A single member.' },
  waterborneTreatment: true,
};

function rail(overrides: Partial<BeamCheckInput['member']> = {}): BeamCheckInput {
  return {
    member: {
      subject: 'Test rail',
      nominal: '4x6',
      plies: 1,
      plyBreadth: 3.5,
      depth: 5.5,
      sizeSources: STOCK_SIZE_SOURCES,
      supportsX: [10, 106],
      unbracedLength: 96,
      ...overrides,
    },
    material: { value: { speciesGrade: 'southern-pine-no2', incised: false } },
    conditions: wetOutdoor,
    strength: {
      name: 'Strength',
      loads: {
        value: {
          points: [
            { x: 34, P: 400, label: 'Load 1' },
            { x: 82, P: 400, label: 'Load 2' },
          ],
        },
      },
      working: [],
      assumptions: [],
    },
    deflection: {
      name: 'Deflection',
      loads: {
        value: {
          points: [
            { x: 34, P: 200, label: 'Load 1' },
            { x: 82, P: 200, label: 'Load 2' },
          ],
        },
      },
      working: [],
      assumptions: [],
      limitRatio: { value: 240 },
    },
    assumptions: [],
  };
}

function computed(r: CheckResult): ComputedCheck {
  if (r.status !== 'computed') throw new Error(`Expected a computed check: ${JSON.stringify(r)}`);
  return r;
}

function factor(r: ComputedCheck, symbol: string): number | undefined {
  return r.factors.find((f) => f.symbol === symbol)?.value;
}

describe('beam checks, solid 4x6 Southern Pine No.2, wet service, symmetric loads', () => {
  // Span 96 between supports at 10 and 106; 400 lb at 24 and 72 from the left support.
  const checks: BeamChecks = beamChecks(rail());

  it('bending: M = P·a = 9600, f_b = 544.04, C_L = 0.9917, margin 1.82', () => {
    const b = computed(checks.bending);
    expect(b.steps.find((s) => s.symbol === 'M')?.value).toBeCloseTo(9600, 6);
    expect(b.computed.value).toBeCloseTo(544.0378, 3);
    // Fb·C_F = 1000 ≤ 1150, so C_M = 1.0 for Fb (Table 4B).
    expect(factor(b, 'C_M')).toBe(1);
    expect(factor(b, 'C_L')).toBeCloseTo(0.99174, 5);
    expect(b.allowable.value).toBeCloseTo(991.7396, 3);
    expect(b.margin).toBeCloseTo(1.82292, 4);
  });

  it("shear: V = 400, f_v = 31.17, Fv' = 175·0.97 = 169.75, margin 5.45", () => {
    const s = computed(checks.shear);
    expect(s.computed.value).toBeCloseTo(31.1688, 3);
    expect(s.allowable.value).toBeCloseTo(169.75, 6);
    expect(s.margin).toBeCloseTo(5.44615, 4);
  });

  it("deflection: δ = 0.0829 at midspan, E' = 1,260,000, limit L/240 = 0.4, margin 4.83", () => {
    const d = computed(checks.deflection);
    expect(d.computed.value).toBeCloseTo(0.082901, 5);
    expect(d.steps.find((s) => s.symbol === 'x_max')?.value).toBeCloseTo(58, 6);
    expect(d.allowable.value).toBeCloseTo(0.4, 9);
    expect(d.margin).toBeCloseTo(4.82503, 4);
  });

  it('lists every factor with its reason and source', () => {
    const b = computed(checks.bending);
    expect(b.factors.map((f) => f.symbol)).toEqual([
      'C_D',
      'C_M',
      'C_t',
      'C_L',
      'C_F',
      'C_fu',
      'C_i',
      'C_r',
    ]);
    for (const f of b.factors) {
      expect(f.reason.length).toBeGreaterThan(0);
      expect(f.sources.length).toBeGreaterThan(0);
    }
    expect(b.sources.length).toBeGreaterThan(0);
  });
});

describe('beam checks, two-ply 2x6 built-up beam, same loads', () => {
  // Each ply: b = 1.5, carries half of each load (decision 0013). Same Table 4B row as the 4x6.
  const checks = beamChecks(rail({ nominal: '2x6', plies: 2, plyBreadth: 1.5 }));

  it('bending: M per ply = 4800, f_b = 634.71, C_L = 0.8949 for one ply, margin 1.41', () => {
    const b = computed(checks.bending);
    expect(b.computed.value).toBeCloseTo(634.7107, 3);
    expect(factor(b, 'C_L')).toBeCloseTo(0.894852, 5);
    expect(b.margin).toBeCloseTo(1.40986, 4);
    expect(b.assumptions[0]).toContain('equal share');
  });

  it('shear: V per ply = 200, f_v = 36.36, margin 4.67', () => {
    const s = computed(checks.shear);
    expect(s.computed.value).toBeCloseTo(36.3636, 3);
    expect(s.margin).toBeCloseTo(4.66812, 4);
  });

  it('deflection: δ = 0.0967, margin 4.14', () => {
    const d = computed(checks.deflection);
    expect(d.computed.value).toBeCloseTo(0.096718, 5);
    expect(d.margin).toBeCloseTo(4.13574, 4);
  });
});

describe('beam checks, asymmetric loads', () => {
  // 400 lb at 24 and 200 lb at 60 from the left support: R1 = 375, R2 = 225, M = 375·24 = 9000.
  const input = rail();
  input.strength.loads = {
    value: {
      points: [
        { x: 34, P: 400, label: 'Load 1' },
        { x: 70, P: 200, label: 'Load 2' },
      ],
    },
  };
  input.deflection.loads = {
    value: {
      points: [
        { x: 34, P: 200, label: 'Load 1' },
        { x: 70, P: 100, label: 'Load 2' },
      ],
    },
  };
  const checks = beamChecks(input);

  it('matches the hand calculation', () => {
    expect(computed(checks.bending).computed.value).toBeCloseTo(510.0354, 3);
    expect(computed(checks.bending).margin).toBeCloseTo(1.94445, 4);
    expect(computed(checks.shear).margin).toBeCloseTo(5.80922, 4);
    const d = computed(checks.deflection);
    expect(d.computed.value).toBeCloseTo(0.069133, 5);
    expect(d.steps.find((s) => s.symbol === 'x_max')?.value).toBeCloseTo(56.077, 2);
    expect(d.margin).toBeCloseTo(5.78594, 4);
  });
});

describe('missing and unavailable inputs', () => {
  it('reports input needed for missing species, loads, and deflection limit, never a default', () => {
    const input = rail();
    input.material = { missing: [{ key: 'beam.speciesGrade', label: 'Beam species and grade' }] };
    input.deflection.limitRatio = {
      missing: [{ key: 'deflectionLimit', label: 'Deflection limit' }],
    };
    const checks = beamChecks(input);
    expect(checks.bending).toMatchObject({
      status: 'input-needed',
      missing: [{ key: 'beam.speciesGrade' }],
    });
    expect(checks.deflection).toMatchObject({
      status: 'input-needed',
      missing: [{ key: 'beam.speciesGrade' }, { key: 'deflectionLimit' }],
    });
  });

  it('reports input needed when only the loads are missing', () => {
    const input = rail();
    input.strength.loads = { missing: [{ key: 'riders', label: 'Rider weights' }] };
    expect(beamChecks(input).shear).toMatchObject({
      status: 'input-needed',
      missing: [{ key: 'riders' }],
    });
    expect(beamChecks(input).deflection.status).toBe('computed');
  });

  it('does not compute a size with no design values entered', () => {
    const checks = beamChecks(rail({ nominal: '6x6', plyBreadth: 5.5 }));
    expect(checks.bending).toMatchObject({ status: 'not-computed' });
  });

  it('does not compute loads outside the supports', () => {
    const input = rail();
    input.strength.loads = { value: { points: [{ x: 5, P: 100, label: 'Overhang load' }] } };
    expect(beamChecks(input).bending.status).toBe('not-computed');
  });

  it('applies incising and C_M for Fb above 1150 psi', () => {
    // No.1 2x4: Fb = 1500 > 1150, so C_M = 0.85; incised, C_i = 0.80 on Fb and Fv, 0.95 on E.
    const input = rail({ nominal: '2x4', plyBreadth: 1.5, depth: 3.5 });
    input.material = { value: { speciesGrade: 'southern-pine-no1', incised: true } };
    const checks = beamChecks(input);
    const b = computed(checks.bending);
    expect(factor(b, 'C_M')).toBe(0.85);
    expect(factor(b, 'C_i')).toBe(0.8);
    expect(computed(checks.shear).allowable.value).toBeCloseTo(175 * 0.97 * 0.8, 9);
    expect(computed(checks.deflection).steps.find((s) => s.symbol === "E'")?.value).toBeCloseTo(
      1_600_000 * 0.9 * 0.95,
      6,
    );
  });
});

describe('hardware check', () => {
  it('is the rating over the load', () => {
    const r = computed(
      hardwareCheck({
        subject: 'Hanger',
        loadCase: 'Strength',
        load: { value: { value: 400, working: [], assumptions: [] } },
        rating: { value: 1000 },
      }),
    );
    expect(r.margin).toBeCloseTo(2.5, 9);
  });

  it('needs the rating entered', () => {
    expect(
      hardwareCheck({
        subject: 'Hanger',
        loadCase: 'Strength',
        load: { value: { value: 400, working: [], assumptions: [] } },
        rating: { missing: [{ key: 'hangerRating', label: 'Hanger rated load' }] },
      }),
    ).toMatchObject({ status: 'input-needed', missing: [{ key: 'hangerRating' }] });
  });
});

describe('wording', () => {
  it('never says safe, unsafe, pass, or fail', () => {
    const text = JSON.stringify([beamChecks(rail()), beamChecks(rail({ nominal: '6x6' }))]);
    expect(text).not.toMatch(/\b(safe|unsafe|pass|passes|fail|fails)\b/i);
  });
});
