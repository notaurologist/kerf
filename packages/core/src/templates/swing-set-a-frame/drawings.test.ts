import { describe, expect, it } from 'vitest';
import type { Point2, Primitive } from '../../geometry/primitives.ts';
import { depthOnPlane, isometric, project } from '../../geometry/projection.ts';
import { solid } from '../../geometry/solid.ts';
import { dot } from '../../geometry/vec.ts';
import { formatLength } from '../../units/length.ts';
import { swingSetAFrame } from './definition.ts';
import { explodeOffsets } from './drawings.ts';
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

  // Ray casting from the solids themselves, independent of how the drawing was painted: at every
  // point of a 400 × 400 grid, the nearest face above ground is found from the 3D solids, and the
  // face painted on top there must be that face, on the same part instance. Where the solids show
  // nothing, nothing is painted.
  it.each([
    ['isometric', () => []],
    ['exploded', () => explodeOffsets(placements)],
  ] as const)('paints exactly the nearest face at every point (%s view)', (name, offsets) => {
    const view = isometric(-1, -1);
    const drawing = name === 'isometric' ? iso : drawings.exploded;
    if (!drawing) throw new Error(name);
    const moved = offsets();
    const k = outputs.design.params.groundSlope / 12;
    const aboveGround = (p: { y: number; z: number }) => p.z - k * p.y >= -1e-6;
    const faces = placements.flatMap((pl) => {
      const part = parts.find((p) => p.id === pl.partId);
      if (!part) return [];
      const offset = moved.find(
        (m) => m.partId === pl.partId && m.instance === pl.instance,
      )?.offset;
      return solid(part, pl, offset)
        .faces.filter((f) => dot(f.normal, view.toViewer) > 1e-9)
        .map((f) => ({ f, pl, page: f.points.map((q) => project(view, q)) }));
    });
    const polys = fills(drawing.primitives);
    const b = drawing.bounds;
    const N = 400;
    let covered = 0;
    for (let i = 0; i < N * N; i++) {
      const pt = {
        x: b.x + (((i % N) + 0.37) / N) * b.width,
        y: b.y + ((Math.floor(i / N) + 0.61) / N) * b.height,
      };
      // The truth: the nearest face whose point under pt is above ground.
      let best: (typeof faces)[number] | undefined;
      let bestDepth = -Infinity;
      for (const face of faces) {
        if (!inside(pt, face.page)) continue;
        const d = depthOnPlane(view, pt, face.f.points[0] as never, face.f.normal);
        const at = {
          x: pt.x * view.right.x - pt.y * view.up.x + d * view.toViewer.x,
          y: pt.x * view.right.y - pt.y * view.up.y + d * view.toViewer.y,
          z: pt.x * view.right.z - pt.y * view.up.z + d * view.toViewer.z,
        };
        if (!aboveGround(at)) continue;
        if (d > bestDepth) {
          bestDepth = d;
          best = face;
        }
      }
      // The drawing: the last polygon painted under pt.
      let top: (typeof polys)[number] | undefined;
      for (const poly of polys) if (inside(pt, poly.points)) top = poly;
      if (!best) {
        expect(top, `paint where no face is, at ${pt.x}, ${pt.y}`).toBeUndefined();
        continue;
      }
      covered++;
      expect(top, `nothing painted over ${best.pl.partId} at ${pt.x}, ${pt.y}`).toBeDefined();
      expect(`${top?.part?.partId}/${top?.part?.instance}`).toBe(
        `${best.pl.partId}/${best.pl.instance}`,
      );
      // And a face pointing the same way: its tone follows the true face's direction (up 1,
      // along the beam 3, front and back 2).
      const n = best.f.normal;
      const ax = Math.abs(n.x);
      const ay = Math.abs(n.y);
      const az = Math.abs(n.z);
      const tone = az >= ax && az >= ay ? 1 : ax > ay ? 3 : 2;
      expect(top?.fill).toBe(tone);
    }
    expect(covered).toBeGreaterThan(1000);
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

  it('draws the chains and seats as phantom lines, hidden where a part is in front', () => {
    const phantoms = (iso?.primitives ?? []).filter(
      (p) => p.kind === 'line' && p.role === 'phantom',
    );
    // Four chains and two seats, at least one broken where a part passes in front of it.
    expect(phantoms.length).toBeGreaterThan(6);
    // Chains and seats hang in the plane y = 0. At the middle of every step of every phantom
    // line, no face facing the viewer and covering that point on the page is nearer than it.
    const view = isometric(-1, -1);
    const { outputs } = run(0);
    const faces = (outputs.design.placements ?? []).flatMap((pl) => {
      const part = outputs.design.parts.find((p) => p.id === pl.partId);
      if (!part) return [];
      return solid(part, pl).faces.filter((f) => dot(f.normal, view.toViewer) > 1e-9);
    });
    for (const line of phantoms) {
      if (line.kind !== 'line') continue;
      for (let k = 0; k + 1 < line.points.length; k++) {
        const a = line.points[k] as Point2;
        const b = line.points[k + 1] as Point2;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const d = depthOnPlane(view, mid, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
        for (const f of faces) {
          if (
            !inside(
              mid,
              f.points.map((q) => project(view, q)),
            )
          )
            continue;
          expect(depthOnPlane(view, mid, f.points[0] as never, f.normal)).toBeLessThanOrEqual(
            d + 1e-6,
          );
        }
      }
    }
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
