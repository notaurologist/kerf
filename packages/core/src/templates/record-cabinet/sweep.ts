import type { Random, SweepPlan } from '../sweep.ts';
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

export const SWEEP: SweepPlan = { count: 800, seed: 571, showEvery: 10, sample };
