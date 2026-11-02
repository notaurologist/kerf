import { describe, expect, it } from 'vitest';
import type { Drawing, Point2, Primitive } from '../geometry/primitives.ts';
import { CORNERS, fromCorner } from '../geometry/projection.ts';
import { solid } from '../geometry/solid.ts';
import { add, scale, type Vec3 } from '../geometry/vec.ts';
import { type Explode, isometricView, type Scene } from '../geometry/views.ts';
import { createSnapshot } from '../snapshot/snapshot.ts';
import { cornerViews } from '../steps/drawings.ts';
import { TEMPLATES } from './index.ts';

// The move between the assembled and exploded views (#352), checked on every template's worked
// examples from every corner (#364): at each step of each stage, the part on top at each point of the page is the part a
// drawing made afresh for where the parts are would show. While a stage's parts leave the joints
// they sit in, a part may show over the part it is leaving, or under it, for that stretch only.

const asJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const STEPS = 10;
const GRID = 60;

const keyOf = (p: { partId: string; instance: number }) => `${p.partId}/${p.instance}`;

interface Face {
  points: Point2[];
  key: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** A drawing's faces in paint order, each part's shifted by its move. */
function facesOf(primitives: readonly Primitive[], shift: ReadonlyMap<string, Point2>): Face[] {
  return primitives.flatMap((p): Face[] => {
    if (p.kind !== 'polygon' || !p.part || typeof p.fill !== 'number') return [];
    const key = keyOf(p.part);
    const by = shift.get(key) ?? { x: 0, y: 0 };
    const points = p.points.map((q) => ({ x: q.x + by.x, y: q.y + by.y }));
    const xs = points.map((q) => q.x);
    const ys = points.map((q) => q.y);
    return [
      {
        points,
        key,
        x0: Math.min(...xs),
        x1: Math.max(...xs),
        y0: Math.min(...ys),
        y1: Math.max(...ys),
      },
    ];
  });
}

function inside(p: Point2, poly: readonly Point2[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as Point2;
    const b = poly[j] as Point2;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      hit = !hit;
    }
  }
  return hit;
}

/** The part painted last at a point, or none. */
function topAt(faces: readonly Face[], p: Point2): string | null {
  for (let i = faces.length - 1; i >= 0; i--) {
    const f = faces[i] as Face;
    if (p.x < f.x0 || p.x > f.x1 || p.y < f.y0 || p.y > f.y1) continue;
    if (inside(p, f.points)) return f.key;
  }
  return null;
}

/** The scene with each listed instance moved by its offset times its fraction. */
function moved(scene: Scene, explode: readonly Explode[], fraction: (e: Explode) => number): Scene {
  return {
    ...scene,
    placements: scene.placements.map((pl) => {
      const e = explode.find((x) => x.partId === pl.partId && x.instance === pl.instance);
      return e ? { ...pl, origin: add(pl.origin, scale(e.offset, fraction(e))) } : pl;
    }),
  };
}

/** Pairs of instances whose boxes overlap in every direction: one sits in the other. */
function joined(scene: Scene): Set<string> {
  const boxes = scene.placements.flatMap((pl) => {
    const part = scene.parts.find((p) => p.id === pl.partId);
    if (!part) return [];
    const points = solid(part, pl).faces.flatMap((f) => f.points);
    const range = (k: keyof Vec3) => [
      Math.min(...points.map((p) => p[k])),
      Math.max(...points.map((p) => p[k])),
    ];
    return [{ key: keyOf(pl), x: range('x'), y: range('y'), z: range('z') }];
  });
  const pairs = new Set<string>();
  for (const a of boxes) {
    for (const b of boxes) {
      const share = (['x', 'y', 'z'] as const).every(
        (k) =>
          Math.min(a[k][1] as number, b[k][1] as number) -
            Math.max(a[k][0] as number, b[k][0] as number) >
          1e-6,
      );
      if (a !== b && share) pairs.add(`${a.key} ${b.key}`);
    }
  }
  return pairs;
}

const cases = TEMPLATES.flatMap((t) =>
  t.examples.flatMap((e) => {
    const made = createSnapshot(t, e.params, e.structuralInputs);
    if (!made.ok) throw new Error(JSON.stringify(made.issues));
    const outputs = t.storedOutputs.parse(asJson(made.output.outputs));
    const assembly = t.assembly(outputs);
    if (!assembly) return [];
    return CORNERS.flatMap((corner) => {
      const { isometric, exploded } = cornerViews(t, outputs, corner);
      const view = fromCorner(assembly.view, corner);
      return isometric && exploded
        ? [[t.id, e.name, corner, { ...assembly, view }, isometric, exploded] as const]
        : [];
    });
  }),
);

describe('the move between the assembled and exploded views', () => {
  it.each(cases)(
    '%s, %s, from the %s: draws each part in front of what it is in front of',
    (...c) => {
      const [, , , { scene, view, explode }, isometric, exploded] = c;
      const stages = exploded.stages ?? [];
      const order = [...new Set(explode.map((e) => e.stage ?? 0))].sort((a, b) => a - b);
      expect(stages).toHaveLength(order.length);
      const b = isometric.bounds;
      const x0 = Math.min(b.x, exploded.bounds.x);
      const y0 = Math.min(b.y, exploded.bounds.y);
      const w = Math.max(b.x + b.width, exploded.bounds.x + exploded.bounds.width) - x0;
      const h = Math.max(b.y + b.height, exploded.bounds.y + exploded.bounds.height) - y0;
      // A miss narrower than this is where two faces meet, not a part in the wrong order.
      const near = 0.004 * Math.max(w, h);
      const wrong: string[] = [];
      stages.forEach((stage, k) => {
        const n = order[k] as number;
        const before: Drawing['primitives'] =
          k === 0 ? isometric.primitives : (stages[k - 1]?.primitives ?? []);
        const after = stage.primitives ?? exploded.primitives;
        const start = moved(scene, explode, (e) => ((e.stage ?? 0) < n ? 1 : 0));
        const pairs = joined(start);
        for (let step = 0; step <= STEPS; step++) {
          const t = step / STEPS;
          const truth = facesOf(
            isometricView(
              moved(scene, explode, (e) => ((e.stage ?? 0) < n ? 1 : (e.stage ?? 0) === n ? t : 0)),
              view,
              '',
            ).primitives,
            new Map(),
          );
          const leaving = t < stage.from;
          const shown = facesOf(
            leaving ? before : after,
            new Map(
              stage.moves.map((m) => {
                const f = leaving ? t : t - 1;
                return [keyOf(m), { x: m.by.x * f, y: m.by.y * f }];
              }),
            ),
          );
          const moving = new Set(stage.moves.map(keyOf));
          for (let i = 0; i <= GRID; i++) {
            for (let j = 0; j <= GRID; j++) {
              const p = { x: x0 + (w * i) / GRID, y: y0 + (h * j) / GRID };
              const around = [
                p,
                { x: p.x + near, y: p.y },
                { x: p.x - near, y: p.y },
                { x: p.x, y: p.y + near },
                { x: p.x, y: p.y - near },
              ];
              const misses = around.map((q) => [topAt(shown, q), topAt(truth, q)] as const);
              if (!misses.every(([a, z]) => a !== z)) continue;
              const [a, z] = misses[0] as readonly [string | null, string | null];
              const pair = `${a} ${z}`;
              if (leaving && a && z && (moving.has(a) || moving.has(z)) && pairs.has(pair))
                continue;
              wrong.push(`stage ${n} at ${t.toFixed(1)}: ${a ?? 'nothing'} over ${z ?? 'nothing'}`);
            }
          }
        }
      });
      expect([...new Set(wrong)]).toEqual([]);
    },
  );
});

describe('the assembled and exploded views from every corner (#364)', () => {
  it.each(cases)('%s, %s, from the %s: letters parts on a face of each in view', (...c) => {
    const [, , , , isometric, exploded] = c;
    for (const drawing of [isometric, exploded]) {
      const faces = facesOf(drawing.primitives, new Map());
      const parts = new Set(faces.map((f) => f.key.split('/')[0]));
      const letters = drawing.primitives.flatMap((p) => (p.kind === 'letter' ? [p] : []));
      // At most one letter per part, each leader ending on that part, on top there. A part with
      // no face in view, such as a rail inside the assembled case, has none.
      expect(new Set(letters.map((l) => l.part.partId)).size).toBe(letters.length);
      for (const l of letters) expect(parts.has(l.part.partId)).toBe(true);
      for (const l of letters) expect(topAt(faces, l.target)?.split('/')[0]).toBe(l.part.partId);
      // Letters stand in columns clear of each other.
      for (const a of letters) {
        for (const b of letters) {
          if (a === b) continue;
          const apart = Math.max(Math.abs(a.at.x - b.at.x), Math.abs(a.at.y - b.at.y));
          expect(apart, `${a.letter} and ${b.letter}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it.each(cases)('%s, %s, from the %s: runs each guideline along the move of its part', (...c) => {
    const [, , , , , exploded] = c;
    const moves = (exploded.stages ?? []).flatMap((s) => s.moves);
    const guidelines = exploded.primitives.flatMap((p) =>
      p.kind === 'line' && p.role === 'guideline' && p.part ? [{ ...p, part: p.part }] : [],
    );
    expect(guidelines).toHaveLength(moves.length);
    for (const m of moves) {
      const line = guidelines.find((g) => keyOf(g.part) === keyOf(m));
      const [from, to] = line?.points ?? [];
      expect((to?.x ?? 0) - (from?.x ?? 0)).toBeCloseTo(m.by.x, 9);
      expect((to?.y ?? 0) - (from?.y ?? 0)).toBeCloseTo(m.by.y, 9);
    }
  });
});
