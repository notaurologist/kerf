// The direct stiffness method for a space frame, as for the plane frame in `analyze.ts`
// (McGuire, Gallagher and Ziemian, 2nd edition, Chapter 3): assembly (Section 3.1, Eqs. 3.2–3.5,
// p. 33), supports by partitioning (Section 3.2, Eqs. 3.7–3.9, p. 41), reactions from Eq. 3.8b,
// and member end forces f' = k'·Γ·d (Eqs. 5.11 and 5.12, p. 98), with six degrees of freedom at
// each joint. Nothing is rounded here.

import { Matrix } from '../matrix.ts';
import { solveSymmetric } from '../solve.ts';
import { type Element3, element3 } from './element.ts';
import {
  DIRECTIONS3,
  type Direction3,
  type Frame3,
  type Joint3,
  restrained3,
  type Vec3,
} from './model.ts';

export interface JointDisplacement3 {
  /** Inches. */
  x: number;
  y: number;
  z: number;
  /**
   * Radians about x, y, and z. Null at a joint where no member's end and no support holds any
   * rotation: nothing there turns with the joint.
   */
  rotation: Vec3 | null;
}

/** Pounds and inch-pounds, in global axes; zero in the directions the support leaves free. */
export interface Reaction3 {
  fx: number;
  fy: number;
  fz: number;
  mx: number;
  my: number;
  mz: number;
}

/**
 * Forces the joint applies to the member at one end, in the member's local axes and the directions
 * of its local degrees of freedom: `axial` along local x, `vy` and `vz` along local y and z,
 * `torsion` about local x, `my` and `mz` about local y and z. Axial tension reads as a negative
 * `axial` at the start and a positive one at the end.
 */
export interface EndForces3 {
  axial: number;
  vy: number;
  vz: number;
  torsion: number;
  my: number;
  mz: number;
}

export type Analysis3 =
  | {
      kind: 'solved';
      displacements: Record<string, JointDisplacement3>;
      reactions: Record<string, Reaction3>;
      memberForces: Record<string, { start: EndForces3; end: EndForces3 }>;
    }
  | {
      /** The stiffness matrix is singular: part of the frame can move without straining. */
      kind: 'mechanism';
      joint: string;
      direction: Direction3;
      message: string;
    };

export function analyze3(frame: Frame3): Analysis3 {
  const index = new Map<string, number>();
  frame.joints.forEach((joint, i) => {
    if (index.has(joint.id)) throw new Error(`Joint ${joint.id} is listed twice.`);
    if (![joint.x, joint.y, joint.z].every(Number.isFinite))
      throw new Error(`Joint ${joint.id} needs finite coordinates.`);
    index.set(joint.id, i);
  });
  const jointAt = (id: string, where: string): [Joint3, number] => {
    const i = index.get(id);
    if (i === undefined) throw new Error(`${where} names joint ${id}, which is not in the frame.`);
    return [frame.joints[i] as Joint3, i];
  };
  for (const id of Object.keys(frame.supports)) jointAt(id, 'A support');

  const n = 6 * frame.joints.length;
  const dofs = (i: number) => Array.from({ length: 6 }, (_, a) => 6 * i + a);

  const memberIds = new Set<string>();
  const elements: { element: Element3; dofs: number[] }[] = frame.members.map((member) => {
    if (memberIds.has(member.id)) throw new Error(`Member ${member.id} is listed twice.`);
    memberIds.add(member.id);
    if (member.start === member.end) throw new Error(`Member ${member.id} has no length.`);
    const [start, s] = jointAt(member.start, `Member ${member.id}`);
    const [end, t] = jointAt(member.end, `Member ${member.id}`);
    return { element: element3(member, start, end), dofs: [...dofs(s), ...dofs(t)] };
  });

  const k = new Matrix(n);
  for (const { element: el, dofs: d } of elements)
    d.forEach((gi, a) => {
      d.forEach((gj, b) => {
        k.add(gi, gj, el.global.get(a, b));
      });
    });

  const p = new Array<number>(n).fill(0);
  for (const load of frame.loads) {
    const [, i] = jointAt(load.joint, 'A load');
    const values = [load.fx, load.fy, load.fz, load.mx, load.my, load.mz].map((v) => v ?? 0);
    values.forEach((v, a) => {
      if (!Number.isFinite(v)) throw new Error(`A load at joint ${load.joint} is not finite.`);
      p[6 * i + a] = (p[6 * i + a] as number) + v;
    });
  }

  const describe = (dof: number) => {
    const joint = frame.joints[Math.floor(dof / 6)] as Joint3;
    return { joint: joint.id, direction: DIRECTIONS3[dof % 6] as Direction3 };
  };

  // A joint whose rotations no member's end and no support holds has no rotational stiffness at
  // all. Its rotations are set aside, unless a moment is applied there, which nothing could resist.
  const loose = new Set<number>();
  const free: number[] = [];
  frame.joints.forEach((joint, i) => {
    const held = restrained3(frame.supports[joint.id]);
    const rot = [3, 4, 5].map((a) => 6 * i + a);
    const noRotation =
      rot.every((_, a) => !held[DIRECTIONS3[3 + a] as Direction3]) &&
      rot.every((r) => rot.every((c) => k.get(r, c) === 0)) &&
      rot.every((dof) => p[dof] === 0);
    DIRECTIONS3.forEach((direction, a) => {
      const dof = 6 * i + a;
      if (held[direction]) return;
      if (a >= 3 && noRotation) loose.add(dof);
      else free.push(dof);
    });
  });

  const kff = new Matrix(free.length);
  free.forEach((gi, a) => {
    free.forEach((gj, b) => {
      kff.set(a, b, k.get(gi, gj));
    });
  });
  const solution = solveSymmetric(
    kff,
    free.map((dof) => p[dof] as number),
  );
  if (solution.kind === 'singular') {
    const at = describe(free[solution.index] as number);
    return {
      kind: 'mechanism',
      ...at,
      message: `The frame is a mechanism: nothing holds joint ${at.joint} in ${at.direction}, once the degrees of freedom before it are held. Add a support or a member, or remove a release.`,
    };
  }

  const d = new Array<number>(n).fill(0);
  free.forEach((dof, a) => {
    d[dof] = solution.x[a] as number;
  });

  const displacements: Record<string, JointDisplacement3> = {};
  frame.joints.forEach((joint, i) => {
    const at = (a: number) => d[6 * i + a] as number;
    displacements[joint.id] = {
      x: at(0),
      y: at(1),
      z: at(2),
      rotation: loose.has(6 * i + 3) ? null : { x: at(3), y: at(4), z: at(5) },
    };
  });

  // Each member's end forces from its own end displacements, f' = k'·Γ·[T]ᵀ·d, then the same
  // forces in global axes carried back to the joints, [T]·Γᵀ·f' (Eqs. 13.37 and 5.17).
  const atJoints = new Array<number>(n).fill(0);
  const memberForces: Record<string, { start: EndForces3; end: EndForces3 }> = {};
  for (const { element: el, dofs: ds } of elements) {
    const ends = ds.map((dof) => d[dof] as number);
    const local = el.local.times(el.gamma.times(el.offset.times(ends)));
    const forces = (o: number): EndForces3 => ({
      axial: local[o] as number,
      vy: local[o + 1] as number,
      vz: local[o + 2] as number,
      torsion: local[o + 3] as number,
      my: local[o + 4] as number,
      mz: local[o + 5] as number,
    });
    memberForces[el.member.id] = { start: forces(0), end: forces(6) };
    const atEnds = Array.from({ length: 12 }, (_, a) =>
      local.reduce((s, f, b) => s + el.gamma.get(b, a) * f, 0),
    );
    ds.forEach((dof, a) => {
      const value = atEnds.reduce((s, f, b) => s + el.offset.get(b, a) * f, 0);
      atJoints[dof] = (atJoints[dof] as number) + value;
    });
  }

  // Eq. 3.8b gives what the support and any load applied there supply together; the load is taken
  // out to leave the reaction.
  const reactions: Record<string, Reaction3> = {};
  frame.joints.forEach((joint, i) => {
    const support = frame.supports[joint.id];
    if (support === undefined) return;
    const held = restrained3(support);
    const r = dofs(i).map((dof, a) =>
      held[DIRECTIONS3[a] as Direction3] ? (atJoints[dof] as number) - (p[dof] as number) : 0,
    );
    const [fx, fy, fz, mx, my, mz] = r as [number, number, number, number, number, number];
    reactions[joint.id] = { fx, fy, fz, mx, my, mz };
  });

  return { kind: 'solved', displacements, reactions, memberForces };
}
