import { fitProblems, type Part, type Placement } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { base } from './design.ts';
import { EXAMPLE } from './params.ts';

// The spec's worked example (docs/templates/workbench.md), worked by hand. x along the bench from
// the top's left end, y back from its front edge, z up from the floor. Legs at x 5 to 8 and 53-7/8
// to 56-7/8, y 0 to 3 and 13-5/8 to 16-5/8. Feet 1-3/4 deep in each foot's mortise; rail tenons
// 1/2 thick, 1/4 shoulders, 1-3/4 long; leg tenons 1 thick, 1/4 shoulders.

function made(movement?: number) {
  const result = base(EXAMPLE, movement);
  if (!result.ok) throw new Error(result.message);
  return result.base;
}
const example = made();
const part = (id: string, from = example): Part => {
  const found = from.parts.find((p) => p.id === id);
  if (!found) throw new Error(`No ${id}.`);
  return found;
};
const placement = (id: string, instance: number): Placement => {
  const found = example.placements.find((p) => p.partId === id && p.instance === instance);
  if (!found) throw new Error(`No ${id} ${instance}.`);
  return found;
};

describe('the base, from its joints', () => {
  it('has the spec’s derived geometry', () => {
    expect(example.geometry).toEqual({
      underside: 31.625,
      baseLength: 51.875,
      baseDepth: 16.625,
      legVisible: 28.625,
    });
  });

  it('cuts each part to the length its joints give', () => {
    // Foot 16-5/8 + 2 × 1 = 18-5/8. Leg 28-5/8 visible + 1-3/4 into the foot + 2-1/2 through
    // the top = 32-7/8. End rail 10-5/8 + 2 × 1-3/4 = 14-1/8. Low rail 45-7/8 + 3-1/2 = 49-3/8.
    const lengths = Object.fromEntries(example.parts.map((p) => [p.id, [p.length, p.quantity]]));
    expect(lengths).toEqual({
      top: [61.875, 1],
      foot: [18.625, 2],
      'leg-a': [32.875, 2],
      'leg-b': [32.875, 2],
      'end-rail': [14.125, 2],
      'low-rail': [49.375, 2],
    });
  });

  it('places the rails where the spec has them', () => {
    // End rails under the top, z 28-5/8 to 31-5/8, centered on the legs: 6-1/2 − 3/4 = 5-3/4.
    expect(placement('end-rail', 0).origin).toEqual({ x: 5.75, y: 1.25, z: 28.625 });
    // Low rails z 3 to 6, the front one centered on the front legs: y 1-1/2 + 3/4 = 2-1/4.
    expect(placement('low-rail', 0).origin).toEqual({ x: 6.25, y: 2.25, z: 3 });
  });

  it('puts the legs’ through tenons in the top, centered, long side along the bench', () => {
    // Front left: x 5 + 1/4 to 8 − 1/4, y 1 to 2. Front right: x 54-1/8 to 56-5/8. Back legs:
    // y 13-5/8 + 1 = 14-5/8 to 15-5/8.
    const at = (u0: number, a0: number) => ({
      withPart: 'leg',
      side: 'near',
      u0,
      u1: u0 + 2.5,
      a0,
      a1: a0 + 1,
      depth: 2.5,
    });
    expect(part('top').mortises).toEqual([
      at(5.25, 1),
      at(54.125, 1),
      at(5.25, 14.625),
      at(54.125, 14.625),
    ]);
    const tenon = (end: 0 | 1, length: number, v: number, n: number) =>
      expect.objectContaining({ end, length, v0: v, n0: n });
    // Leg A runs across x, so its top tenon is wide in v; its foot tenon is wide in n.
    expect(part('leg-a').tenons).toEqual([tenon(0, 1.75, 1, 0.25), tenon(1, 2.5, 0.25, 1)]);
  });

  it('lengthens the back legs’ mortises toward the back by the top’s movement', () => {
    const top = part('top', made(0.125));
    expect(top.mortises.map((m) => m.a1)).toEqual([2, 2, 15.75, 15.75]);
  });

  it('mortises each foot 1-3/4 deep for its legs, long side front to back', () => {
    // The foot runs from y = −1, so the front leg's tenon, y 1/4 to 2-3/4, is at u 1-1/4 to 3-3/4;
    // the back one, y 13-7/8 to 16-3/8, at u 14-7/8 to 17-3/8. Across, from x = 8 back toward the
    // leg: its tenon at x 6 to 7 is v 1 to 2.
    expect(part('foot').mortises).toEqual([
      { withPart: 'leg', side: 'far', u0: 1.25, u1: 3.75, a0: 1, a1: 2, depth: 1.75 },
      { withPart: 'leg', side: 'far', u0: 14.875, u1: 17.375, a0: 1, a1: 2, depth: 1.75 },
    ]);
  });

  it('mortises leg A for its end rail and its low rail', () => {
    // The leg starts at z = 1-1/4. End rail tenon z 28-7/8 to 31-3/8 is u 27-5/8 to 30-1/8, on the
    // face toward the other leg, x 6-1/4 to 6-3/4: v 1-1/4 to 1-3/4. Low rail tenon z 3-1/4 to
    // 5-3/4 is u 2 to 4-1/2, on the edge toward the other end, y 1-1/4 to 1-3/4.
    expect(part('leg-a').mortises).toEqual([
      {
        withPart: 'end-rail',
        side: 'far',
        u0: 27.625,
        u1: 30.125,
        a0: 1.25,
        a1: 1.75,
        depth: 1.75,
      },
      { withPart: 'low-rail', side: 'far-edge', u0: 2, u1: 4.5, a0: 1.25, a1: 1.75, depth: 1.75 },
    ]);
  });

  it('glues the top from strips on edge, and the square parts from strips lying flat', () => {
    // Top: (17-5/8 + 1/2) / 13/16 = 22.3, so 23 strips, each 2-1/2 + 1/16 wide. Leg: (3 + 1/2) /
    // 13/16 = 4.3, so 5 strips. Rails: (1-1/2 + 1/2) / 13/16 = 2.5, so 3 strips.
    expect(part('top').stock).toMatchObject({
      stackedAcross: 'width',
      strips: 23,
      stripWidth: 2.5625,
    });
    expect(part('leg-a').stock).toMatchObject({ stackedAcross: 'thickness', strips: 5 });
    expect(part('end-rail').stock).toMatchObject({ strips: 3, stripWidth: 3.0625 });
  });

  it('passes the fit checks', () => {
    expect(fitProblems(example)).toEqual([]);
  });

  it('passes the fit checks with the back mortises left long for the top’s movement', () => {
    expect(fitProblems(made(0.125))).toEqual([]);
  });

  it('refuses a top whose strips are wider than the board', () => {
    // A 6-1/2 top stands its strips on edge, ripped 6-9/16 wide from a 5-1/2 board.
    expect(base({ ...EXAMPLE, topThickness: 6.5, height: 38 })).toMatchObject({ ok: false });
  });
});
