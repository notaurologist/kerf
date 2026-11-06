import { swingSetAFrame } from '@kerf/core';
import { SWEEPS, sweep } from '@kerf/core/sweeps';
import { VERDICT_WORDS } from '@kerf/core/testing';
import { describe, expect, it } from 'vitest';
import { HEADING } from './aFrame.ts';
import { SOUTHERN_PINE_SHEAR_RATIOS, shearRatio } from './space/torsion.ts';
import { type FrameOnlyInputs, type Instance, LEG_TOLERANCE, runSweep } from './sweep.ts';
import { sweepMarkdown } from './sweepReport.ts';

// A seeded subset of the swing set's sweep: the first 160 draws reach a pinned-on-pads instance
// the solver returns numbers for (draw 138) and rigid buried legs over the leg tolerance. The full
// sweep runs as `pnpm --filter @kerf/frame sweep`.

const SLASH = SOUTHERN_PINE_SHEAR_RATIOS[2];
const EXTRA: FrameOnlyInputs = {
  shearModulus: { ratio: shearRatio(SLASH), basis: 'Wood Handbook Table 5–1, slash pine' },
  crossbarAndGusset: 'as the legs',
};
const COUNT = 160;
const run = runSweep(EXTRA, COUNT);
const all = [...run.examples, ...run.draws];
type Analyzed = Extract<Instance, { kind: 'analyzed' }>;
const analyzed = all.filter((i): i is Analyzed => i.kind === 'analyzed');
const named = (name: string) => {
  const found = analyzed.find((i) => i.where.instance === name);
  if (!found) throw new Error(`${name} was not analyzed`);
  return found;
};

describe('every instance', () => {
  it('is counted, with each example and draw once', () => {
    expect(run.examples).toHaveLength(swingSetAFrame.EXAMPLES.length);
    expect(run.draws.map((d) => (d.kind === 'analyzed' ? d.where.instance : d.instance))).toEqual(
      Array.from({ length: COUNT }, (_, i) => `draw ${i}`),
    );
    expect(all.filter((i) => i.kind === 'threw')).toEqual([]);
  });

  it("draws what core's sweep draws: the same draws accepted and made", () => {
    const plan = SWEEPS[swingSetAFrame.definition.id];
    if (!plan) throw new Error('No sweep');
    const core = sweep(swingSetAFrame.definition, { ...plan, count: COUNT });
    const accepted = run.draws.filter((d) => d.kind !== 'rejected');
    const made = accepted.filter((d) => d.kind !== 'refused');
    expect(accepted).toHaveLength(core.accepted);
    expect(made).toHaveLength(core.made);
  });

  it('reports the worked example without structural inputs as input needed', () => {
    const none = run.examples.find((e) => e.kind === 'input-needed');
    expect(none?.kind === 'input-needed' && none.instance).toBe(
      'Example: Worked example, no structural inputs',
    );
  });
});

describe("the legs' axial load against core's leg check", () => {
  it("takes core's P for the worked example: (2·300 + 26.028) / (2·cos 20°) = 333.10 (example 5)", () => {
    const worked = named('Example: Worked example, every input entered');
    for (const l of worked.legs) expect(l.core).toBeCloseTo(333.1, 1);
    // Step 2's comparison, now in 3D: buried, pinned, within 0.1%.
    const pinned = worked.legs.find((l) => l.joints === 'pinned');
    expect(Math.abs(pinned?.relative ?? 1)).toBeLessThan(0.001);
  });

  it('flags exactly the comparisons over the stated tolerance', () => {
    const legs = analyzed.flatMap((i) => i.legs);
    expect(legs.length).toBeGreaterThan(0);
    for (const l of legs) expect(l.over).toBe(Math.abs(l.relative) > LEG_TOLERANCE);
    expect(legs.some((l) => l.over)).toBe(true);
  });
});

describe("the push against core's P", () => {
  it("gives step 2's pushed leg for the worked example: 420.7 lb buried, pinned, 26% over P", () => {
    const worked = named('Example: Worked example, every input entered');
    const back = worked.pushes.find(
      (p) => p.joints === 'pinned' && p.load.startsWith('Pushed toward the back'),
    );
    expect(back?.at).toMatch(/-back-leg-/);
    expect(Math.abs((back?.frame ?? 0) / 420.7 - 1)).toBeLessThan(0.001);
    expect(back?.relative).toBeGreaterThan(0.25);
    expect(back?.relative).toBeLessThan(0.27);
  });

  it('runs both pushes in every support case that solves, and none pinned on pads', () => {
    for (const i of analyzed) {
      for (const p of i.pushes) expect(p.load).toMatch(/^Pushed toward the (front|back)/);
      const pinned = i.pushes.filter((p) => p.joints === 'pinned');
      expect(pinned).toHaveLength(i.pads ? 0 : 2);
      expect(i.pushes.filter((p) => p.joints === 'rigid')).toHaveLength(i.pads ? 4 : 2);
    }
  });
});

describe('foot uplift against core’s uplift check', () => {
  it('matches it where each frame is determinate and the set symmetric', () => {
    // The two-ply beam on pads: level ground, equal riders, swings centered on the beam, so each
    // frame carries half and, with the lifting feet released, has three reactions (step 4).
    const pads = named('Example: Two-ply 2x6 beam on pads, level ground, footprint depth');
    expect(pads.uplift.map((u) => u.foot)).toHaveLength(4);
    for (const u of pads.uplift) {
      expect(u.joints).toBe('rigid');
      expect(Math.abs(u.difference)).toBeLessThan(1e-6);
    }
  });

  it('is not compared for buried legs, which core gives no uplift check', () => {
    for (const i of analyzed.filter((x) => !x.pads)) expect(i.uplift).toEqual([]);
  });
});

describe('pinned joints on pads', () => {
  const pads = analyzed.filter((i) => i.pads);

  it('are the mechanism along the beam in every case, with no numbers', () => {
    expect(pads.length).toBeGreaterThan(0);
    for (const i of pads) {
      const p = i.joints.pinned;
      expect(p.sway.kind).toBe('mechanism-along-beam');
      expect([p.compression, p.moment, p.footDown, p.footUplift]).toEqual([null, null, null, null]);
      expect(p.solvedCases).toBe(0);
      expect(i.legs.some((l) => l.joints === 'pinned')).toBe(false);
    }
  });

  it('keep apart the stiffness the solver returned where it did not read the mechanism', () => {
    // Draw 138: the sloped line through the feet leaves a stiffness five orders of magnitude
    // under the same frame with rigid joints.
    const i = named('draw 138');
    const rigid = i.joints.rigid.sway;
    expect(i.joints.pinned.residual).not.toBeNull();
    expect(rigid.kind).toBe('solved');
    if (rigid.kind === 'solved') {
      expect((i.joints.pinned.residual as number) * rigid.perPound).toBeLessThan(1e-4);
    }
  });
});

describe('buried legs', () => {
  it('are stiffer along the beam with rigid joints than pinned', () => {
    const buried = analyzed.filter((i) => !i.pads);
    expect(buried.length).toBeGreaterThan(0);
    for (const i of buried) {
      const p = i.joints.pinned.sway;
      const r = i.joints.rigid.sway;
      if (p.kind !== 'solved' || r.kind !== 'solved') throw new Error('Not solved');
      expect(r.perPound).toBeLessThan(p.perPound);
    }
  });
});

describe('the report', () => {
  const md = sweepMarkdown(run);

  it('is headed as exploratory, with its assumptions and tolerances', () => {
    expect(md.startsWith(`# ${HEADING}\n`)).toBe(true);
    expect(md).toContain('## Inputs and assumptions');
    expect(md).toContain('### Comparison tolerances, fixed before the run');
  });

  it('counts every instance', () => {
    expect(md).toContain(`| Total | ${all.length} |`);
  });

  it('uses no verdict words', () => {
    expect(md).not.toMatch(VERDICT_WORDS);
  });
});
