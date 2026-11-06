import { NOMINAL_SIZES, stock } from '../../lumber/stock.ts';
import type { Random, SweepPlan } from '../sweep.ts';
import { EXAMPLES } from './examples.ts';

// The swing set across its parameter ranges (#571): every parameter drawn within its schema's
// range, from the worked example, from a fixed seed.

const [worked] = EXAMPLES;
if (!worked) throw new Error('No worked example');
const DIAMETERS = [0.375, 0.5, 0.625, 0.75] as const;
// Every size the parameters accept, split as a built-up beam needs: its plies are 2x (validate.ts).
const TWO_BY = NOMINAL_SIZES.filter((n) => stock(n).thickness === 1.5);
const TIMBERS = NOMINAL_SIZES.filter((n) => stock(n).thickness > 1.5);

function sample(r: Random) {
  const p = worked?.params;
  if (!p) throw new Error('No worked example');
  const beamLength = r.between(48, 240);
  const beamHeight = r.between(60, 144);
  const builtUp = r.chance(0.4);
  const burialDepth = r.chance(0.3) ? 0 : r.between(0, 48);
  const mounting = r.pick(['vertical', 'horizontal', 'none'] as const);
  return {
    structuralInputs: worked?.structuralInputs,
    params: {
      ...p,
      beamLength,
      beamHeight,
      splay: r.chance(0.7)
        ? { kind: 'angle', degrees: r.between(5, 35) }
        : { kind: 'footprint', depth: r.between(40, 220) },
      beamStock: r.pick(builtUp ? TWO_BY : TIMBERS),
      beamPlies: builtUp ? r.int(2, 3) : 1,
      legStock: r.pick(TIMBERS),
      crossbarStock: r.pick(TWO_BY),
      crossbarHeight: r.between(12, beamHeight - 12),
      gussetStock: r.pick(TWO_BY),
      frameInset: r.between(0, 24),
      groundSlope: r.between(-3, 3),
      burialDepth,
      swings: {
        ...p.swings,
        centers: [r.between(0.25, 0.45) * beamLength, r.between(0.55, 0.75) * beamLength],
        hangerSpacing: r.between(12, 24),
      },
      hardware: {
        ...p.hardware,
        legBoltDiameter: r.pick(DIAMETERS),
        crossbarBolts: { diameter: r.pick(DIAMETERS), perJoint: r.int(1, 4) },
        gussetBolts: { diameter: r.pick(DIAMETERS), perJoint: r.int(1, 4) },
        ...(builtUp ? { plyBolts: { diameter: r.pick(DIAMETERS), count: r.int(4, 12) } } : {}),
        ...(burialDepth === 0 ? { anchorsPerFoot: r.int(1, 4) } : {}),
        hangerMounting:
          mounting === 'vertical'
            ? { kind: 'vertical-bolt', diameter: r.pick(DIAMETERS) }
            : mounting === 'horizontal'
              ? {
                  kind: 'horizontal-bolts',
                  diameter: r.pick(DIAMETERS),
                  perHanger: r.int(1, 4),
                  holeHeight: r.between(1, 4),
                }
              : undefined,
      },
    },
  };
}

export const SWEEP: SweepPlan = { count: 800, seed: 571, showEvery: 10, sample };
