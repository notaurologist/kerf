import { findTemplate, geometry, type Part } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { removeHiddenLines, splitSegment, strictlyInside } from './hidden.ts';
import { lineArtSvg } from './lineArt.ts';
import { exampleParts } from './parts.ts';

type Drawing = geometry.Drawing;
type Point2 = geometry.Point2;
type Vec3 = { x: number; y: number; z: number };

const base = exampleParts('swing-set-a-frame').find((p) => p.name === 'Crossbar') as Part;

/** A plain box: square ends and no features. */
function box(id: string, letter: string, length: number, width: number, thickness: number): Part {
  return {
    ...base,
    id,
    letter,
    name: id,
    length,
    stock: { ...base.stock, width, thickness },
    ends: [
      { ...base.ends[0], setting: 0 },
      { ...base.ends[1], setting: 0 },
    ],
    endsParallel: true,
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
  };
}

/** Placed along x and across z, so its thickness runs along x × z = −y, away from a viewer at −y. */
const placed = (partId: string, origin: Vec3) => ({
  partId,
  instance: 0,
  origin,
  along: { x: 1, y: 0, z: 0 },
  across: { x: 0, y: 0, z: 1 },
  through: { x: 0, y: -1, z: 0 },
});

const front = geometry.orthographic({ x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 });

const lines = (d: Drawing, role: 'visible' | 'hidden') =>
  d.primitives.flatMap((p) => (p.kind === 'line' && p.role === role ? [p.points] : []));

const lengthOf = (ls: readonly (readonly Point2[])[]) =>
  ls.reduce((sum, l) => {
    let s = 0;
    for (let i = 0; i + 1 < l.length; i++) {
      const a = l[i] as Point2;
      const b = l[i + 1] as Point2;
      s += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return sum + s;
  }, 0);

describe('the geometry it rests on', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 2 },
    { x: 0, y: 2 },
  ];

  it('counts a point inside but not one on the boundary', () => {
    expect(strictlyInside({ x: 1, y: 1 }, square)).toBe(true);
    expect(strictlyInside({ x: 2, y: 1 }, square)).toBe(false);
    expect(strictlyInside({ x: 0, y: 0 }, square)).toBe(false);
    expect(strictlyInside({ x: 3, y: 1 }, square)).toBe(false);
  });

  it('splits a segment where it enters and leaves a polygon', () => {
    // From x = −1 to 3 at y = 1: inside from x = 0 to 2, so from t = 1/4 to 3/4.
    const runs = splitSegment({ x: -1, y: 1 }, { x: 3, y: 1 }, [square]);
    expect(runs).toEqual([
      { from: 0, to: 0.25, covered: false },
      { from: 0.25, to: 0.75, covered: true },
      { from: 0.75, to: 1, covered: false },
    ]);
  });

  it('does not cover a segment lying along the boundary', () => {
    expect(splitSegment({ x: -1, y: 0 }, { x: 3, y: 0 }, [square])).toEqual([
      { from: 0, to: 1, covered: false },
    ]);
  });
});

describe('two boxes from the front, worked by hand', () => {
  // A: 2" cube at x 0..2, z 0..2, its front face at y = −2. B: 4" long, 1" tall, 1" thick, at
  // x −1..3, z 0..1, its front face at y = 5, behind A. From the front only the front faces show.
  // B's top edge, at z = 1 from x −1 to 3, runs behind A's face between x = 0 and 2: 1" shows at
  // each end and 2" is hidden. Its bottom edge lies along A's bottom edge, so A does not cover it.
  const a = box('a', 'A', 2, 2, 2);
  const b = box('b', 'B', 4, 1, 1);
  const scene = {
    parts: [a, b],
    placements: [placed('a', { x: 0, y: 0, z: 0 }), placed('b', { x: -1, y: 6, z: 0 })],
  };
  const drawing = geometry.isometricView(scene, front, 'Two boxes', 'Front', { letters: false });

  it('paints B before A, as core does for a box behind another', () => {
    const order = drawing.primitives.flatMap((p) => (p.kind === 'polygon' ? [p.part?.partId] : []));
    expect(order).toEqual(['b', 'a']);
  });

  it('splits B’s top edge into 1" visible at each end and 2" hidden behind A', () => {
    const art = removeHiddenLines(drawing, { covered: 'dash' });
    const atTop = (ls: Point2[][]) =>
      ls
        .filter((l) => l.every((p) => Math.abs(p.y + 1) < 1e-9))
        .map((l) => l.map((p) => p.x).sort((x, y) => x - y));
    expect(
      atTop(lines(art, 'visible')).sort((p, q) => (p[0] as number) - (q[0] as number)),
    ).toEqual([
      [-1, 0],
      [2, 3],
    ]);
    expect(atTop(lines(art, 'hidden'))).toEqual([[0, 2]]);
  });

  it('keeps B’s bottom edge and all of A whole', () => {
    const art = removeHiddenLines(drawing);
    const visible = lines(art, 'visible');
    // A's four edges are 2" each; B's are 4 + 1 + 1 + 4, less the 2" hidden.
    expect(lengthOf(visible)).toBeCloseTo(8 + 10 - 2, 12);
    expect(lines(art, 'hidden')).toEqual([]);
    expect(art.primitives.some((p) => p.kind === 'polygon' && p.fill !== 'none')).toBe(false);
  });

  it('keeps every inch of edge, visible or hidden, when dashing', () => {
    const art = removeHiddenLines(drawing, { covered: 'dash' });
    expect(lengthOf(lines(art, 'visible')) + lengthOf(lines(art, 'hidden'))).toBeCloseTo(
      lengthOf(lines(drawing, 'visible')),
      9,
    );
  });

  it('writes plain line art', () => {
    const svg = lineArtSvg(removeHiddenLines(drawing, { covered: 'dash' }));
    expect(svg.match(/class="visible"/g)).toHaveLength(9);
    expect(svg.match(/class="hidden"/g)).toHaveLength(1);
    expect(svg).not.toContain('<polygon');
  });
});

/**
 * An independent check of the same rule by sampling: each edge's points at small steps, each
 * covered when a face painted after the edge contains it.
 */
function sampledCoveredLength(drawing: Drawing, step: number): number {
  const faces = drawing.primitives.flatMap((p, index) =>
    p.kind === 'polygon' && p.fill !== 'none' ? [{ index, points: p.points }] : [],
  );
  let covered = 0;
  drawing.primitives.forEach((p, index) => {
    if (p.kind !== 'line' || p.role !== 'visible') return;
    const later = faces.filter((f) => f.index > index);
    for (let i = 0; i + 1 < p.points.length; i++) {
      const a = p.points[i] as Point2;
      const b = p.points[i + 1] as Point2;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const k = Math.max(1, Math.round(len / step));
      for (let j = 0; j < k; j++) {
        const t = (j + 0.5) / k;
        const at = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        if (later.some((f) => strictlyInside(at, f.points))) covered += len / k;
      }
    }
  });
  return covered;
}

function exampleDrawings(id: string) {
  const template = findTemplate(id);
  const example = template?.examples[0];
  if (!template || !example) throw new Error(id);
  const result = template.generate(example.params, example.structuralInputs);
  if (!result.ok) throw new Error(id);
  return { template, output: result.output, drawings: template.drawings(result.output) };
}

describe('a joint from the swing set: the beam and one leg', () => {
  const { template, output } = exampleDrawings('swing-set-a-frame');
  const assembly = template.assembly(output);
  if (!assembly) throw new Error('no assembly');
  const keep = assembly.scene.parts.filter(
    (p) => p.name === 'Beam' || p.name.startsWith('Back leg'),
  );
  const ids = new Set(keep.map((p) => p.id));
  const scene = {
    parts: keep,
    placements: assembly.scene.placements.filter((pl) => ids.has(pl.partId) && pl.instance === 0),
  };
  const drawing = geometry.isometricView(scene, assembly.view, 'A joint', 'Joint', {
    letters: false,
  });

  it('hides part of the edges where the leg crosses behind the beam or in front of it', () => {
    const art = removeHiddenLines(drawing, { covered: 'dash' });
    expect(lengthOf(lines(art, 'hidden'))).toBeGreaterThan(0);
    expect(lengthOf(lines(art, 'visible')) + lengthOf(lines(art, 'hidden'))).toBeCloseTo(
      lengthOf(lines(drawing, 'visible')),
      9,
    );
  });

  it('agrees with sampling every 1/100"', () => {
    const art = removeHiddenLines(drawing, { covered: 'dash' });
    expect(lengthOf(lines(art, 'hidden'))).toBeCloseTo(sampledCoveredLength(drawing, 0.01), 1);
  });
});

describe('whole template views', () => {
  it.each(['swing-set-a-frame', 'record-cabinet'])(
    '%s: the isometric’s hidden length agrees with sampling every 1/20"',
    (id) => {
      const { drawings } = exampleDrawings(id);
      const drawing = drawings.isometric as Drawing;
      const art = removeHiddenLines(drawing, { covered: 'dash' });
      const total = lengthOf(lines(drawing, 'visible'));
      // Core already draws edges below grade as hidden lines; those are not this removal's.
      const hidden = lengthOf(lines(art, 'hidden')) - lengthOf(lines(drawing, 'hidden'));
      expect(lengthOf(lines(art, 'visible')) + hidden).toBeCloseTo(total, 6);
      expect(Math.abs(hidden - sampledCoveredLength(drawing, 0.05))).toBeLessThan(total * 0.002);
    },
  );
});
