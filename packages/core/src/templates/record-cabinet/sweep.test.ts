import { describe, expect, it } from 'vitest';
import { type Random, sweep } from '../sweep.ts';
import { recordCabinet } from './definition.ts';
import { EXAMPLES } from './examples.ts';

// The record cabinet across its parameter ranges (#571): every parameter drawn within its
// schema's range, from the worked example, from a fixed seed.

const [worked] = EXAMPLES;
if (!worked) throw new Error('No worked example');

function sample(r: Random) {
  const p = worked?.params;
  if (!p) throw new Error('No worked example');
  const boardThickness = r.between(0.75, 1.25);
  const legSize = r.between(1, 3);
  return {
    structuralInputs: worked?.structuralInputs,
    params: {
      ...p,
      width: r.between(30, 72),
      bayHeight: r.between(12, 18),
      caseDepth: r.between(13, 20),
      bays: r.int(2, 4),
      panelThickness: r.between(0.625, Math.min(1, boardThickness)),
      dadoDepth: r.between(0.0625, 0.5),
      stoppedSetback: r.between(0.0625, 2),
      endOverhang: r.between(0, 2),
      frontOverhang: r.between(0, 2),
      legShowing: r.between(2, 12),
      apronHeight: r.between(1.5, 5),
      legStock: { ...p.legStock, size: legSize },
      footSize: r.between(0.0625, legSize),
      apronSetback: r.between(0, 1),
      tenonThickness: r.between(0.0625, 0.5),
      tenonLength: r.between(0.0625, 1.5),
      doors: r.pick(['sliding', 'none'] as const),
      door: {
        clearance: r.between(0, 0.125),
        land: r.between(0.125, 0.5),
        bottomDepth: r.between(0.125, 0.5),
        topDepth: r.between(0.25, 1),
        overlap: r.between(0, 2),
        frameWidth: r.between(1.5, 4),
        grooveDepth: r.between(0.25, 0.5),
      },
      railHeight: r.between(2, 4),
      board: { ...p.board, thickness: boardThickness, width: r.between(3.5, 7.25) },
    },
  };
}

describe('the record cabinet across its ranges', () => {
  const swept = sweep(recordCabinet as never, sample, { count: 800, seed: 571, showEvery: 10 });

  it('makes enough plans for the sweep to mean something', () => {
    expect(swept.accepted).toBeGreaterThan(600);
    expect(swept.made).toBeGreaterThan(150);
  });

  // A top track can be cut deeper than the top is thick (#574). Remove this when it is refused.
  const known = (failure: string) =>
    failure.endsWith('top 0: A dado for door-rail runs past the part.');

  it('never throws, and every plan goes together, reads back, and shows', () => {
    expect(swept.failures.filter((f) => !known(f))).toEqual([]);
  });

  it('still finds the top tracks cut through the top (#574)', () => {
    expect(swept.failures.filter(known).length).toBeGreaterThan(0);
  });
});
