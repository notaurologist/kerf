import { describe, expect, it } from 'vitest';
import { CORNERS, depth, depthOnPlane, fromCorner, isometric, project } from './projection.ts';

// Hand check: from the front left above, (sx, sy) = (−1, −1), the viewer direction is
// (−1, −1, 1)/√3. The page's right is z × toViewer normalized: (1, −1, 0)/√2. Its up is
// toViewer × right: (1, 1, 2)/√6.
const view = isometric(-1, -1);
const r2 = Math.SQRT2;
const r3 = Math.sqrt(3);
const r6 = Math.sqrt(6);

describe('isometric projection', () => {
  it('builds the viewing frame for the front-left corner', () => {
    expect(view.toViewer.x).toBeCloseTo(-1 / r3, 12);
    expect(view.toViewer.z).toBeCloseTo(1 / r3, 12);
    expect(view.right).toMatchObject({
      x: expect.closeTo(1 / r2, 12),
      y: expect.closeTo(-1 / r2, 12),
      z: 0,
    });
    expect(view.up.x).toBeCloseTo(1 / r6, 12);
    expect(view.up.y).toBeCloseTo(1 / r6, 12);
    expect(view.up.z).toBeCloseTo(2 / r6, 12);
  });

  it('draws each unit axis √(2/3) long, at 120° and 60° to each other', () => {
    // Seen from the front left, +x and +y run away from the viewer, so both go up the page: 120°
    // apart, each 60° from +z (and 120° from −z, the usual isometric axes).
    const axes = [
      project(view, { x: 1, y: 0, z: 0 }),
      project(view, { x: 0, y: 1, z: 0 }),
      project(view, { x: 0, y: 0, z: 1 }),
    ];
    for (const a of axes) expect(Math.hypot(a.x, a.y)).toBeCloseTo(Math.sqrt(2 / 3), 12);
    const angle = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      (Math.acos((a.x * b.x + a.y * b.y) / (2 / 3)) * 180) / Math.PI;
    expect(angle(axes[0] as never, axes[1] as never)).toBeCloseTo(120, 9);
    expect(angle(axes[1] as never, axes[2] as never)).toBeCloseTo(60, 9);
    expect(angle(axes[0] as never, axes[2] as never)).toBeCloseTo(60, 9);
    // z is straight up the page (y down); x goes up to the right at 30°.
    expect(axes[2]).toMatchObject({
      x: expect.closeTo(0, 12),
      y: expect.closeTo(-Math.sqrt(2 / 3), 12),
    });
    expect(axes[0]?.x).toBeCloseTo(1 / r2, 12);
    expect(axes[0]?.y).toBeCloseTo(-1 / r6, 12);
  });

  it('puts points nearer the viewer at greater depth', () => {
    expect(depth(view, { x: -1, y: -1, z: 1 })).toBeCloseTo(r3, 12);
    expect(depth(view, { x: 1, y: 1, z: 0 })).toBeLessThan(depth(view, { x: 0, y: 0, z: 0 }));
  });

  it("finds a plane's depth under a point on the page", () => {
    // The plane z = 2 under the page point of (3, 4, 2): its depth is that point's depth.
    const p = { x: 3, y: 4, z: 2 };
    const d = depthOnPlane(view, project(view, p), { x: 0, y: 0, z: 2 }, { x: 0, y: 0, z: 1 });
    expect(d).toBeCloseTo(depth(view, p), 12);
  });
});

describe('the view from each corner (#364)', () => {
  // Hand check: turning the front-left view to the other corners flips the viewer across x for
  // the right corners and across y for the back ones, at the same height. The page's right is
  // z × toViewer normalized, (−sy, sx, 0)/√2, so the point (1, 0, 0) lands −sy/√2 across the page:
  // right of center from the front, left of it from the back.
  const expected = {
    'front-left': { sx: -1, sy: -1 },
    'front-right': { sx: 1, sy: -1 },
    'back-right': { sx: 1, sy: 1 },
    'back-left': { sx: -1, sy: 1 },
  };

  it.each(CORNERS)('looks from the %s, above', (corner) => {
    const { sx, sy } = expected[corner];
    const v = fromCorner(view, corner);
    expect(v.toViewer.x).toBeCloseTo(sx / r3, 12);
    expect(v.toViewer.y).toBeCloseTo(sy / r3, 12);
    expect(v.toViewer.z).toBeCloseTo(1 / r3, 12);
    expect(project(v, { x: 1, y: 0, z: 0 }).x).toBeCloseTo(-sy / r2, 12);
    expect(project(v, { x: 0, y: 1, z: 0 }).x).toBeCloseTo(sx / r2, 12);
    // Up the page stays up: z projects above the origin from every corner.
    expect(project(v, { x: 0, y: 0, z: 1 }).y).toBeLessThan(0);
  });

  it('keeps a view from the front left as it is', () => {
    for (const corner of CORNERS) {
      expect(fromCorner(fromCorner(view, corner), 'front-left')).toEqual(fromCorner(view, corner));
    }
  });
});
