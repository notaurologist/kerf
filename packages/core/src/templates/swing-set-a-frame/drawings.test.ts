import { describe, expect, it } from 'vitest';
import type { Point2, Primitive } from '../../geometry/primitives.ts';
import { depthOnPlane, isometric, project } from '../../geometry/projection.ts';
import { solid } from '../../geometry/solid.ts';
import { dot } from '../../geometry/vec.ts';
import { formatLength } from '../../units/length.ts';
import { swingSetAFrame } from './definition.ts';
import { EXAMPLES } from './examples.ts';

// The swing set's drawings (#90) for each worked example.

const run = (i: number) => {
  const e = EXAMPLES[i];
  if (!e) throw new Error(`no example ${i}`);
  const r = swingSetAFrame.generate(e.params, e.structuralInputs);
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return { outputs: r.output, drawings: swingSetAFrame.drawings(r.output) };
};

const inside = (pt: Point2, poly: readonly Point2[]) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as Point2;
    const b = poly[j] as Point2;
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x)
      hit = !hit;
  }
  return hit;
};
const fills = (prims: readonly Primitive[]) =>
  prims.flatMap((p) => (p.kind === 'polygon' ? [p] : []));

describe.each(EXAMPLES.map((e, i) => [e.name, i] as const))('%s', (_, i) => {
  const { outputs, drawings } = run(i);
  const { parts, placements = [] } = outputs.design;
  const iso = drawings.isometric;
  if (!iso) throw new Error('no isometric view');

  it('draws every part instance in the isometric and exploded views, with its letter', () => {
    for (const view of [iso, drawings.exploded]) {
      const drawn = new Set(
        fills(view?.primitives ?? []).map((p) => `${p.part?.partId}/${p.part?.instance}`),
      );
      for (const pl of placements) expect(drawn).toContain(`${pl.partId}/${pl.instance}`);
      for (const p of view?.primitives ?? []) {
        if (!p.part) continue;
        expect(p.part.letter).toBe(parts.find((x) => x.id === p.part?.partId)?.letter);
      }
      const letters = (view?.primitives ?? []).flatMap((p) =>
        p.kind === 'letter' ? [p.letter] : [],
      );
      expect(letters.sort()).toEqual(parts.map((x) => x.letter).sort());
    }
  });

  it("ends each letter's leader on its part", () => {
    for (const p of iso.primitives) {
      if (p.kind !== 'letter') continue;
      const own = fills(iso.primitives).filter((f) => f.part?.partId === p.part.partId);
      expect(own.some((f) => inside(p.target, f.points))).toBe(true);
    }
  });

  // Ray casting: at points across the drawing, the face painted last is the nearest one there.
  it('paints the nearest face last at every point where faces overlap', () => {
    const view = isometric(-1, -1);
    const faces = placements.flatMap((pl) => {
      const part = parts.find((p) => p.id === pl.partId);
      if (!part) return [];
      return solid(part, pl)
        .faces.filter((f) => dot(f.normal, view.toViewer) > 1e-9)
        .map((f) => ({ f, pl, page: f.points.map((q) => project(view, q)) }));
    });
    const polys = fills(iso.primitives);
    const planes = polys.map((poly) => {
      const c = {
        x: poly.points.reduce((s, q) => s + q.x, 0) / poly.points.length,
        y: poly.points.reduce((s, q) => s + q.y, 0) / poly.points.length,
      };
      return faces.find(
        ({ pl, page }) =>
          pl.partId === poly.part?.partId && pl.instance === poly.part?.instance && inside(c, page),
      )?.f;
    });
    expect(planes.every(Boolean)).toBe(true);
    const b = iso.bounds;
    let checked = 0;
    for (let k = 0; k < 40000; k++) {
      const pt = {
        x: b.x + (((k % 200) + 0.37) / 200) * b.width,
        y: b.y + ((Math.floor(k / 200) + 0.61) / 200) * b.height,
      };
      const covering = polys
        .map((_, idx) => idx)
        .filter((idx) => inside(pt, (polys[idx] as { points: Point2[] }).points));
      if (covering.length < 2) continue;
      checked++;
      const d = (idx: number) => {
        const f = planes[idx];
        return f ? depthOnPlane(view, pt, f.points[0] as never, f.normal) : -Infinity;
      };
      const top = covering[covering.length - 1] as number;
      const nearest = Math.max(...covering.map(d));
      expect(nearest - d(top)).toBeLessThan(1e-6);
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('pulls the beam, crossbars, and gussets out in the exploded view, with a guideline each', () => {
    const guidelines = (drawings.exploded?.primitives ?? []).filter(
      (p) => p.kind === 'line' && p.role === 'guideline',
    );
    const moved = placements.filter((pl) => ['beam', 'crossbar', 'gusset'].includes(pl.partId));
    expect(guidelines).toHaveLength(moved.length);
  });

  it("gives every part a cut detail whose edge dimensions are the cut list's marks", () => {
    expect(drawings.cutDetails.map((d) => d.title)).toEqual(
      parts.map((p) => `${p.letter} · ${p.name}`),
    );
    drawings.cutDetails.forEach((detail, k) => {
      const part = parts[k];
      if (!part) return;
      const dims = detail.primitives.flatMap((p) =>
        p.kind === 'text' && p.role === 'dimension' ? [p.text] : [],
      );
      expect(dims).toContain(formatLength(part.length));
      for (const mark of part.markLengths) expect(dims).toContain(formatLength(mark.value));
    });
  });

  it('lays out the site with the clear area and swing zones, and their sources', () => {
    const site = drawings.siteLayout;
    expect(site?.primitives.filter((p) => p.kind === 'polygon' && p.fill === 'zone')).toHaveLength(
      3,
    );
    expect(site?.notes.some((n) => n.includes('Pub. 324'))).toBe(true);
  });
});

describe('the worked example, by hand', () => {
  const { drawings } = run(0);
  const iso = drawings.isometric;

  // The beam's top front corner at its left end is (0, −1.75, 101.5). From the front left,
  // right = (1, −1, 0)/√2 and up = (1, 1, 2)/√6: page x = 1.75/√2 = 1.237, page y =
  // −(−1.75 + 2·101.5)/√6 = −82.160.
  it('puts the corner of the beam where the projection does by hand', () => {
    const corner = { x: 1.75 / Math.SQRT2, y: -(-1.75 + 203) / Math.sqrt(6) };
    expect(corner.x).toBeCloseTo(1.237, 3);
    expect(corner.y).toBeCloseTo(-82.16, 3);
    const beam = fills(iso?.primitives ?? []).filter((p) => p.part?.partId === 'beam');
    const near = beam
      .flatMap((p) => p.points)
      .some((q) => Math.hypot(q.x - corner.x, q.y - corner.y) < 1e-9);
    expect(near).toBe(true);
  });

  it('shows the buried legs below grade as hidden lines, with a grade line where each meets the ground', () => {
    const roles = (iso?.primitives ?? []).flatMap((p) =>
      p.kind === 'line' && p.part?.partId.startsWith('leg') ? [p.role] : [],
    );
    expect(roles).toContain('hidden');
    expect(roles).toContain('grade');
  });

  it('draws the chains and seats as phantom lines', () => {
    const phantoms = (iso?.primitives ?? []).filter(
      (p) => p.kind === 'line' && p.role === 'phantom',
    );
    // Four chains and two seats.
    expect(phantoms).toHaveLength(6);
  });
});

describe('legs on pads', () => {
  it('draws nothing below grade', () => {
    const { drawings } = run(2);
    const roles = (drawings.isometric?.primitives ?? []).flatMap((p) =>
      p.kind === 'line' ? [p.role] : [],
    );
    expect(roles).not.toContain('grade');
    expect(roles).not.toContain('hidden');
  });
});
