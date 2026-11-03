import { swingSetAFrame } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { type Generator, parity, sampledCases } from '../../parity.ts';
import type { Random } from '../../random.ts';
import { design } from './design.ts';

// The swing set from joints against the template across its parameter ranges
// (docs/explorations/joint-model.md, Parity sweep): every parameter drawn within its schema's
// range, from the worked example. Draws the template refuses are compared too, issue for issue.

const template = swingSetAFrame.definition;
const [worked] = template.examples;
if (!worked) throw new Error('No worked example');
const DIAMETERS = [0.375, 0.5, 0.625, 0.75] as const;

function sample(r: Random) {
  const p = worked?.params;
  if (!p) throw new Error('No worked example');
  const beamLength = r.between(48, 240);
  const beamHeight = r.between(60, 144);
  const builtUp = r.chance(0.4);
  const burialDepth = r.chance(0.3) ? 0 : r.between(0, 48);
  const spacing = r.between(12, 24);
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
      beamStock: builtUp ? r.pick(['2x6', '2x8', '2x10']) : r.pick(['4x6', '4x8', '6x6', '6x8']),
      beamPlies: builtUp ? r.int(2, 3) : 1,
      legStock: r.pick(['4x4', '4x6', '6x6']),
      crossbarStock: r.pick(['2x4', '2x6', '2x8']),
      crossbarHeight: r.between(12, beamHeight - 12),
      gussetStock: r.pick(['2x6', '2x8', '2x10']),
      frameInset: r.between(0, 24),
      groundSlope: r.between(-3, 3),
      burialDepth,
      swings: {
        ...p.swings,
        centers: [r.between(0.25, 0.45) * beamLength, r.between(0.55, 0.75) * beamLength],
        hangerSpacing: spacing,
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

describe('the swing set from joints, swept', () => {
  const cases = sampledCases(template, sample, 800, 543);
  const generate = swingSetAFrame.generateWith(design) as Generator;

  it('draws enough plans the template makes', () => {
    const made = cases.filter((c) => template.generate(c.params, c.structuralInputs).ok);
    expect(cases.length).toBeGreaterThan(300);
    expect(made.length).toBeGreaterThan(150);
  });

  it('matches the template in every draw', () => {
    const results = parity(template, generate, cases, { shown: false });
    expect(results.filter((r) => r.mismatches.length > 0)).toEqual([]);
  });

  it('shows the same plan in every twentieth draw', () => {
    const results = parity(
      template,
      generate,
      cases.filter((_, i) => i % 20 === 0),
    );
    expect(results.filter((r) => r.mismatches.length > 0)).toEqual([]);
  });
});
