// The space frame element: two joints, six degrees of freedom at each (three translations and three
// rotations), axial force, uniform (St. Venant) torsion, and Euler–Bernoulli bending about both
// principal axes of a bisymmetrical section, linear elastic, small displacements. Shear
// deformation and torsional warping are left out, as the text leaves them out (Section 4.6.1,
// p. 74).
//
// Source: McGuire, Gallagher and Ziemian, Matrix Structural Analysis, 2nd edition (2000), cited
// below by section, equation, and printed page.

import { Matrix } from '../matrix.ts';
import type { Joint3, Member3, Release, Section3, Vec3 } from './model.ts';

/**
 * Local degrees of freedom, in order: u, v, w, θx, θy, θz at the start, then the same at the end
 * (Figure 4.6, p. 97, and Eq. 4.34, p. 73).
 */
const START = 0;
const END = 6;
const TORSION = 3;
const ABOUT_Y = 4;
const ABOUT_Z = 5;

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const norm = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
const unit = (a: Vec3): Vec3 => scale(a, 1 / norm(a));
const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

/**
 * The element's stiffness in local axes, k', with no releases: Eq. 4.34 (Figure 4.11, p. 73), signs
 * read from the page image. The text writes the torsion term as E·J/(2(1 + ν)L), which is GJ/L for
 * an isotropic material (Eq. 4.27b, p. 68); wood is not isotropic, so G is entered on its own.
 */
export function localStiffness3(s: Section3, length: number): Matrix {
  const l = length;
  const a = (s.e * s.area) / l;
  const t = (s.g * s.j) / l;
  const z12 = (12 * s.e * s.iz) / l ** 3;
  const z6 = (6 * s.e * s.iz) / l ** 2;
  const z4 = (4 * s.e * s.iz) / l;
  const z2 = (2 * s.e * s.iz) / l;
  const y12 = (12 * s.e * s.iy) / l ** 3;
  const y6 = (6 * s.e * s.iy) / l ** 2;
  const y4 = (4 * s.e * s.iy) / l;
  const y2 = (2 * s.e * s.iy) / l;
  return Matrix.from([
    [a, 0, 0, 0, 0, 0, -a, 0, 0, 0, 0, 0],
    [0, z12, 0, 0, 0, z6, 0, -z12, 0, 0, 0, z6],
    [0, 0, y12, 0, -y6, 0, 0, 0, -y12, 0, -y6, 0],
    [0, 0, 0, t, 0, 0, 0, 0, 0, -t, 0, 0],
    [0, 0, -y6, 0, y4, 0, 0, 0, y6, 0, y2, 0],
    [0, z6, 0, 0, 0, z4, 0, -z6, 0, 0, 0, z2],
    [-a, 0, 0, 0, 0, 0, a, 0, 0, 0, 0, 0],
    [0, -z12, 0, 0, 0, -z6, 0, z12, 0, 0, 0, -z6],
    [0, 0, -y12, 0, y6, 0, 0, 0, y12, 0, y6, 0],
    [0, 0, 0, -t, 0, 0, 0, 0, 0, t, 0, 0],
    [0, 0, -y6, 0, y2, 0, 0, 0, y6, 0, y4, 0],
    [0, z6, 0, 0, 0, z2, 0, -z6, 0, 0, 0, z4],
  ]);
}

/**
 * [γ], the rotation matrix whose rows are the direction cosines of the local x, y, and z axes in
 * global axes (Eqs. 5.2 and 5.3, p. 96). Local x runs along the member; local z is x × r and local
 * y is z × x, for the reference vector r, so local y lies in the plane of x and r, on r's side.
 * The rows are unit vectors and orthogonal to each other, as Eqs. 5.4 and 5.5 require.
 */
export function rotation(along: Vec3, reference: Vec3): [Vec3, Vec3, Vec3] {
  const x = unit(along);
  const zRaw = cross(x, reference);
  if (!(norm(zRaw) > 1e-9 * norm(reference))) {
    throw new Error('The reference vector must not be parallel to the member.');
  }
  const z = unit(zRaw);
  const y = cross(z, x);
  return [x, y, z];
}

/** Γ, four [γ] blocks on its diagonal (Eqs. 5.7 and 5.9, p. 97): d' = Γ·d (Eq. 5.11, p. 98). */
function transformation(g: [Vec3, Vec3, Vec3]): Matrix {
  const m = new Matrix(12);
  for (let block = 0; block < 4; block++) {
    g.forEach((row, i) => {
      m.set(3 * block + i, 3 * block, row.x);
      m.set(3 * block + i, 3 * block + 1, row.y);
      m.set(3 * block + i, 3 * block + 2, row.z);
    });
  }
  return m;
}

/**
 * The rigid links from the joints to the member's ends, as the matrix that takes the joints'
 * global displacements to those of the member's ends: an end at the joint plus e moves by
 * u + θ × e and turns by θ. In the x-y plane this is [T]ᵀ of Eqs. 13.38 and 13.39 (Section 13.5.2,
 * p. 400), which the text prints for a plane frame only; the same small-rotation kinematics in 3D
 * are this package's extension of it. With no offsets it is the identity.
 */
function offsetTransformation(start?: Vec3, end?: Vec3): Matrix {
  const m = new Matrix(12);
  for (let i = 0; i < 12; i++) m.set(i, i, 1);
  for (const [base, e] of [
    [0, start ?? ZERO],
    [6, end ?? ZERO],
  ] as const) {
    // θ × e = (θy·ez − θz·ey, θz·ex − θx·ez, θx·ey − θy·ex).
    m.set(base, base + 4, e.z);
    m.set(base, base + 5, -e.y);
    m.set(base + 1, base + 3, -e.z);
    m.set(base + 1, base + 5, e.x);
    m.set(base + 2, base + 3, e.y);
    m.set(base + 2, base + 4, -e.x);
  }
  return m;
}

/**
 * Releases by Eq. 13.34 (Section 13.5.1, p. 398): k = k − k·G·(Gᵀ·k·G)⁻¹·Gᵀ·k, one column of G at a
 * time, each a unit vector in the local degrees of freedom. The text's G selects released rotations
 * along the local axes (Eqs. 13.35 and 13.36); a column along any direction is the same as turning
 * that end's axes so the direction is one of them (an orthogonal transformation, Eq. 5.16) and then
 * condensing that degree of freedom (Eq. 13.5, p. 376). Taking the columns one at a time gives the
 * same matrix as taking them together: after each step k·g = 0, and later steps keep it so.
 */
export function release(k: Matrix, columns: readonly number[][]): Matrix {
  let out = Matrix.from(k.rows());
  for (const g of columns) {
    const kg = out.times(g);
    const pivot = g.reduce((s, gi, i) => s + gi * (kg[i] as number), 0);
    // Already released that way (twice, or by an earlier column): nothing is left to condense.
    const scaleOf = g.reduce((s, gi, i) => s + gi * gi * out.get(i, i), 0);
    if (!(pivot > 1e-10 * scaleOf)) continue;
    const next = new Matrix(12);
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 12; j++)
        next.set(i, j, out.get(i, j) - ((kg[i] as number) * (kg[j] as number)) / pivot);
    out = next;
  }
  return out;
}

function releaseColumn(r: Release, base: number, g: [Vec3, Vec3, Vec3]): number[] {
  const column = new Array<number>(12).fill(0);
  if (r === 'torsion' || r === 'y' || r === 'z') {
    column[base + { torsion: TORSION, y: ABOUT_Y, z: ABOUT_Z }[r]] = 1;
    return column;
  }
  const axis = 'moment' in r ? r.moment : r.force;
  const size = norm(axis);
  if (!(size > 0)) throw new Error('A release needs a direction.');
  const at = base + ('moment' in r ? 3 : 0);
  g.forEach((row, i) => {
    column[at + i] = dot(row, axis) / size;
  });
  return column;
}

export interface Element3 {
  member: Member3;
  length: number;
  axes: [Vec3, Vec3, Vec3];
  /** k' with the member's releases condensed out. */
  local: Matrix;
  gamma: Matrix;
  /** From the joints' displacements to the member's ends' (identity with no offsets). */
  offset: Matrix;
  /** Γᵀ·k'·Γ (Eq. 5.16, p. 98), carried to the joints along any rigid links (Eq. 13.40, p. 401). */
  global: Matrix;
}

export function element3(member: Member3, start: Joint3, end: Joint3): Element3 {
  const s = member.section;
  for (const [name, value] of [
    ['E', s.e],
    ['G', s.g],
    ['area', s.area],
    ['Iy', s.iy],
    ['Iz', s.iz],
    ['J', s.j],
  ] as const) {
    if (!(Number.isFinite(value) && value > 0))
      throw new Error(`Member ${member.id} needs a positive ${name}.`);
  }
  for (const o of [member.offsets?.start, member.offsets?.end]) {
    if (o && ![o.x, o.y, o.z].every(Number.isFinite))
      throw new Error(`Member ${member.id} needs finite offsets.`);
  }
  const a = member.offsets?.start ?? ZERO;
  const b = member.offsets?.end ?? ZERO;
  const along = {
    x: end.x + b.x - (start.x + a.x),
    y: end.y + b.y - (start.y + a.y),
    z: end.z + b.z - (start.z + a.z),
  };
  const length = norm(along);
  if (!(length > 0)) throw new Error(`Member ${member.id} has no length.`);
  const axes = rotation(along, member.reference);
  const columns = [
    ...(member.releases?.start ?? []).map((r) => releaseColumn(r, START, axes)),
    ...(member.releases?.end ?? []).map((r) => releaseColumn(r, END, axes)),
  ];
  const local = release(localStiffness3(s, length), columns);
  const gamma = transformation(axes);
  const offset = offsetTransformation(member.offsets?.start, member.offsets?.end);
  const global = local.congruent(gamma).congruent(offset);
  return { member, length, axes, local, gamma, offset, global };
}
