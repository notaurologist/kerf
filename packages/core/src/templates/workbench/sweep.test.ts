import { describe, expect, it } from 'vitest';
import { type Random, sweep } from '../sweep.ts';
import { workbench } from './definition.ts';
import { CHERRY, WORKED_EXAMPLE } from './examples.ts';

// The workbench across its parameter ranges (docs/templates/workbench.md, Parameters): each draw
// either makes a bench whose parts go together (fit/), reads back, and shows, or is refused with
// issues, and never throws. Hand-checked examples cover what someone thought of; a sweep finds
// what they did not.

function sample(r: Random) {
  const caseThickness = r.between(0.625, 0.75);
  const legSize = r.between(2.5, 4);
  return {
    structuralInputs: CHERRY,
    params: {
      ...WORKED_EXAMPLE,
      height: r.between(28, 42),
      topLength: r.between(36, 96),
      topDepth: r.between(14, 30),
      topThickness: r.between(1.5, 4),
      overhangEnds: r.between(2, 12),
      overhangFront: r.between(0, 3),
      overhangBack: r.between(0, 3),
      legSize,
      footHeight: r.between(2, 4),
      footPast: r.between(0, 3),
      lowRailHeight: r.between(2, 5),
      endRailHeight: r.between(2, 5),
      railThickness: r.between(1, legSize),
      caseThickness,
      dadoDepth: r.between(0.0625, caseThickness / 2),
      stopSetback: r.between(0.0625, 1),
      drawerBand: r.between(6, 14),
      upperOpening: r.between(2, 5),
      chopThickness: r.between(1.5, 3),
    },
  };
}

describe('the workbench across its parameter ranges', () => {
  const swept = sweep(workbench as never, sample, { count: 800, seed: 577, showEvery: 10 });

  it('makes enough plans for the sweep to mean something', () => {
    expect(swept.accepted).toBeGreaterThan(600);
    expect(swept.made).toBeGreaterThan(100);
  });

  it('never throws, and every plan goes together, reads back, and shows', () => {
    expect(swept.failures).toEqual([]);
  });
});
