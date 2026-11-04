import { describe, expect, it } from 'vitest';
import { stock } from '../lumber/stock.ts';
import type { Part, Placement } from '../model/types.ts';
import { formatLength } from '../units/length.ts';
import { convexPieces, isConvex } from './convex.ts';
import { cutDetail } from './cutDetail.ts';
import { partOutline, type UV } from './outline.ts';
import type { Point2 } from './primitives.ts';
import { isometric, project } from './projection.ts';
import { solid } from './solid.ts';
import { isometricView } from './views.ts';

// Notches, cutouts, and dadoes in drawings, on made-up parts. A 2x6 (5-1/2" wide) 20" long, with
// square ends: a cutout at the first end from v = 1.5 to 4, 1" deep, and a notch at the second
// end's far corner, 3/16" along by 1/2" across.

const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };
const side = (over: Partial<Part> = {}): Part => ({
  id: 'side',
  letter: 'A',
  name: 'Side',
  role: 'side',
  stock: stock('2x6'),
  quantity: 1,
  length: 20,
  markLengths: [],
  ends: [square, square],
  endsParallel: true,
  notes: [],
  selection: [],
  referenceEdge: 'back edge',
  holes: [],
  boltAreas: [],
  tapers: [],
  dadoes: [],
  notches: [{ end: 1, edge: 'far', along: 0.1875, across: 0.5 }],
  cutouts: [{ end: 0, v0: 1.5, v1: 4, depth: 1 }],
  mortises: [],
  tenons: [],
  dovetails: [],
  screwHoles: [],
  grooves: [],
  rabbets: [],
  recesses: [],
  ...over,
});

const area = (points: readonly UV[]) =>
  points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length] as UV;
    return sum + (p.u * q.v - q.u * p.v) / 2;
  }, 0);

describe('outlines with notches and cutouts', () => {
  const outline = partOutline(side());

  it('walks counterclockwise into each notch and cutout at a square end', () => {
    expect(outline).toEqual([
      { u: 0, v: 0 },
      // Second end, from the reference edge to the notch at the far corner.
      { u: 20, v: 0 },
      { u: 20, v: 5 },
      { u: 19.8125, v: 5 },
      { u: 19.8125, v: 5.5 },
      // First end, from the far edge back, around the cutout.
      { u: 0, v: 5.5 },
      { u: 0, v: 4 },
      { u: 1, v: 4 },
      { u: 1, v: 1.5 },
      { u: 0, v: 1.5 },
    ]);
    // 20 · 5.5 − 0.1875 · 0.5 − 1 · 2.5 = 110 − 0.09375 − 2.5.
    expect(area(outline)).toBeCloseTo(107.40625, 12);
  });

  it('refuses a notch on an angled end', () => {
    const angled = side({ ends: [square, { ...square, setting: 10 }], endsParallel: false });
    expect(() => partOutline(angled)).toThrow(/side has a notch or cutout on an angled end/);
  });

  it('splits a concave face into convex pieces covering it, and marks only its own edges', () => {
    const pieces = convexPieces(outline);
    expect(pieces.length).toBeGreaterThan(1);
    for (const piece of pieces) expect(isConvex(piece.points)).toBe(true);
    expect(pieces.reduce((sum, p) => sum + area(p.points), 0)).toBeCloseTo(107.40625, 12);
    // Each of the outline's 10 edges is some piece's own edge exactly once.
    const own = pieces.flatMap((p) =>
      p.points.flatMap((a, i) =>
        p.edge[i] ? [JSON.stringify([a, p.points[(i + 1) % p.points.length]])] : [],
      ),
    );
    expect(own.sort()).toEqual(
      outline.map((a, i) => JSON.stringify([a, outline[(i + 1) % outline.length]])).sort(),
    );
  });

  it('leaves a convex face whole', () => {
    const square4 = partOutline(side({ notches: [], cutouts: [] }));
    expect(convexPieces(square4)).toEqual([{ points: square4, edge: [true, true, true, true] }]);
  });
});

describe('solids and views with joinery', () => {
  const at = (x: number, y: number, z: number) => ({ x, y, z });
  // Lying in the x–z plane facing −y: along x, across z (up), through −y.
  const placed = (partId: string, origin = at(0, 0, 0)): Placement => ({
    partId,
    instance: 0,
    origin,
    along: at(1, 0, 0),
    across: at(0, 0, 1),
    through: at(0, -1, 0),
  });
  const dado = {
    withPart: 'shelf',
    face: 'far' as const,
    u0: 6,
    u1: 6.75,
    v0: 0,
    v1: 5.5,
    depth: 0.1875,
  };

  it('gives a side face to every outline edge, and a dado its outline on its face', () => {
    const s = solid(side({ dadoes: [dado] }), placed('side'));
    const decals = s.faces.filter((f) => f.decal);
    expect(decals).toHaveLength(1);
    // The far face is at n = 1.5, y = −1.5, facing −y.
    expect(decals[0]?.normal).toEqual(at(0, -1, 0));
    expect(decals[0]?.points.every((p) => p.y === -1.5)).toBe(true);
    const sides = s.faces.filter((f) => !f.decal && Math.abs(f.normal.y) < 0.5);
    expect(sides).toHaveLength(10);
  });

  it("paints a dado's outline over the face it is cut into", () => {
    const view = isometric(-1, -1);
    const drawing = isometricView(
      { parts: [side({ dadoes: [dado] })], placements: [placed('side')] },
      view,
      'A side with a dado.',
    );
    const corners = [at(6, -1.5, 0), at(6.75, -1.5, 0), at(6.75, -1.5, 5.5), at(6, -1.5, 5.5)];
    const page = corners.map((c) => project(view, c));
    const close = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-9;
    const polygons = drawing.primitives.filter((p) => p.kind === 'polygon');
    const decal = polygons.findIndex(
      (p) => p.points.length === 4 && page.every((c) => p.points.some((q) => close(c, q))),
    );
    // The front face (−y) holds the dado's corners; the decal comes after every piece of it.
    const front = polygons.flatMap((p, i) =>
      p.points.some((q) => close(q, project(view, at(0, -1.5, 0)))) ||
      p.points.some((q) => close(q, project(view, at(20, -1.5, 0))))
        ? [i]
        : [],
    );
    expect(decal).toBeGreaterThan(-1);
    expect(front.length).toBeGreaterThan(0);
    for (const i of front) if (i !== decal) expect(decal).toBeGreaterThan(i);
  });

  it('shows the part behind through a cutout', () => {
    // A wide back panel 10" behind the side; the viewer is in front (−y), up and to the left.
    const back = side({
      id: 'back',
      letter: 'B',
      stock: { ...stock('2x6'), width: 30 },
      length: 60,
      notches: [],
      cutouts: [],
    });
    const scene = {
      parts: [side({ cutouts: [{ end: 1, v0: 1.5, v1: 4, depth: 1 }] }), back],
      placements: [placed('side'), placed('back', at(-20, 10, -10))],
    };
    const view = isometric(-1, -1);
    const drawing = isometricView(scene, view, 'A side in front of a back panel.');
    const inside = (p: Point2, poly: readonly Point2[]) => {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i] as Point2;
        const b = poly[j] as Point2;
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
          hit = !hit;
        }
      }
      return hit;
    };
    // The middle of a cutout at the second end (u 19 to 20), on the side's front face. The line of
    // sight from there runs away from the viewer along (1, 1, −1) and leaves through the open end
    // (x = 20) before it reaches the cutout's bottom (z = 1.5), so the back panel shows there.
    const hole = project(view, at(19.5, -1.5, 2.75));
    const covering = drawing.primitives.filter(
      (p) => p.kind === 'polygon' && p.fill !== 'none' && inside(hole, p.points),
    );
    expect(covering.at(-1)?.part?.partId).toBe('back');
  });
});

describe('cut details with joinery', () => {
  const dado = (face: 'near' | 'far', u0: number) => ({
    withPart: 'shelf',
    face,
    u0,
    u1: u0 + 0.75,
    v0: 0,
    v1: 5.5,
    depth: 0.1875,
  });
  const detail = cutDetail(side({ dadoes: [dado('far', 6), dado('near', 12)] }));
  const notes = detail.notes ?? [];

  it('draws a dado on the face shown solid, and one on the other face dashed', () => {
    const outlines = detail.primitives.flatMap((p) =>
      p.kind === 'polygon' && p.fill === 'none' ? [p.role] : [],
    );
    expect(outlines).toEqual(['visible', 'hidden']);
  });

  it('dimensions each dado wall from the first end, and describes each in the notes', () => {
    const texts = detail.primitives.flatMap((p) =>
      p.kind === 'text' && p.role === 'dimension' ? [p.text] : [],
    );
    for (const u of [6, 6.75, 12, 12.75]) expect(texts).toContain(formatLength(u));
    expect(notes).toContain(
      'Dado 6" from the first end: 3/4" wide, 3/16" deep, on the face shown.',
    );
    expect(notes).toContain(
      'Dado 12" from the first end: 3/4" wide, 3/16" deep, on the other face (dashed).',
    );
  });

  it('describes each notch and cutout', () => {
    expect(notes).toContain(
      'Notch at the second end, on the right, at the far edge: 3/16" along the part by 1/2" across.',
    );
    expect(notes).toContain(
      'Cutout at the first end, on the left: 2-1/2" wide, 1" deep, starting 1-1/2" from the back edge.',
    );
  });

  it('marks the grain along the part with a double-headed arrow', () => {
    const arrow = detail.primitives.find(
      (p) => p.kind === 'line' && p.role === 'leader' && p.arrows === true,
    );
    expect(arrow?.kind === 'line' && arrow.points[0]?.y).toBe(
      arrow?.kind === 'line' && arrow.points[1]?.y,
    );
    expect(detail.primitives.some((p) => p.kind === 'text' && p.text === 'Grain')).toBe(true);
  });
});
