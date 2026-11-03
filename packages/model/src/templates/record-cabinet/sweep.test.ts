import { recordCabinet } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { type Generator, parity, sampledCases } from '../../parity.ts';
import type { Random } from '../../random.ts';
import { design } from './design.ts';

// The record cabinet from joints against the template across its parameter ranges
// (docs/explorations/joint-model.md, Parity sweep): every parameter drawn within its schema's
// range, from the worked example. Draws the template refuses are compared too, issue for issue.

const template = recordCabinet.definition;
const [worked] = template.examples;
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

describe('the record cabinet from joints, swept', () => {
  const cases = sampledCases(template, sample, 800, 543);
  const generate = recordCabinet.generateWith(design) as Generator;

  it('draws enough plans the template makes', () => {
    const made = cases.filter((c) => template.generate(c.params, c.structuralInputs).ok);
    expect(cases.length).toBeGreaterThan(600);
    expect(made.length).toBeGreaterThan(180);
  });

  it('matches the template in every draw', () => {
    const results = parity(template, generate, cases, { shown: false });
    expect(results.filter((r) => r.mismatches.length > 0)).toEqual([]);
  });

  it('shows the same plan in every tenth draw', () => {
    const results = parity(
      template,
      generate,
      cases.filter((_, i) => i % 10 === 0),
    );
    expect(results.filter((r) => r.mismatches.length > 0)).toEqual([]);
  });
});
