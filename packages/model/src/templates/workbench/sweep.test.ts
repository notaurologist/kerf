import { fitProblems, hardwareList } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { type Random, seeded } from '../../random.ts';
import { EXAMPLE, type WorkbenchParams } from './params.ts';
import { workbench } from './review.ts';

// The workbench across its parameter ranges (docs/templates/workbench.md, Parameters): each draw
// either makes a bench whose parts go together (fit/) or is refused with a message, and never
// throws. Hand-checked examples cover what someone thought of; a sweep finds what they did not.

function sample(r: Random): WorkbenchParams {
  const caseThickness = r.between(0.625, 0.75);
  const legSize = r.between(2.5, 4);
  const topThickness = r.between(1.5, 4);
  return {
    ...EXAMPLE,
    height: r.between(28, 42),
    topLength: r.between(36, 96),
    topDepth: r.between(14, 30),
    topThickness,
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
  };
}

const inputs = {
  species: 'black-cherry',
  orientation: 'flatsawn' as const,
  moisture: { low: 6, high: 10 },
  topLoad: 300,
  deflectionLimit: 144,
};

describe('the workbench across its parameter ranges', () => {
  it('makes a bench that goes together, or refuses with a message, for 800 draws', () => {
    const random = seeded(577);
    const failures: string[] = [];
    let made = 0;
    for (let i = 0; i < 800; i++) {
      const params = sample(random);
      try {
        const result = workbench(params, inputs);
        if (!result.ok) {
          if (!result.message) failures.push(`draw ${i}: refused with no message`);
          continue;
        }
        made++;
        for (const p of fitProblems(result.base, hardwareList(result.base.hardware))) {
          failures.push(`draw ${i}: ${p.check}, ${p.partId} ${p.instance}: ${p.message}`);
        }
      } catch (error) {
        failures.push(
          `draw ${i}: throws ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    expect(failures).toEqual([]);
    expect(made).toBeGreaterThan(100);
  });
});
