import { describe, expect, it } from 'vitest';
import { compare } from './compare.ts';
import { type Member, type Plane, trim } from './trim.ts';

// Hand-checked on a 2x4 (3-1/2" wide) laid along x: reference edge on the x axis, width toward +y,
// thickness toward +z. A plane at angle θ to square, through (x0, 0, 0), has normal
// (cos θ, −sin θ, 0) and crosses the edge v at u = x0 + v·tan θ.

const board: Member = {
  along: { x: 1, y: 0, z: 0 },
  across: { x: 0, y: 1, z: 0 },
  through: { x: 0, y: 0, z: 1 },
  referenceEdge: { x: 10, y: 0, z: 0 },
  width: 3.5,
};
const RAD = Math.PI / 180;
const at = (x0: number, degrees: number, z = 0): Plane => ({
  point: { x: x0, y: 0, z: 0 },
  normal: { x: Math.cos(degrees * RAD), y: -Math.sin(degrees * RAD), z },
});
const tan30 = Math.tan(30 * RAD);

describe('trim', () => {
  it('cuts square ends at the planes', () => {
    const made = trim(board, [at(0, 0), at(48, 0)]);
    expect(made).toMatchObject({ ok: true, endsParallel: true });
    if (!made.ok) return;
    expect(made.origin).toEqual({ x: 0, y: 0, z: 0 });
    expect(made.length).toBeCloseTo(48, 12);
    expect(made.ends.map((e) => e.setting)).toEqual([0, 0]);
    expect(made.edges).toEqual({ reference: 48, far: 48 });
  });

  it('gives a trapezoid for ends angled opposite ways', () => {
    // First end 30°: u = v·tan 30°. Second end at 45° the other way: u = 48 − v.
    // Reference edge 48; far edge 48 − 3.5 − 3.5·tan 30° = 44.5 − 2.0207 = 42.4793.
    const made = trim(board, [at(0, 30), at(48, -45)]);
    expect(made).toMatchObject({ ok: true, endsParallel: false });
    if (!made.ok) return;
    expect(made.length).toBeCloseTo(48, 12);
    expect(made.ends[0].setting).toBeCloseTo(30, 12);
    expect(made.ends[1].setting).toBeCloseTo(45, 12);
    expect(made.edges.reference).toBeCloseTo(48, 12);
    expect(made.edges.far).toBeCloseTo(44.5 - 3.5 * tan30, 12);
    expect(42.4793).toBeCloseTo(made.edges.far, 4);
  });

  it('gives a parallelogram for parallel angled ends, long point to long point', () => {
    // Both at 30°: each edge 48, overall 48 + 3.5·tan 30° = 50.0207.
    const made = trim(board, [at(0, 30), at(48, 30)]);
    expect(made).toMatchObject({ ok: true, endsParallel: true });
    if (!made.ok) return;
    expect(made.length).toBeCloseTo(48 + 3.5 * tan30, 12);
    expect(50.0207).toBeCloseTo(made.length, 4);
    expect(made.ends.map((e) => e.setting)).toEqual([
      expect.closeTo(30, 12),
      expect.closeTo(30, 12),
    ]);
    expect(made.edges.reference).toBeCloseTo(48, 12);
    expect(made.edges.far).toBeCloseTo(48, 12);
  });

  it('puts the origin where the first end crosses the reference edge', () => {
    const made = trim(board, [at(12, 30), at(48, 0)]);
    expect(made.ok && made.origin).toEqual({ x: 12, y: 0, z: 0 });
  });

  it('gives the same cut for a normal of any length', () => {
    const scaled = { point: { x: 48, y: 0, z: 0 }, normal: { x: 5, y: 5, z: 0 } };
    expect(compare(trim(board, [at(0, 0), scaled]), trim(board, [at(0, 0), at(48, -45)]))).toEqual(
      [],
    );
  });

  it('refuses a plane that tilts through the thickness', () => {
    expect(trim(board, [at(0, 0), at(48, 0, 0.2)])).toMatchObject({
      ok: false,
      end: 1,
      code: 'not-a-miter',
    });
  });

  it('refuses a plane along the part', () => {
    const lengthwise = { point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 } };
    expect(trim(board, [lengthwise, at(48, 0)])).toMatchObject({ ok: false, code: 'never-meets' });
  });

  it('refuses a first end whose long point is on the far edge', () => {
    expect(trim(board, [at(0, -30), at(48, 0)])).toMatchObject({
      ok: false,
      end: 0,
      code: 'long-point-on-far-edge',
    });
  });

  it('refuses a second end a part cannot record', () => {
    expect(trim(board, [at(0, 0), at(48, 30)])).toMatchObject({
      ok: false,
      end: 1,
      code: 'second-end-not-representable',
    });
  });

  it('refuses ends that cross within the width', () => {
    expect(trim(board, [at(0, 0), at(1, -45)])).toMatchObject({ ok: false, code: 'ends-cross' });
  });
});
