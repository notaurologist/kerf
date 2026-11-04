import { fitProblems, hardwareList, type Part, type Placement } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { base, ILLUSTRATIVE } from './design.ts';
import { EXAMPLE } from './params.ts';

// The spec's worked example (docs/templates/workbench.md), worked by hand. x along the bench from
// the top's left end, y back from its front edge, z up from the floor. Legs at x 5 to 8 and 53-7/8
// to 56-7/8, y 0 to 3 and 13-5/8 to 16-5/8. Feet 1-3/4 deep in each foot's mortise; rail tenons
// 1/2 thick, 1/4 shoulders, 1-3/4 long; leg tenons 1 thick, 1/4 shoulders.

function made(topRoom?: number) {
  const result = base(EXAMPLE, topRoom === undefined ? ILLUSTRATIVE : { ...ILLUSTRATIVE, topRoom });
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
      // Inside 45-7/8 − 2 × 3/4; upper openings (44-3/8 − 3/4) / 2; lower 10 − 3 × 3/4 − 3-1/4.
      caseInside: 44.375,
      upperOpenings: 21.8125,
      lowerOpening: 4.5,
      // Tenons 16-5/8 − 3 apart; the back 44-3/8 + 2 × 3/8; a drawer bottom from its front
      // groove's bottom at 1-1/16 to the back's face at 14-13/16; a door panel 22-3/32 − 4 + 3/4.
      spans: { tenons: 13.625, back: 45.125, bottom: 13.75, doorPanel: 18.84375 },
    });
  });

  it('cuts each part to the length its joints give', () => {
    // Foot 16-5/8 + 2 × 1 = 18-5/8. Leg 28-5/8 visible + 1-3/4 into the foot + 2-1/2 through
    // the top = 32-7/8. End rail 10-5/8 + 2 × 1-3/4 = 14-1/8. Low rail 45-7/8 + 3-1/2 = 49-3/8.
    const lengths = Object.fromEntries(example.parts.map((p) => [p.id, [p.length, p.quantity]]));
    expect(lengths).toEqual({
      top: [61.875, 1],
      foot: [18.625, 2],
      'leg-vise': [32.875, 1],
      'leg-a': [32.875, 1],
      'leg-b': [32.875, 2],
      'end-rail': [14.125, 2],
      'low-rail': [49.375, 2],
      // Case bottom between the legs, 45-7/8. Sides from the bottom's dado, 6-3/4 − 3/16, up
      // to the top at 31-5/8: 25-1/16. Shelves 44-3/8 + 2 × 3/16. Divider 3-1/4 + 2 × 3/16. Back
      // from 6-3/4 − 3/8 to 30-7/8 + 3/8, less 2 × 1/32: 24-13/16.
      'case-bottom': [45.875, 1],
      'case-side-left': [25.0625, 1],
      'case-side-right': [25.0625, 1],
      'shelf-upper': [44.75, 1],
      'shelf-middle': [44.75, 1],
      'shelf-lower': [44.75, 1],
      divider: [3.625, 1],
      'case-back': [24.8125, 1],
      // Upper openings 21-13/16 by 3-1/4: fronts 1/16 in all round, 21-11/16. Boxes 1/2 in from
      // each side, 20-13/16 wide, 14 deep on 14" slides (15-3/4 − 13/16 leaves 14-15/16).
      // Bottoms between the side grooves' bottoms, 20-5/16, less 2 × 1/32.
      'upper-drawer-front': [21.6875, 2],
      'upper-drawer-box-front': [20.8125, 2],
      'upper-drawer-box-back': [20.8125, 2],
      'upper-drawer-side-left': [14, 2],
      'upper-drawer-side-right': [14, 2],
      'upper-drawer-bottom': [20.25, 2],
      // The lower opening, 44-3/8 by 4-1/2.
      'lower-drawer-front': [44.25, 1],
      'lower-drawer-box-front': [43.375, 1],
      'lower-drawer-box-back': [43.375, 1],
      'lower-drawer-side-left': [14, 1],
      'lower-drawer-side-right': [14, 1],
      'lower-drawer-bottom': [42.8125, 1],
      // The door opening, 44-3/8 between the sides by 21-5/8 − 6-3/4 = 14-7/8. Each door
      // (44-3/8 − 3 × 1/16) / 2 = 22-3/32 wide and 14-7/8 − 1/8 = 14-3/4 tall. Rails 22-3/32 −
      // 2 × 2 + 2 × 3/8; the panel 14-3/4 − 4 + 3/4, less 2 × 1/32.
      'door-stile-hinge': [14.75, 2],
      'door-stile-meeting': [14.75, 2],
      'door-rail': [18.84375, 4],
      'door-panel': [11.4375, 2],
      // The face chop from the top's end to the front-left leg's inner face, 5 + 3; the vise block
      // from the right legs' outer face to the top's end, 5; the end chop across the top, 17-5/8.
      'face-chop': [8, 1],
      'vise-block': [5, 1],
      'end-chop': [17.625, 1],
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

  it('houses the sides in the case bottom, and grooves it for the back', () => {
    expect(part('case-bottom').dadoes).toEqual([
      {
        withPart: 'case-side-left',
        face: 'far',
        u0: 0,
        u1: 0.75,
        v0: 0,
        v1: 16.625,
        depth: 0.1875,
      },
      {
        withPart: 'case-side-right',
        face: 'far',
        u0: 45.125,
        u1: 45.875,
        v0: 0,
        v1: 16.625,
        depth: 0.1875,
      },
      // The back's middle: 16-5/8 − 3/8 − 1/8 = 16-1/8, so its groove is y 16 to 16-1/4.
      { withPart: 'case-back', face: 'far', u0: 0, u1: 45.875, v0: 16, v1: 16.25, depth: 0.375 },
    ]);
  });

  it('houses the shelves in the sides, stopped 1/2 from the front, with the back’s groove', () => {
    // The left side starts at z = 6-9/16. Shelves at z 30-7/8, 26-7/8, and 21-5/8; the upper
    // runs to the back edge, the others stop 1/16 before the back's front face at 15-3/4.
    const shelf = (withPart: string, u0: number, v1: number) => ({
      withPart,
      face: 'near',
      u0,
      u1: u0 + 0.75,
      v0: 0.5,
      v1,
      depth: 0.1875,
    });
    expect(part('case-side-left').dadoes).toEqual([
      shelf('shelf-upper', 24.3125, 16.625),
      shelf('shelf-middle', 20.3125, 15.6875),
      shelf('shelf-lower', 15.0625, 15.6875),
      { withPart: 'case-back', face: 'near', u0: 0, u1: 25.0625, v0: 16, v1: 16.25, depth: 0.375 },
    ]);
    const notch = (end: 0 | 1) => ({ end, edge: 'reference', along: 0.1875, across: 0.5 });
    expect(part('shelf-lower').notches).toEqual([notch(0), notch(1)]);
    expect(part('shelf-upper').stock.width).toBe(16.625);
    expect(part('shelf-lower').stock.width).toBe(15.6875);
  });

  it('houses the divider in the middle and upper shelves, centered in the case', () => {
    // Centered at x = 30-15/16, so x 30-9/16 to 31-5/16: u 22 to 22-3/4 along shelves from
    // x = 8-9/16.
    const dado = (face: 'near' | 'far') => ({
      withPart: 'divider',
      face,
      u0: 22,
      u1: 22.75,
      v0: 0.5,
      v1: 15.6875,
      depth: 0.1875,
    });
    expect(part('shelf-middle').dadoes).toEqual([dado('far')]);
    expect(part('shelf-upper').dadoes[0]).toEqual(dado('near'));
  });

  it('floats the back in its grooves, 1/8 short at each edge and 1/32 at each end', () => {
    // Across: from x = 8-3/4 − 3/8 to 53-1/8 + 3/8, 45-1/8, less 2 × 1/8: 44-7/8.
    expect(part('case-back').stock.width).toBe(44.875);
    expect(placement('case-back', 0).origin).toEqual({ x: 8.5, y: 15.75, z: 6.40625 });
    expect(part('case-back').rabbets).toHaveLength(8);
  });

  it('sizes each drawer box from its opening and the slides', () => {
    // Upper: 3-1/4 − 2 × 1/4 = 2-3/4 tall, from z = 27-5/8 + 1/4; the back stands on the
    // bottom's groove, 1/4 + 1/4 up, so 2-1/4 tall. Lower: 4 tall, back 3-1/2.
    expect(part('upper-drawer-box-front').stock).toMatchObject({ width: 2.75, thickness: 0.5 });
    expect(part('upper-drawer-box-back').stock.width).toBe(2.25);
    expect(part('lower-drawer-box-back').stock.width).toBe(3.5);
    expect(placement('upper-drawer-side-left', 0).origin).toEqual({
      x: 9.25,
      y: 0.8125,
      z: 27.875,
    });
    // The right-hand upper drawer, past the divider at 31-5/16: its box from 31-13/16.
    expect(placement('upper-drawer-side-left', 1).origin).toEqual({
      x: 31.8125,
      y: 0.8125,
      z: 27.875,
    });
  });

  it('dovetails each box, tails on the sides, the back corners across the back alone', () => {
    // 2-3/4 wide: (2-3/4 − 3/4 + 1/4) / 2 = 1-1/8 on center, so 2 tails. The back's 2-1/4:
    // 1-3/4 / 1 is under 2, so 1 tail, across the side from 1/2 up.
    const layout = (tails: number) => ({ tails, slope: 8, halfPin: 0.375, pin: 0.25 });
    expect(part('upper-drawer-side-left').dovetails).toEqual([
      { board: 'tails', withPart: 'upper-drawer-box-front', end: 0, baseline: 0.5, ...layout(2) },
      {
        board: 'tails',
        withPart: 'upper-drawer-box-back',
        end: 1,
        baseline: 0.5,
        ...layout(1),
        span: { v0: 0.5, v1: 2.75 },
      },
    ]);
    expect(part('upper-drawer-box-back').dovetails.map((d) => d.board)).toEqual(['pins', 'pins']);
  });

  it('floats each bottom in the box front and sides, its top flush with their grooves', () => {
    // Across: from the front groove's bottom at y = 1-5/16 − 1/4, 1/8 short, to the back's
    // outside face at 14-13/16: 13-5/8. Its top at the groove's upper wall, 1/2 up: z = 28-3/8.
    expect(part('upper-drawer-bottom').stock).toMatchObject({ width: 13.625, thickness: 0.5 });
    expect(placement('upper-drawer-bottom', 0).origin).toEqual({
      x: 9.53125,
      y: 1.1875,
      z: 27.875,
    });
    expect(part('upper-drawer-bottom').rabbets.map((r) => [r.edge, r.face])).toEqual([
      ['reference', 'near'],
      ['first-end', 'near'],
      ['second-end', 'near'],
    ]);
  });

  it('insets each front 1/16 inside its opening, at its board’s 13/16', () => {
    expect(part('upper-drawer-front').stock).toMatchObject({ width: 3.125, thickness: 0.8125 });
    expect(placement('upper-drawer-front', 0).origin).toEqual({ x: 8.8125, y: 0.8125, z: 27.6875 });
  });

  it('makes each door a frame around a floating panel, the right one the left turned over', () => {
    expect(placement('door-stile-hinge', 0).origin).toEqual({ x: 8.8125, y: 0, z: 6.8125 });
    expect(placement('door-stile-hinge', 1).origin).toEqual({ x: 53.0625, y: 0, z: 21.5625 });
    // Grooves 1/4 wide, centered in the 13/16 frame: (13/16 − 1/4) / 2 = 9/32 from each face.
    expect(part('door-rail').grooves).toEqual([
      { edge: 'far', u0: 0, u1: 18.84375, n0: 0.28125, width: 0.25, depth: 0.375 },
    ]);
    expect(part('door-rail').tenons.map((t) => [t.end, t.length, t.thickness, t.width])).toEqual([
      [0, 0.375, 0.25, 2],
      [1, 0.375, 0.25, 2],
    ]);
    // Across, 22-3/32 − 4 + 3/4 less 2 × 1/8: 18-19/32, 3/4 thick, 1/32 in from each face.
    expect(part('door-panel').stock).toMatchObject({ width: 18.59375, thickness: 0.75 });
    expect(placement('door-panel', 0).origin).toEqual({ x: 10.5625, y: 0.03125, z: 8.46875 });
  });

  it('bores two hinge cups in each hinge stile, and screws their plates to the case side', () => {
    // Cups 3 from each end, their rims 3/16 in from the stile's outer edge: centers 3/16 + 35
    // mm / 2 in. Plates 5/8 behind the door's back face, y = 13/16 + 5/8 = 1-7/16, their two
    // screws 1-1/4 apart about the cup's height: z = 6-13/16 + 3 = 9-13/16, u 3-1/4 up the side.
    const cups = part('door-stile-hinge').boredHoles;
    expect(cups.map((c) => c.entry.u)).toEqual([3, 11.75]);
    expect(cups[0]?.entry.v).toBeCloseTo(0.1875 + 35 / 25.4 / 2, 12);
    expect(part('case-side-left').hingePlates[0]?.screws).toEqual([
      { u: 2.625, v: 1.4375 },
      { u: 3.875, v: 1.4375 },
    ]);
    expect(example.hardware.map((h) => [h.id, h.quantity])).toEqual([
      ['hinge', 4],
      ['face-vise', 1],
      ['end-vise', 1],
    ]);
  });

  it('bores the face vise through its chop and the front-left leg, the guide below the screw', () => {
    // The screw 4 below the top's underside, z = 27-5/8, clear of the end rail's mortise, which
    // starts at 28-7/8; the guide bar 5 below it, z = 22-5/8. The leg starts at z = 1-1/4, and
    // the chop's v runs down from the top's surface at 34-1/8.
    expect(part('leg-vise').boredHoles.map((h) => [h.use, h.entry.u, h.entry.v, h.depth])).toEqual([
      ['for the screw', 26.375, 1.5, 3],
      ['for a guide bar', 21.375, 1.5, 3],
    ]);
    expect(part('face-chop').boredHoles.map((h) => [h.entry.u, h.entry.v])).toEqual([
      [6.5, 6.5],
      [6.5, 11.5],
    ]);
    expect(placement('face-chop', 0).origin).toEqual({ x: 0, y: -2.5, z: 34.125 });
  });

  it('runs the end vise’s screw and guide bars through the chop and the block under the top', () => {
    // The block 3-1/2 under the top, z 28-1/8 to 31-5/8; the screw centered on the top's depth,
    // 8-13/16, and 1-3/4 up; the guide bars 4 either side.
    const along = (id: string) => part(id).boredHoles.filter((h) => h.use !== 'for a dog');
    expect(along('end-chop').map((h) => [h.entry.u, h.entry.v])).toEqual([
      [8.8125, 1.75],
      [12.8125, 1.75],
      [4.8125, 1.75],
    ]);
    expect(along('vise-block').map((h) => [h.entry.v, h.entry.n, h.depth])).toEqual([
      [8.8125, 1.75, 5],
      [12.8125, 1.75, 5],
      [4.8125, 1.75, 5],
    ]);
  });

  it('bores dog holes every 4 back from the end chop’s, through only where nothing is under', () => {
    // The chop's dog at x = 61-7/8 + 1-1/4 = 63-1/8, so the top's at 59-1/8, 55-1/8, ... 3-1/8.
    // 55-1/8 and 7-1/8 would cut into the front legs' mortises, so they are left out. Over the
    // block and the case the holes stop 1/4 short; past the front-left leg, at 3-1/8, they go
    // through.
    const dogs = part('top').boredHoles;
    expect(dogs.map((h) => h.entry.u)).toEqual([
      59.125, 51.125, 47.125, 43.125, 39.125, 35.125, 31.125, 27.125, 23.125, 19.125, 15.125,
      11.125, 3.125,
    ]);
    expect(dogs.filter((h) => h.through).map((h) => h.entry.u)).toEqual([3.125]);
    expect(dogs[0]?.depth).toBe(2.25);
    expect(part('end-chop').boredHoles.at(-1)?.entry).toEqual({ u: 2, v: 6, n: 1.25 });
  });

  it('stops a dog hole that reaches over the front-left leg', () => {
    // A 63-1/2 top puts the chop's dog at 64-3/4 and one of the top's at 64-3/4 − 15 × 4 =
    // 4-3/4, which reaches 5-1/8, past the leg's outer face at 5: stopped, not through.
    const longer = base({ ...EXAMPLE, topLength: 63.5 });
    if (!longer.ok) throw new Error(longer.message);
    const near = part('top', longer.base).boredHoles.find((h) => h.entry.u === 4.75);
    expect(near).toMatchObject({ through: false, depth: 2.25 });
  });

  it('passes the fit checks', () => {
    expect(fitProblems(example, hardwareList(example.hardware))).toEqual([]);
  });

  it('passes the fit checks with the back mortises left long for the top’s movement', () => {
    expect(fitProblems(made(0.125), hardwareList(made(0.125).hardware))).toEqual([]);
  });

  it('refuses a top whose strips are wider than the board', () => {
    // A 6-1/2 top stands its strips on edge, ripped 6-9/16 wide from a 5-1/2 board.
    expect(base({ ...EXAMPLE, topThickness: 6.5, height: 38 })).toMatchObject({ ok: false });
  });
});
