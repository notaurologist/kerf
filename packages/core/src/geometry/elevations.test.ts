import { describe, expect, it } from 'vitest';
import { stock } from '../lumber/stock.ts';
import type { Part, Placement } from '../model/types.ts';
import { formatLength } from '../units/length.ts';
import { orthographic, project } from './projection.ts';
import { elevationView, sectionCuts, sectionView } from './views.ts';

// Elevations and sections (#302) on made-up parts: 2x6 boards (1-1/2" x 5-1/2"), 20" long.

const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };
const board = (id: string, letter: string): Part => ({
  id,
  letter,
  name: id,
  role: id,
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
  notches: [],
  cutouts: [],
  mortises: [],
  tenons: [],
  screwHoles: [],
  grooves: [],
  rabbets: [],
  recesses: [],
  boredHoles: [],
});
const at = (x: number, y: number, z: number) => ({ x, y, z });
/** Lying flat: along x, across y, through z (up). */
const flat = (partId: string, origin = at(0, 0, 0)): Placement => ({
  partId,
  instance: 0,
  origin,
  along: at(1, 0, 0),
  across: at(0, 1, 0),
  through: at(0, 0, 1),
});
const front = orthographic(at(0, -1, 0), at(0, 0, 1));

describe('orthographic views', () => {
  it('looks straight at one side, with lengths in its plane true', () => {
    // + 0 turns −0 into 0.
    const clean = (v: { x: number; y: number; z: number }) => at(v.x + 0, v.y + 0, v.z + 0);
    expect(clean(front.right)).toEqual(at(1, 0, 0));
    expect(clean(front.up)).toEqual(at(0, 0, 1));
    // Page y runs down.
    const p = project(front, at(3, 7, 2));
    expect([p.x + 0, p.y + 0]).toEqual([3, -2]);
  });

  it('draws only faces that face the viewer, and chains dimensions between points', () => {
    const scene = {
      parts: [board('shelf', 'A')],
      placements: [flat('shelf')],
    };
    const drawing = elevationView(scene, front, 'A shelf from the front.', 'Front elevation', [
      { points: [at(0, 0, 0), at(8, 0, 0), at(20, 0, 0)], side: 'below', offset: 2 },
    ]);
    const faces = drawing.primitives.filter((p) => p.kind === 'polygon');
    // Only the front edge face (−y) faces the viewer; seen edge-on, it is 20 by 1-1/2.
    expect(faces).toHaveLength(1);
    const texts = drawing.primitives.flatMap((p) =>
      p.kind === 'text' && p.role === 'dimension' ? [p.text] : [],
    );
    expect(texts).toEqual([formatLength(8), formatLength(12)]);
  });

  it('letters each part on the side and at heights no dimension takes', () => {
    // Two boards 10" apart: A's front edge left of the middle, B's right of it, both 0 to 1-1/2"
    // up, so at page y 0 to −1.5.
    const scene = {
      parts: [board('left', 'A'), board('right', 'B')],
      placements: [flat('left'), flat('right', at(30, 0, 0))],
    };
    const letters = (dimensions: Parameters<typeof elevationView>[4]) =>
      elevationView(scene, front, 'Two boards.', 'Front elevation', dimensions).primitives.flatMap(
        (p) => (p.kind === 'letter' ? [{ letter: p.letter, x: p.at.x, y: p.at.y }] : []),
      );
    const open = letters([]);
    expect(open.find((l) => l.letter === 'A')?.x).toBeLessThan(0);
    expect(open.find((l) => l.letter === 'B')?.x).toBeGreaterThan(50);
    const taken = letters([
      { points: [at(50, 0, 0), at(50, 0, 1.5)], side: 'right', offset: 2 },
      { points: [at(0, 0, 0), at(50, 0, 0)], side: 'below', offset: 2 },
    ]);
    expect(taken.map((l) => l.x < 0)).toEqual([true, true]);
    expect(Math.max(...taken.map((l) => l.y))).toBeLessThanOrEqual(0);
  });

  it('gives each dimension figure the ends of its line, and sets it clear of a horizontal one', () => {
    const drawing = elevationView(
      { parts: [board('shelf', 'A')], placements: [flat('shelf')] },
      front,
      'A shelf from the front.',
      'Front elevation',
      [{ points: [at(0, 0, 0), at(20, 0, 0)], side: 'below', offset: 2 }],
    );
    const figure = drawing.primitives.find((p) => p.kind === 'text' && p.role === 'dimension');
    // The shelf's front edge runs from page y −1.5 to 0, so the line is 2 below, at y = 2.
    expect(figure).toMatchObject({
      at: { x: 10, y: 2 },
      side: 'below',
      span: [
        { x: 0, y: 2 },
        { x: 20, y: 2 },
      ],
    });
  });
});

describe('section cuts', () => {
  it('cuts a part across its thickness in a rectangle', () => {
    // The plane x = 5, facing the viewer at −x, crosses the board from its back edge (y = 0) to
    // its front edge (y = 5.5), through its 1-1/2" thickness.
    const cuts = sectionCuts(board('shelf', 'A'), flat('shelf'), {
      point: at(5, 0, 0),
      normal: at(-1, 0, 0),
    });
    expect(cuts).toHaveLength(1);
    const xs = new Set(cuts[0]?.map((p) => p.x));
    expect([...xs]).toEqual([5]);
    expect(cuts[0]?.map((p) => [p.y, p.z]).sort()).toEqual(
      [
        [0, 0],
        [5.5, 0],
        [5.5, 1.5],
        [0, 1.5],
      ].sort(),
    );
  });

  it('cuts a part parallel to its faces only within its thickness', () => {
    const plane = (z: number) => ({ point: at(0, 0, z), normal: at(0, 0, 1) });
    expect(sectionCuts(board('shelf', 'A'), flat('shelf'), plane(0.75))).toHaveLength(1);
    expect(sectionCuts(board('shelf', 'A'), flat('shelf'), plane(3))).toEqual([]);
  });

  it('gives nothing for a part the plane misses, and refuses an angled cut', () => {
    expect(
      sectionCuts(board('shelf', 'A'), flat('shelf'), { point: at(30, 0, 0), normal: at(1, 0, 0) }),
    ).toEqual([]);
    const tilted = { point: at(5, 0, 0), normal: at(Math.SQRT1_2, 0, Math.SQRT1_2) };
    expect(() => sectionCuts(board('shelf', 'A'), flat('shelf'), tilted)).toThrow(/at an angle/);
  });
});

describe('section views', () => {
  // A board in front of the plane y = 2 and one that the plane cuts through, both seen from −y.
  const scene = {
    parts: [board('near', 'A'), board('cut', 'B')],
    placements: [flat('near', at(0, -10, 0)), flat('cut', at(0, 0, 3))],
  };
  const plane = { point: at(0, 2, 0), normal: at(0, -1, 0) };
  const drawing = sectionView(scene, front, plane, 'A section.', 'Section A–A');

  it('leaves out what is in front of the plane, and lines the faces it cuts', () => {
    const polygons = drawing.primitives.filter((p) => p.kind === 'polygon');
    expect(polygons.some((p) => p.part?.partId === 'near')).toBe(false);
    const lined = polygons.filter((p) => p.fill === 'section');
    expect(lined.map((p) => p.part?.partId)).toEqual(['cut']);
    // The cut face is the board's 20" length by its 1-1/2" thickness, at z = 3 to 4.5.
    const ys = lined[0]?.points.map((p) => p.y) ?? [];
    expect(Math.min(...ys)).toBe(-4.5);
    expect(Math.max(...ys)).toBe(-3);
  });

  it('paints the cut faces last, since they are nearest', () => {
    const last = drawing.primitives.filter((p) => p.kind === 'polygon').at(-1);
    expect(last?.kind === 'polygon' && last.fill).toBe('section');
  });
});
