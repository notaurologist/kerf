import { describe, expect, it } from 'vitest';
import { stock } from '../lumber/stock.ts';
import type { Part, Placement } from '../templates/types.ts';
import { formatAngle } from '../units/angle.ts';
import { formatLength } from '../units/length.ts';
import { cutDetail } from './cutDetail.ts';
import { blankOutline, edgeLengths, partOutline } from './outline.ts';
import { planView } from './planView.ts';
import type { Primitive } from './primitives.ts';
import { isometric, project } from './projection.ts';
import { solid } from './solid.ts';
import { dot, sub } from './vec.ts';
import { isometricView } from './views.ts';

// Generic drawing geometry on made-up parts. The swing set's drawings are tested in its folder.

const tan20 = Math.tan((20 * Math.PI) / 180);

const board = (over: Partial<Part> = {}): Part => ({
  id: 'rail',
  letter: 'A',
  name: 'Rail',
  role: 'rail',
  stock: stock('2x6'),
  quantity: 1,
  length: 30,
  markLengths: [],
  ends: [
    { setting: 20, description: 'Angled' },
    { setting: 20, description: 'Angled' },
  ],
  endsParallel: false,
  notes: [],
  ...over,
});

const at = (x: number, y: number, z: number) => ({ x, y, z });
const placed = (partId: string, origin = at(0, 0, 0), instance = 0): Placement => ({
  partId,
  instance,
  origin,
  along: at(1, 0, 0),
  across: at(0, 0, 1),
  through: at(0, -1, 0),
});

describe('part outlines', () => {
  // Mirrored ends, 2x6 (5.5 wide), 30 long, 20°: the far edge is 30 − 2·5.5·tan 20° = 25.996.
  it('mirrors the second end when the ends are not parallel', () => {
    const [a, b, c, d] = blankOutline(board());
    expect(a).toEqual({ u: 0, v: 0 });
    expect(b).toEqual({ u: 30, v: 0 });
    expect(c?.u).toBeCloseTo(30 - 5.5 * tan20, 12);
    expect(d?.u).toBeCloseTo(5.5 * tan20, 12);
    expect(edgeLengths(board()).far).toBeCloseTo(25.996, 3);
  });

  // Parallel ends: the second end's long point is on the far edge, so both edges are 30 − 2.002.
  it('runs the second end parallel to the first when they are parallel', () => {
    const part = board({ endsParallel: true });
    const [, b, c] = blankOutline(part);
    expect(b?.u).toBeCloseTo(30 - 5.5 * tan20, 12);
    expect(c?.u).toBe(30);
    const edges = edgeLengths(part);
    expect(edges.reference).toBeCloseTo(27.998, 3);
    expect(edges.far).toBeCloseTo(27.998, 3);
  });

  it('cuts the first corner off along a taper', () => {
    const part = board({
      tapers: [
        { description: 'Taper', start: { u: 4, v: 0 }, end: { u: 1, v: 2.747 }, angleToEdge: 20 },
      ],
    });
    const outline = partOutline(part);
    expect(outline[0]).toEqual({ u: 4, v: 0 });
    expect(outline.at(-1)).toEqual({ u: 1, v: 2.747 });
    expect(outline).toHaveLength(5);
  });
});

describe('solids', () => {
  const s = solid(board(), placed('rail', at(1, 2, 3)));

  it('extrudes the outline through the thickness, with every normal pointing out', () => {
    expect(s.faces).toHaveLength(6);
    const all = s.faces.flatMap((f) => f.points);
    const c = {
      x: all.reduce((t, p) => t + p.x, 0) / all.length,
      y: all.reduce((t, p) => t + p.y, 0) / all.length,
      z: all.reduce((t, p) => t + p.z, 0) / all.length,
    };
    for (const face of s.faces) {
      const fc = face.points[0] as { x: number; y: number; z: number };
      expect(dot(sub(fc, c), face.normal)).toBeGreaterThan(0);
    }
  });

  it('places the long point of the first end at the origin and runs through the thickness', () => {
    const points = s.faces.flatMap((f) => f.points);
    expect(points).toContainEqual(at(1, 2, 3));
    // Through is −y, 1.5 thick.
    expect(points).toContainEqual(at(1, 0.5, 3));
  });
});

describe('isometric view', () => {
  // Two 2x6 rails, one 10 in front of the other (toward the viewer at −y), overlapping on the page.
  const parts = [board(), board({ id: 'front', letter: 'B' })];
  const scene = {
    parts,
    placements: [placed('rail', at(0, 10, 0)), placed('front', at(0, -10, 0))],
  };
  const view = isometric(-1, -1);
  const drawing = isometricView(scene, view, 'Two rails, one in front of the other.');
  const fills = drawing.primitives.filter((p) => p.kind === 'polygon');

  it('draws only faces that face the viewer, the nearer rail last', () => {
    // A prism shows 3 faces to an isometric viewer here: top (+z), front (−y), and the left end.
    expect(fills.filter((p) => p.part?.partId === 'rail')).toHaveLength(3);
    const last = fills.map((p) => p.part?.partId).lastIndexOf('front');
    const firstFront = fills.findIndex((p) => p.part?.partId === 'front');
    expect(fills.findLastIndex((p) => p.part?.partId === 'rail')).toBeLessThan(firstFront);
    expect(last).toBe(fills.length - 1);
  });

  it('tones faces by which way they point: up lightest, front middle, ends darkest', () => {
    const tones = fills
      .filter((p) => p.part?.partId === 'rail')
      .map((p) => p.kind === 'polygon' && p.fill);
    expect(tones.sort()).toEqual([1, 2, 3]);
  });

  it('letters each part once, the leader ending on it', () => {
    const letters = drawing.primitives.filter((p) => p.kind === 'letter');
    expect(letters.map((l) => l.kind === 'letter' && l.letter).sort()).toEqual(['A', 'B']);
  });

  it('projects with true isometric: the front rail starts at its projected origin', () => {
    const origin = project(view, at(0, -10, 0));
    const points = fills.flatMap((p) =>
      p.kind === 'polygon' && p.part?.partId === 'front' ? p.points : [],
    );
    expect(
      points.some((q) => Math.abs(q.x - origin.x) < 1e-9 && Math.abs(q.y - origin.y) < 1e-9),
    ).toBe(true);
  });
});

const texts = (prims: readonly Primitive[], role: string) =>
  prims.flatMap((p) => (p.kind === 'text' && p.role === role ? [p.text] : []));

describe('cut details', () => {
  it('describes the part in a sentence, from its own data', () => {
    expect(cutDetail(board()).description).toBe(
      `Cut detail for A, Rail: ${formatLength(30)} overall, ends cut at ${formatAngle(20)}.`,
    );
  });

  it("writes every dimension with core's formatters, from the part's own data", () => {
    const part = board({
      holes: [
        {
          hardwareId: 'bolt',
          diameter: 0.5625,
          boltDiameter: 0.5,
          entry: { u: 4, v: 1.375, n: 0 },
          direction: { u: 0, v: 0, n: 1 },
          length: 1.5,
        },
      ],
    });
    const detail = cutDetail(part);
    const far = edgeLengths(part).far;
    expect(texts(detail.primitives, 'dimension').sort()).toEqual(
      [
        formatLength(30), // overall
        formatLength(30), // reference edge
        formatLength(far), // far edge
        formatLength(4), // hole position
        `Saw at ${formatAngle(20)}`,
        `Saw at ${formatAngle(20)}`,
      ].sort(),
    );
    expect(texts(detail.primitives, 'note').sort()).toEqual(
      [
        `${formatAngle(70)} to the edge`,
        `${formatAngle(70)} to the edge`,
        'Drill 9/16" holes for 1/2" bolts',
      ].sort(),
    );
    expect(detail.primitives.every((p) => p.kind === 'letter' || p.part?.letter === 'A')).toBe(
      true,
    );
  });

  it('breaks a part more than 10 times longer than wide, keeping its ends', () => {
    const detail = cutDetail(board({ length: 120 }));
    expect(detail.primitives.filter((p) => p.kind === 'line' && p.role === 'break')).toHaveLength(
      2,
    );
    expect(texts(detail.primitives, 'note')).toContain('Not to scale between the breaks');
    expect(texts(detail.primitives, 'dimension')).toContain(formatLength(120));
  });

  it('draws a taper’s waste dashed', () => {
    const detail = cutDetail(
      board({
        tapers: [
          { description: 'Taper', start: { u: 4, v: 0 }, end: { u: 1, v: 2.747 }, angleToEdge: 20 },
        ],
      }),
    );
    expect(detail.primitives.some((p) => p.kind === 'polygon' && p.role === 'hidden')).toBe(true);
  });
});

describe('plan view', () => {
  const drawing = planView(
    [
      {
        label: 'Clear area',
        xMin: -72,
        xMax: 192,
        yMin: -100,
        yMax: 100,
        kind: 'zone',
        source: 'Handbook, p. 2',
        dimensioned: true,
      },
      {
        label: 'Footprint',
        xMin: 0,
        xMax: 120,
        yMin: -40,
        yMax: 40,
        kind: 'outline',
        dimensioned: true,
      },
    ],
    [],
    'A plan.',
  );

  it('dimensions in feet and inches over 6 feet, inches up to it', () => {
    expect(texts(drawing.primitives, 'dimension')).toEqual([
      formatLength(264, 'feet-inches'),
      formatLength(200, 'feet-inches'),
      formatLength(120, 'feet-inches'),
      formatLength(80, 'feet-inches'),
    ]);
    const small = planView(
      [{ label: 'Pad', xMin: 0, xMax: 24, yMin: 0, yMax: 12, kind: 'outline', dimensioned: true }],
      [],
      'A plan.',
    );
    expect(texts(small.primitives, 'dimension')).toEqual([formatLength(24), formatLength(12)]);
  });

  it('labels a tall, narrow area along its length, so neighbors do not collide', () => {
    const zones = planView(
      [
        { label: 'Left swing zone', xMin: 30, xMax: 50, yMin: -192, yMax: 192, kind: 'zone' },
        { label: 'Clear area', xMin: -72, xMax: 192, yMin: -100, yMax: 100, kind: 'zone' },
      ],
      [],
      'A plan.',
    );
    const labels = zones.primitives.flatMap((p) =>
      p.kind === 'text' && p.role === 'label' ? [p] : [],
    );
    expect(labels[0]).toMatchObject({ text: 'Left swing zone', rotate: -90 });
    expect(labels[1]?.rotate).toBeUndefined();
  });

  it('puts the front at the bottom, zones under outlines, and each source under the drawing', () => {
    const polygons = drawing.primitives.filter((p) => p.kind === 'polygon');
    expect(polygons.map((p) => p.kind === 'polygon' && p.fill)).toEqual(['zone', 'none']);
    // y = −40 (the front edge) is drawn at page y = 40, below y = 40 at page −40.
    const footprint = polygons[1];
    expect(footprint?.kind === 'polygon' && footprint.points[0]).toEqual({ x: 0, y: 40 });
    expect(drawing.notes).toEqual(['Clear area: Handbook, p. 2.']);
  });
});
