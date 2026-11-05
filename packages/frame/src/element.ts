// The plane frame element: two joints, three degrees of freedom at each (axial, transverse, and
// rotation), Euler–Bernoulli bending, linear elastic, small displacements. Shear deformation is
// left out, as Euler–Bernoulli theory leaves it out.
//
// Source: McGuire, Gallagher and Ziemian, Matrix Structural Analysis, 2nd edition (2000): the
// element's elastic stiffness in local axes, its rotation to global axes (k = Γᵀ·k'·Γ), and static
// condensation for member end releases. docs/explorations/frame-analysis.md records which of these
// were checked against the printed text and which against closed-form results only.

import { Matrix } from './matrix.ts';
import type { Joint, Member } from './model.ts';

/** Local degrees of freedom, in order: u₁, v₁, θ₁ at the start, then u₂, v₂, θ₂ at the end. */
export const START_ROTATION = 2;
export const END_ROTATION = 5;

interface Geometry {
  length: number;
  /** Cosine and sine of the angle from global x to the member's local x, counterclockwise. */
  cos: number;
  sin: number;
}

function geometry(member: Member, start: Joint, end: Joint): Geometry {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) throw new Error(`Member ${member.id} has no length.`);
  return { length, cos: dx / length, sin: dy / length };
}

/**
 * The element's stiffness in local axes, k', with no releases. Rows and columns follow the local
 * degrees of freedom above; forces act in the same directions as the displacements.
 */
export function localStiffness(e: number, area: number, inertia: number, length: number): Matrix {
  const l = length;
  const a = (e * area) / l;
  const b12 = (12 * e * inertia) / l ** 3;
  const b6 = (6 * e * inertia) / l ** 2;
  const b4 = (4 * e * inertia) / l;
  const b2 = (2 * e * inertia) / l;
  return Matrix.from([
    [a, 0, 0, -a, 0, 0],
    [0, b12, b6, 0, -b12, b6],
    [0, b6, b4, 0, -b6, b2],
    [-a, 0, 0, a, 0, 0],
    [0, -b12, -b6, 0, b12, -b6],
    [0, b6, b2, 0, -b6, b4],
  ]);
}

/**
 * Releases local degrees of freedom by static condensation: each released degree of freedom is
 * eliminated as one step of Gaussian elimination, k_ij − k_ir·k_rj / k_rr, and its row and column
 * are left at zero, so the force there is zero whatever the joint does. Releasing both rotations
 * leaves a member that carries axial force only.
 */
export function condense(k: Matrix, released: readonly number[]): Matrix {
  const out = Matrix.from(k.rows());
  for (const r of released) {
    const pivot = out.get(r, r);
    if (pivot > 0) {
      for (let i = 0; i < out.size; i++) {
        if (i === r) continue;
        const factor = out.get(i, r) / pivot;
        if (factor === 0) continue;
        for (let j = 0; j < out.size; j++) {
          if (j === r) continue;
          out.add(i, j, -factor * out.get(r, j));
        }
      }
    }
    for (let i = 0; i < out.size; i++) {
      out.set(i, r, 0);
      out.set(r, i, 0);
    }
  }
  return out;
}

/** Γ, which takes global displacements at the member's ends to local ones: d' = Γ·d. */
function transformation({ cos: c, sin: s }: Geometry): Matrix {
  return Matrix.from([
    [c, s, 0, 0, 0, 0],
    [-s, c, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0],
    [0, 0, 0, c, s, 0],
    [0, 0, 0, -s, c, 0],
    [0, 0, 0, 0, 0, 1],
  ]);
}

export interface Element {
  member: Member;
  geometry: Geometry;
  /** k' with the member's releases condensed out. */
  local: Matrix;
  gamma: Matrix;
  /** Γᵀ·k'·Γ, the element's stiffness in global axes. */
  global: Matrix;
}

export function element(member: Member, start: Joint, end: Joint): Element {
  const { e, area, inertia } = member.section;
  for (const [name, value] of [
    ['E', e],
    ['area', area],
    ['moment of inertia', inertia],
  ] as const) {
    if (!(Number.isFinite(value) && value > 0))
      throw new Error(`Member ${member.id} needs a positive ${name}.`);
  }
  const g = geometry(member, start, end);
  const released: number[] = [];
  if (member.releases?.start) released.push(START_ROTATION);
  if (member.releases?.end) released.push(END_ROTATION);
  const local = condense(localStiffness(e, area, inertia, g.length), released);
  const gamma = transformation(g);
  return { member, geometry: g, local, gamma, global: local.congruent(gamma) };
}
