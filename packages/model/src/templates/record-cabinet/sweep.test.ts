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

type Case = {
  params: Parameters<typeof template.generate>[0];
  structuralInputs: Parameters<typeof template.generate>[1];
};

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

/**
 * Whether the template puts a leg's mortise outside the leg: it does not refuse an apron that,
 * with its setback, is wider than the leg (#561). The joint refuses those, so they are left out.
 */
function mortiseOutsideLeg(c: Case): boolean {
  const made = template.generate(c.params, c.structuralInputs);
  if (!made.ok) return false;
  const leg = made.output.design.parts.find((q) => q.id === 'leg');
  return (leg?.mortises ?? []).some((m) => m.a0 < 0 || m.a1 > (leg?.stock.width ?? 0));
}

/**
 * Whether the template sizes a door panel's tongue from `panelThickness` when its stock is a
 * board of another thickness (#562). The joint sizes it from the stock, so those differ.
 */
function tongueFromParameter(c: Case): boolean {
  const made = template.generate(c.params, c.structuralInputs);
  if (!made.ok) return false;
  const panel = made.output.design.parts.find((q) => q.id === 'door-panel');
  return panel !== undefined && panel.stock.thickness !== made.output.design.params.panelThickness;
}

/**
 * Whether the template's door is thicker than its stiles and rails: a frame wider than a board is
 * glued up and flattened, while the tracks and placements use the board's thickness (#563). The
 * joint refuses a frame whose grooves are not in one plane.
 */
function frameThinnerThanDoor(c: Case): boolean {
  const made = template.generate(c.params, c.structuralInputs);
  if (!made.ok) return false;
  const door = made.output.design.geometry.door;
  return made.output.design.parts.some(
    (q) =>
      (q.id.startsWith('door-stile') || q.id === 'door-rail') &&
      door !== undefined &&
      q.stock.thickness !== door.thickness,
  );
}

describe('the record cabinet from joints, swept', () => {
  const drawn = sampledCases(template, sample, 800, 543);
  const outside = drawn.filter(mortiseOutsideLeg);
  const thinFrame = drawn.filter(frameThinnerThanDoor);
  const thickTongue = drawn.filter((c) => !thinFrame.includes(c) && tongueFromParameter(c));
  const cases = drawn.filter(
    (c) => !outside.includes(c) && !thickTongue.includes(c) && !thinFrame.includes(c),
  );
  const generate = recordCabinet.generateWith(design) as Generator;

  it('draws enough plans the template makes', () => {
    const made = cases.filter((c) => template.generate(c.params, c.structuralInputs).ok);
    expect(cases.length).toBeGreaterThan(600);
    expect(made.length).toBeGreaterThan(180);
  });

  it('gives a door panel thicker than its parameter a tongue as thick as the groove', () => {
    expect(thickTongue.length).toBeGreaterThan(0);
    for (const c of thickTongue) {
      const made = recordCabinet.generateWith(design)(c.params, c.structuralInputs);
      if (!made.ok) throw new Error(c.name);
      const panel = made.output.design.parts.find((q) => q.id === 'door-panel');
      const tongue = (panel?.stock.thickness ?? 0) - 2 * (panel?.rabbets[0]?.depth ?? 0);
      expect(tongue).toBeCloseTo(c.params.tenonThickness, 9);
    }
  });

  it('refuses every draw whose door frame is thinner than the door', () => {
    expect(thinFrame.length).toBeGreaterThan(0);
    for (const c of thinFrame) {
      expect(() => generate(c.params, c.structuralInputs)).toThrow(/not in one plane/);
    }
  });

  it('refuses every draw whose mortise the template puts outside the leg', () => {
    expect(outside.length).toBeGreaterThan(0);
    for (const c of outside) {
      expect(() => generate(c.params, c.structuralInputs)).toThrow(/runs past the housing/);
    }
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
