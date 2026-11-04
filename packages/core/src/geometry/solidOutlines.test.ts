import { describe, expect, it } from 'vitest';
import type { BoredHole, Mortise, Part, Placement } from '../model/types.ts';
import { isometric, project } from './projection.ts';
import { solid } from './solid.ts';
import { cross, dot, sub, type Vec3 } from './vec.ts';
import { isometricView } from './views.ts';

// Bored holes and through mortises outlined on a made-up part, hand-checked in inches. A 1x4
// (3/4" × 3-1/2"), 12" long, placed with its frame on the template's axes: u along x, v along y,
// n along z, so a point (u, v, n) is at (x, y, z). The near face is at z = 0, the far face at
// z = 3/4, the reference edge at y = 0, the far edge at y = 3-1/2.

const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };
const board = (extra: Partial<Part>): Part => ({
  id: 'board',
  letter: 'A',
  name: 'Board',
  role: 'board',
  stock: { nominal: '1x4', thickness: 0.75, width: 3.5, buyableFeet: [8] },
  quantity: 1,
  length: 12,
  markLengths: [],
  ends: [square, square],
  endsParallel: true,
  referenceEdge: 'bottom edge',
  notes: [],
  selection: [],
  holes: [],
  boltAreas: [],
  tapers: [],
  dadoes: [],
  notches: [],
  cutouts: [],
  mortises: [],
  tenons: [],
  dovetails: [],
  screwHoles: [],
  grooves: [],
  rabbets: [],
  recesses: [],
  boredHoles: [],
  hingePlates: [],
  ...extra,
});
const at = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const placed: Placement = {
  partId: 'board',
  instance: 0,
  origin: at(0, 0, 0),
  along: at(1, 0, 0),
  across: at(0, 1, 0),
  through: at(0, 0, 1),
};
const decals = (part: Part) => solid(part, placed).faces.filter((f) => f.decal);
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const same = (a: Vec3 | undefined, b: Vec3) =>
  a !== undefined && close(a.x, b.x) && close(a.y, b.y) && close(a.z, b.z);
/** Counterclockwise seen from outside: the turn of its first three points is along its normal. */
const outward = (f: { points: Vec3[]; normal: Vec3 }) => {
  const [p0, p1, p2] = f.points as [Vec3, Vec3, Vec3];
  return dot(cross(sub(p1, p0), sub(p2, p0)), f.normal) > 0;
};

// A 3/4" hole 6" from the first end and 1-3/4" across (centered), bored from the far face.
const hole = (extra: Partial<BoredHole>): BoredHole => ({
  use: 'for a peg',
  diameter: 0.75,
  entry: { u: 6, v: 1.75, n: 0.75 },
  direction: { u: 0, v: 0, n: -1 },
  depth: 0.75,
  through: true,
  ...extra,
});

describe('bored holes in 3D', () => {
  it('outlines a through hole on the face it enters and the face it comes out of', () => {
    const [entry, exit, ...rest] = decals(board({ boredHoles: [hole({})] }));
    expect(rest).toHaveLength(0);
    // Entered at the far face, z = 3/4, facing +z; out at the near face, z = 0, facing −z.
    expect(same(entry?.normal, at(0, 0, 1))).toBe(true);
    expect(same(exit?.normal, at(0, 0, -1))).toBe(true);
    for (const [face, z] of [
      [entry, 0.75],
      [exit, 0],
    ] as const) {
      expect(face?.points).toHaveLength(24);
      for (const p of face?.points ?? []) {
        expect(close(p.z, z)).toBe(true);
        // Every corner 3/8" (the radius) from the center at (6, 1-3/4).
        expect(close(Math.hypot(p.x - 6, p.y - 1.75), 0.375)).toBe(true);
      }
      expect(face && outward(face)).toBe(true);
    }
  });

  it('outlines a stopped hole only where it enters', () => {
    const [entry, ...rest] = decals(board({ boredHoles: [hole({ depth: 0.5, through: false })] }));
    expect(rest).toHaveLength(0);
    expect(same(entry?.normal, at(0, 0, 1))).toBe(true);
    expect(entry?.points.every((p) => close(p.z, 0.75))).toBe(true);
  });

  it('outlines a hole bored into an edge on that edge', () => {
    // A 1/2" hole into the reference edge (y = 0), 3/8" from the near face (centered), 1" deep.
    const edgeHole = hole({
      diameter: 0.5,
      entry: { u: 6, v: 0, n: 0.375 },
      direction: { u: 0, v: 1, n: 0 },
      depth: 1,
      through: false,
    });
    const [entry, ...rest] = decals(board({ boredHoles: [edgeHole] }));
    expect(rest).toHaveLength(0);
    expect(same(entry?.normal, at(0, -1, 0))).toBe(true);
    for (const p of entry?.points ?? []) {
      expect(close(p.y, 0)).toBe(true);
      expect(close(Math.hypot(p.x - 6, p.z - 0.375), 0.25)).toBe(true);
    }
    expect(entry && outward(entry)).toBe(true);
  });

  it('paints the outline where a hole comes out over the face it comes out of', () => {
    const view = isometric(1, 1);
    const drawing = isometricView(
      {
        parts: [
          board({
            boredHoles: [hole({ entry: { u: 6, v: 1.75, n: 0 }, direction: { u: 0, v: 0, n: 1 } })],
          }),
        ],
        placements: [placed],
      },
      view,
      'A board with a hole through it.',
    );
    // Bored from the near face, it comes out of the far face (z = 3/4), the face the view sees.
    const polygons = drawing.primitives.filter((p) => p.kind === 'polygon');
    const ring = polygons.findIndex((p) => p.points.length === 24);
    const faceCorner = project(view, at(12, 3.5, 0.75));
    const top = polygons.findIndex((p) =>
      p.points.some((q) => Math.hypot(q.x - faceCorner.x, q.y - faceCorner.y) < 1e-9),
    );
    expect(ring).toBeGreaterThan(-1);
    expect(top).toBeGreaterThan(-1);
    expect(ring).toBeGreaterThan(top);
  });
});

describe('mortises through their part in 3D', () => {
  // A mortise 2" to 4-1/2" along and 1-1/2" to 2" across (or through, on an edge).
  const mortise = (side: Mortise['side'], depth: number): Mortise => ({
    withPart: 'rail',
    side,
    u0: 2,
    u1: 4.5,
    a0: side.endsWith('edge') ? 0.125 : 1.5,
    a1: side.endsWith('edge') ? 0.625 : 2,
    depth,
  });
  const corners = (points: readonly Vec3[]) =>
    points
      .map((p): [number, number, number] => [p.x, p.y, p.z])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);

  it('outlines a face mortise as deep as the part on the other face too', () => {
    const [entry, exit, ...rest] = decals(board({ mortises: [mortise('near', 0.75)] }));
    expect(rest).toHaveLength(0);
    expect(same(entry?.normal, at(0, 0, -1))).toBe(true);
    expect(same(exit?.normal, at(0, 0, 1))).toBe(true);
    expect(corners(entry?.points ?? [])).toEqual([
      [2, 1.5, 0],
      [2, 2, 0],
      [4.5, 1.5, 0],
      [4.5, 2, 0],
    ]);
    expect(corners(exit?.points ?? [])).toEqual([
      [2, 1.5, 0.75],
      [2, 2, 0.75],
      [4.5, 1.5, 0.75],
      [4.5, 2, 0.75],
    ]);
    expect(entry && outward(entry)).toBe(true);
    expect(exit && outward(exit)).toBe(true);
  });

  it('outlines an edge mortise as deep as the width on the other edge too', () => {
    const [entry, exit, ...rest] = decals(board({ mortises: [mortise('far-edge', 3.5)] }));
    expect(rest).toHaveLength(0);
    expect(same(entry?.normal, at(0, 1, 0))).toBe(true);
    expect(same(exit?.normal, at(0, -1, 0))).toBe(true);
    expect(corners(exit?.points ?? [])).toEqual([
      [2, 0, 0.125],
      [2, 0, 0.625],
      [4.5, 0, 0.125],
      [4.5, 0, 0.625],
    ]);
    expect(exit && outward(exit)).toBe(true);
  });

  it('outlines a mortise shallower than its part only where it enters', () => {
    expect(decals(board({ mortises: [mortise('near', 0.5)] }))).toHaveLength(1);
    expect(decals(board({ mortises: [mortise('reference-edge', 3)] }))).toHaveLength(1);
  });
});
