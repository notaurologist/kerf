import type { EdgeGroove, Part, Placement, Vec3 } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import type { PlacedPart } from './boltedLap.ts';
import { housingPlane } from './housedEnd.ts';
import { floatingPanel, mortiseAndTenon, slottedScrews, tenonInGroove } from './joinery.ts';
import { type Member, type Plane, trim } from './trim.ts';

// Hand-checked on small made-up parts, in inches.

const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };
const part = (
  id: string,
  length: number,
  width: number,
  thickness: number,
  over: Partial<Part> = {},
): Part => ({
  id,
  letter: 'A',
  name: id,
  role: id,
  stock: { nominal: id, thickness, width, buyableFeet: [8] },
  quantity: 1,
  length,
  markLengths: [],
  ends: [square, square],
  endsParallel: true,
  notes: [],
  selection: [],
  referenceEdge: 'edge',
  holes: [],
  boltAreas: [],
  tapers: [],
  dadoes: [],
  notches: [],
  cutouts: [],
  mortises: [],
  tenons: [],
  screwHoles: [],
  grooves: [],
  rabbets: [],
  recesses: [],
  ...over,
});
const at = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const X = at(1, 0, 0);
const Y = at(0, 1, 0);
const Z = at(0, 0, 1);
const minus = (v: Vec3) => at(-v.x, -v.y, -v.z);
const placed = (p: Part, origin: Vec3, along: Vec3, across: Vec3, through: Vec3): PlacedPart => ({
  part: p,
  placement: { partId: p.id, instance: 0, origin, along, across, through },
});
/** A part trimmed to two planes, placed where the trim puts it. */
function cut(id: string, member: Member, planes: [Plane, Plane], thickness: number): PlacedPart {
  const made = trim(member, planes);
  if (!made.ok) throw new Error(made.message);
  const placement: Placement = { partId: id, instance: 0, ...member, origin: made.origin };
  return { part: part(id, made.length, member.width, thickness), placement };
}
const planeX = (x: number): Plane => ({ point: at(x, 0, 0), normal: X });

describe('mortiseAndTenon', () => {
  // A 1-1/2" square post along z, its reference edge's face at x = 0. A 3/4" by 3" rail along x
  // from x = −20, its bottom edge at z = 4, centered in the post: y from 0.375 to 1.125.
  const post = placed(part('post', 10, 1.5, 1.5), at(0, 0, 0), Z, X, Y);
  const rail = cut(
    'rail',
    { along: X, across: Z, through: minus(Y), referenceEdge: at(0, 1.125, 4), width: 3 },
    [planeX(-20), housingPlane(post, 'reference-edge', 1)],
    0.75,
  );
  const tenon = { v0: 0.5, width: 2, n0: 0.25, thickness: 0.25 };

  it('lengthens the rail by the tenon: from x = −20 to 1, 21', () => {
    expect(rail.part.length).toBe(21);
  });

  it('cuts the mortise where the tenon enters the post', () => {
    // Up the post from 4 + 0.5 to 6.5; across it, y = 1.125 − n: from 0.625 to 0.875.
    expect(mortiseAndTenon({ mortised: post, tenoned: rail, end: 1, depth: 1, tenon })).toEqual({
      ok: true,
      mortise: {
        withPart: 'rail',
        side: 'reference-edge',
        u0: 4.5,
        u1: 6.5,
        a0: 0.625,
        a1: 0.875,
        depth: 1,
      },
      tenon: { end: 1, length: 1, ...tenon },
    });
  });

  it('refuses a tenon that stops short of the mortise bottom', () => {
    expect(
      mortiseAndTenon({ mortised: post, tenoned: rail, end: 1, depth: 1.25, tenon }),
    ).toMatchObject({
      ok: false,
    });
  });
});

describe('tenonInGroove', () => {
  // A 2" by 3/4" stile along z, its far edge at x = 2 grooved 3/8 deep, 1/4 wide from 1/4 in. A
  // rail along x, thickness toward −y from y = 0.75, its first end in the groove.
  const groove: EdgeGroove = { edge: 'far', u0: 0, u1: 10, n0: 0.25, width: 0.25, depth: 0.375 };
  const stile = placed(part('stile', 10, 2, 0.75, { grooves: [groove] }), at(0, 0, 0), Z, X, Y);
  const rail = cut(
    'rail',
    { along: X, across: Z, through: minus(Y), referenceEdge: at(0, 0.75, 3), width: 2 },
    [housingPlane(stile, 'far-edge', 0.375), planeX(10)],
    0.75,
  );

  it('runs the rail into the groove: from x = 1.625, 8.375 long', () => {
    expect(rail.part.length).toBe(8.375);
  });

  it('makes the tenon as thick as the groove is wide, where it is: n from 0.75 − 0.5 to 0.75 − 0.25', () => {
    expect(tenonInGroove({ grooved: stile, tenoned: rail, end: 0, v: [0, 2] })).toEqual({
      ok: true,
      tenon: { end: 0, length: 0.375, n0: 0.25, thickness: 0.25, v0: 0, width: 2 },
    });
  });

  it('refuses a part with no groove there', () => {
    const plain = { ...stile, part: { ...stile.part, grooves: [] } };
    expect(tenonInGroove({ grooved: plain, tenoned: rail, end: 0, v: [0, 2] })).toMatchObject({
      ok: false,
    });
  });
});

describe('floatingPanel', () => {
  // A frame of 2" by 3/4" parts around an 8" by 10" opening: stiles x 0 to 2 and 10 to 12, rails
  // z 0 to 2 and 12 to 14, each with its far edge toward the panel. Grooves 1/4 wide and 3/8 deep
  // put the bottoms at x = 1.625 and 10.375, z = 1.625 and 12.375. A 1/2" panel with 1/32 at each
  // end and 0.1 at each edge: 10.75 − 1/16 = 10.6875 long, 8.75 − 0.2 = 8.55 wide, from
  // (1.725, 0.375 − 0.25, 1.65625).
  const frame = [
    { ...placed(part('left', 14, 2, 0.75), at(0, 0, 0), Z, X, Y), edge: 'far' as const },
    {
      ...placed(part('right', 14, 2, 0.75), at(12, 0.75, 0), Z, minus(X), minus(Y)),
      edge: 'far' as const,
    },
    {
      ...placed(part('bottom', 12, 2, 0.75), at(0, 0.75, 0), X, Z, minus(Y)),
      edge: 'far' as const,
    },
    { ...placed(part('top', 12, 2, 0.75), at(0, 0, 14), X, minus(Z), Y), edge: 'far' as const },
  ];
  const joint = (width: number) => ({
    frame,
    groove: { width: 0.25, depth: 0.375 },
    panel: { part: part('panel', 0, width, 0.5), along: Z, across: X, through: Y },
    gaps: { ends: 1 / 32, edges: 0.1 },
  });

  it('places the panel between the grooves less its gaps, centered in them', () => {
    const made = floatingPanel(joint(8.55));
    if (!made.ok) throw new Error(made.message);
    expect(made.length).toBeCloseTo(10.6875, 12);
    expect(made.origin.x).toBeCloseTo(1.725, 12);
    expect(made.origin.y).toBe(0.125);
    expect(made.origin.z).toBeCloseTo(1.65625, 12);
  });

  it('grooves each frame part along its edge, centered, and rabbets the panel to a 1/4 tongue', () => {
    const made = floatingPanel(joint(8.55));
    if (!made.ok) throw new Error(made.message);
    expect(made.grooves[0]).toEqual({
      partId: 'left',
      groove: { edge: 'far', u0: 0, u1: 14, n0: 0.25, width: 0.25, depth: 0.375 },
    });
    expect(made.rabbets).toHaveLength(8);
    expect(made.rabbets[0]).toEqual({
      edge: 'reference',
      face: 'near',
      width: 0.375,
      depth: 0.125,
    });
  });

  it('refuses a panel that is not the width between the grooves less its gaps', () => {
    expect(floatingPanel(joint(8.75))).toMatchObject({ ok: false });
  });
});

describe('slottedScrews', () => {
  // A case bottom 30 long and 15 deep, along x and across y, 3/4 thick up from z = 0. A 13" cleat
  // under it along y from y = 1, its top face at z = 0: screws at 1, 6.5, and 12 along it are 2, 7.5,
  // and 13 back from the bottom's front edge.
  const bottom = placed(part('bottom', 30, 15, 0.75), at(0, 0, 0), X, Y, Z);
  const cleat = (z = 0) => placed(part('cleat', 13, 1, 0.75), at(5, 1, z), Y, X, minus(Z));
  const joint = (heldAt: 'reference-edge' | 'far-edge', z = 0) => ({
    hardwareId: 'screws',
    through: cleat(z),
    at: [1, 6.5, 12].map((u) => ({ u, v: 0.5 })),
    into: bottom,
    heldAt,
    slot: 0.25,
  });

  it('puts the screw nearest the held edge in a round hole and slots the rest the way it moves', () => {
    const made = slottedScrews(joint('reference-edge'));
    expect(made.ok && made.holes.map((h) => [h.slot, h.direction])).toEqual([
      [0, 'along'],
      [0.25, 'along'],
      [0.25, 'along'],
    ]);
    const back = slottedScrews(joint('far-edge'));
    expect(back.ok && back.holes.map((h) => h.slot)).toEqual([0.25, 0.25, 0]);
  });

  it('refuses parts that do not lie face to face', () => {
    expect(slottedScrews(joint('reference-edge', -0.1))).toMatchObject({ ok: false });
  });
});
