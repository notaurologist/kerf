import type { EdgeGroove, Part, Placement, Vec3 } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import type { PlacedPart } from './boltedLap.ts';
import { housingPlane } from './housedEnd.ts';
import {
  floatingPanel,
  mortiseAndTenon,
  panelInFaces,
  slottedScrews,
  tenonInGroove,
  throughTenon,
} from './joinery.ts';
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
  boredHoles: [],
  hingePlates: [],
  dovetails: [],
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

describe('throughTenon', () => {
  // A top 10" long along x, 6" wide along y, 2-1/2" thick from z = 0 up. A 3" square leg along z
  // from z = −28, x from 2 to 5 and y from 1 to 4, trimmed flush with the top's upper face. Its
  // tenon is 1" across x (3 to 4) and 1-1/2" through y (1.75 to 3.25).
  const top = placed(part('top', 10, 6, 2.5), at(0, 0, 0), X, Y, Z);
  const planeZ = (z: number): Plane => ({ point: at(0, 0, z), normal: Z });
  const leg = (to: Plane) =>
    cut(
      'leg',
      { along: Z, across: X, through: Y, referenceEdge: at(2, 1, 0), width: 3 },
      [planeZ(-28), to],
      3,
    );
  const flush = leg(housingPlane(top, 'near', 2.5));
  const tenon = { v0: 1, width: 1, n0: 0.75, thickness: 1.5 };
  const mortise = { withPart: 'leg', side: 'near', u0: 3, u1: 4, a0: 1.75, a1: 3.25, depth: 2.5 };

  it('lengthens the leg through the top: from z = −28 to 2.5, 30-1/2', () => {
    expect(flush.part.length).toBe(30.5);
  });

  it('cuts a mortise as deep as the top is thick, where the tenon enters its underside', () => {
    expect(throughTenon({ mortised: top, tenoned: flush, end: 1, tenon })).toEqual({
      ok: true,
      mortise,
      tenon: { end: 1, length: 2.5, ...tenon },
    });
  });

  it('lengthens the mortise toward the side the top moves: 1/4 toward +y, a1 = 3.5', () => {
    const made = throughTenon({
      mortised: top,
      tenoned: flush,
      end: 1,
      tenon,
      lengthen: { toward: Y, by: 0.25 },
    });
    expect(made).toEqual({
      ok: true,
      mortise: { ...mortise, a1: 3.5, room: { at: 'a1', length: 0.25 } },
      tenon: { end: 1, length: 2.5, ...tenon },
    });
  });

  it('lengthens along the top the other way: 1/2 toward −x, u0 = 2.5', () => {
    const made = throughTenon({
      mortised: top,
      tenoned: flush,
      end: 1,
      tenon,
      lengthen: { toward: minus(X), by: 0.5 },
    });
    expect(made).toMatchObject({
      ok: true,
      mortise: { ...mortise, u0: 2.5, room: { at: 'u0', length: 0.5 } },
    });
  });

  it('refuses a leg that stops inside the top', () => {
    const short = leg(housingPlane(top, 'near', 2));
    expect(throughTenon({ mortised: top, tenoned: short, end: 1, tenon })).toMatchObject({
      ok: false,
    });
  });

  it('refuses a mortise lengthened past the top, or at an angle to it', () => {
    const past = { mortised: top, tenoned: flush, end: 1 as const, tenon };
    // 1.75 − 2 = −0.25, past the top's front edge.
    expect(throughTenon({ ...past, lengthen: { toward: minus(Y), by: 2 } })).toMatchObject({
      ok: false,
    });
    expect(throughTenon({ ...past, lengthen: { toward: Z, by: 0.25 } })).toMatchObject({
      ok: false,
    });
    expect(throughTenon({ ...past, lengthen: { toward: Y, by: 0 } })).toMatchObject({ ok: false });
  });
});

describe('panelInFaces', () => {
  // A box 10" wide, 3/4" boards: a bottom (z 0 to 3/4) and a top (z 8 to 8-3/4), each 10 long
  // along x and 4 wide along y, and sides between them standing on the bottom, inner faces at
  // x = 3/4 and 9-1/4. A 1/2" panel stands in the plane y = 3, its grain up, in grooves 1/4 wide
  // and 3/8 deep cut into each part's inner face, 1/32 short at each end and 1/16 at each edge.
  const board = (id: string, length: number) => part(id, length, 4, 0.75);
  const frame = [
    { ...placed(board('bottom', 10), at(0, 0, 0), X, Y, Z), face: 'far' as const },
    { ...placed(board('top', 10), at(0, 0, 8), X, Y, Z), face: 'near' as const },
    { ...placed(board('left', 7.25), at(0.75, 0, 0.75), Z, Y, minus(X)), face: 'near' as const },
    { ...placed(board('right', 7.25), at(9.25, 0, 8), minus(Z), Y, X), face: 'near' as const },
  ];
  const joint = {
    frame,
    groove: { width: 0.25, depth: 0.375 },
    panel: { id: 'panel', thickness: 0.5, along: Z, across: X, through: Y },
    middle: 3,
    gaps: { ends: 1 / 32, edges: 1 / 16 },
  };

  it('sizes the panel between the grooves’ bottoms, less its gaps', () => {
    // Up: from z = 3/4 − 3/8 to 8 + 3/8, 8 long, less 2 × 1/32: 7-15/16. Across: from x = 3/8 to
    // 9-5/8, 9-1/4, less 2 × 1/16: 9-1/8. Its near face at y = 3 − 1/4.
    expect(panelInFaces(joint)).toMatchObject({
      ok: true,
      length: 7.9375,
      width: 9.125,
      origin: { x: 0.4375, y: 2.75, z: 0.40625 },
    });
  });

  it('grooves each part end to end, centered on the panel: y 2-7/8 to 3-1/8', () => {
    const made = panelInFaces(joint);
    if (!made.ok) throw new Error(made.message);
    const groove = (face: 'near' | 'far', u1: number) => ({
      withPart: 'panel',
      face,
      u0: 0,
      u1,
      v0: 2.875,
      v1: 3.125,
      depth: 0.375,
    });
    expect(made.dadoes).toEqual([
      { partId: 'bottom', dado: groove('far', 10) },
      { partId: 'top', dado: groove('near', 10) },
      { partId: 'left', dado: groove('near', 7.25) },
      { partId: 'right', dado: groove('near', 7.25) },
    ]);
  });

  it('measures each groove from its part’s own reference edge', () => {
    // The right side turned to run across −y from its back edge at y = 4: the panel's middle is
    // 4 − 3 = 1 from it, so its groove is v 7/8 to 1-1/8.
    const turned = {
      ...placed(board('right', 7.25), at(9.25, 4, 0.75), Z, minus(Y), X),
      face: 'near' as const,
    };
    const made = panelInFaces({ ...joint, frame: [...frame.slice(0, 3), turned] });
    if (!made.ok) throw new Error(made.message);
    expect(made.dadoes[3]?.dado).toMatchObject({ v0: 0.875, v1: 1.125 });
    expect(made.width).toBe(9.125);
  });

  it('rabbets every edge on both faces to a 1/4 tongue, 3/8 long', () => {
    const made = panelInFaces(joint);
    if (!made.ok) throw new Error(made.message);
    expect(made.rabbets).toHaveLength(8);
    for (const r of made.rabbets) expect(r).toMatchObject({ width: 0.375, depth: 0.125 });
  });

  it('runs a panel open on one side to where it is told, with no gap or tongue there', () => {
    // No top: the panel runs up from the bottom's groove to z = 9, past where the top was. From
    // 3/8 + 1/32 up to 9: 8-19/32 long. Rabbeted on its two edges and its bottom end only.
    const made = panelInFaces({
      ...joint,
      frame: [frame[0], frame[2], frame[3]] as typeof frame,
      open: 9,
    });
    if (!made.ok) throw new Error(made.message);
    expect(made.length).toBe(8.59375);
    expect(made.width).toBe(9.125);
    expect(made.origin).toEqual({ x: 0.4375, y: 2.75, z: 0.40625 });
    expect(new Set(made.rabbets.map((r) => r.edge))).toEqual(
      new Set(['reference', 'far', 'first-end']),
    );
  });

  it('refuses a panel no thicker than its grooves, or held on three sides', () => {
    expect(panelInFaces({ ...joint, panel: { ...joint.panel, thickness: 0.25 } })).toMatchObject({
      ok: false,
    });
    expect(panelInFaces({ ...joint, frame: frame.slice(0, 3) })).toMatchObject({ ok: false });
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
