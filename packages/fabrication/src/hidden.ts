import type { geometry } from '@kerf/core';

// Hidden-line removal for core's isometric and exploded views. Core paints every face that
// points toward the viewer back to front (a BSP tree in `views.ts`), each followed by its own
// edges, so on screen a nearer face's fill covers the edges behind it. Every edge is still drawn
// whole underneath. Here each edge is split where a face painted after it covers it on the page,
// and the covered pieces are dropped or dashed, leaving line art with no fills that a pen
// plotter, a laser, or a print without tones can use. An edge on a later face's boundary, such
// as the one two faces of a box share, is not covered by it.

type Drawing = geometry.Drawing;
type Primitive = geometry.Primitive;
type Point2 = geometry.Point2;

/** Page distances closer than this count as the same, in drawing inches. */
const EPS = 1e-9;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const boxOf = (points: readonly Point2[]): Box => ({
  x0: Math.min(...points.map((p) => p.x)),
  y0: Math.min(...points.map((p) => p.y)),
  x1: Math.max(...points.map((p) => p.x)),
  y1: Math.max(...points.map((p) => p.y)),
});

const overlaps = (a: Box, b: Box) =>
  a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS;

/** Distance from p to the segment ab. */
function toSegment(p: Point2, a: Point2, b: Point2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Whether p is inside the polygon and not on its boundary (even-odd rule). */
export function strictlyInside(p: Point2, polygon: readonly Point2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i] as Point2;
    const b = polygon[j] as Point2;
    if (toSegment(p, a, b) < 1e-7) return false;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Where along ab, from 0 to 1, it crosses each edge of the polygon. */
function crossings(a: Point2, b: Point2, polygon: readonly Point2[]): number[] {
  const out: number[] = [];
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  for (let i = 0; i < polygon.length; i++) {
    const c = polygon[i] as Point2;
    const d = polygon[(i + 1) % polygon.length] as Point2;
    const sx = d.x - c.x;
    const sy = d.y - c.y;
    const denom = rx * sy - ry * sx;
    if (Math.abs(denom) < 1e-15) continue;
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denom;
    const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denom;
    if (t > 0 && t < 1 && u >= -1e-12 && u <= 1 + 1e-12) out.push(t);
  }
  return out;
}

/**
 * The segment ab split into runs, each covered or not by any of the polygons: the parameters
 * where it crosses their edges, each piece between them tested at its middle.
 */
export function splitSegment(
  a: Point2,
  b: Point2,
  polygons: readonly (readonly Point2[])[],
): { from: number; to: number; covered: boolean }[] {
  const cuts = [0, 1, ...polygons.flatMap((poly) => crossings(a, b, poly))].sort((x, y) => x - y);
  const at = (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const runs: { from: number; to: number; covered: boolean }[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const from = cuts[i] as number;
    const to = cuts[i + 1] as number;
    if (to - from < 1e-12) continue;
    const mid = at((from + to) / 2);
    const covered = polygons.some((poly) => strictlyInside(mid, poly));
    const last = runs.at(-1);
    if (last && last.covered === covered) last.to = to;
    else runs.push({ from, to, covered });
  }
  return runs;
}

export interface HiddenLineOptions {
  /** What to do with the covered pieces: leave them out, or keep them as hidden (dashed) lines. */
  covered: 'drop' | 'dash';
}

/**
 * The drawing as line art: every visible edge split where a face painted after it covers it, the
 * face fills removed, and everything else (letters, leaders, grade and phantom lines) kept.
 */
export function removeHiddenLines(
  drawing: Drawing,
  options: HiddenLineOptions = { covered: 'drop' },
): Drawing {
  const { primitives } = drawing;
  // Each face, with where it comes in paint order.
  const faces = primitives.flatMap((p, index) =>
    p.kind === 'polygon' && p.fill !== 'none'
      ? [{ index, points: p.points, box: boxOf(p.points) }]
      : [],
  );
  const out: Primitive[] = [];
  primitives.forEach((p, index) => {
    if (p.kind === 'polygon' && p.fill !== 'none') return;
    if (p.kind !== 'line' || p.role !== 'visible') {
      out.push(p);
      return;
    }
    const later = faces.filter((f) => f.index > index);
    for (let i = 0; i + 1 < p.points.length; i++) {
      const a = p.points[i] as Point2;
      const b = p.points[i + 1] as Point2;
      const box = boxOf([a, b]);
      const near = later
        .filter((f) =>
          overlaps(f.box, {
            x0: box.x0 - EPS,
            y0: box.y0 - EPS,
            x1: box.x1 + EPS,
            y1: box.y1 + EPS,
          }),
        )
        .map((f) => f.points);
      for (const run of splitSegment(a, b, near)) {
        if (run.covered && options.covered === 'drop') continue;
        const at = (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        out.push({
          ...p,
          role: run.covered ? 'hidden' : 'visible',
          points: [at(run.from), at(run.to)],
        });
      }
    }
  });
  return { ...drawing, primitives: out };
}
