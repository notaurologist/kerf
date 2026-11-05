// The direct stiffness method for a plane frame: each member's global stiffness is added into the
// structure's at its joints' degrees of freedom, the supported degrees of freedom are set aside,
// the free ones are solved for, and the reactions and member end forces follow from the
// displacements. Nothing is rounded here; rounding belongs to whatever displays the results.

import { type Element, element } from './element.ts';
import { Matrix } from './matrix.ts';
import { DIRECTIONS, type Direction, type Frame, type Joint, restrained } from './model.ts';
import { solveSymmetric } from './solve.ts';

export interface JointDisplacement {
  /** Inches. */
  x: number;
  /** Inches. */
  y: number;
  /**
   * Radians, counterclockwise positive. Null at a joint where every member's end is released and
   * no support holds the rotation: nothing there turns with the joint, so it has no rotation of
   * its own. Each member's end rotation there is a different number and is not reported.
   */
  rotation: number | null;
}

export interface Reaction {
  /** Pounds. */
  fx: number;
  /** Pounds. */
  fy: number;
  /** Inch-pounds, counterclockwise positive. */
  moment: number;
}

/**
 * Forces on the member at one end, in its local axes: `axial` along the member from start to
 * end, `shear` perpendicular to it (90° counterclockwise from local x), `moment` counterclockwise.
 * These are the forces the joint applies to the member, in the directions of the local degrees of
 * freedom, so axial tension reads as a negative `axial` at the start and a positive one at the end.
 */
export interface EndForces {
  /** Pounds. */
  axial: number;
  /** Pounds. */
  shear: number;
  /** Inch-pounds. */
  moment: number;
}

export type Analysis =
  | {
      kind: 'solved';
      displacements: Record<string, JointDisplacement>;
      /** One per supported joint, in global axes; zero in the directions the support leaves free. */
      reactions: Record<string, Reaction>;
      memberForces: Record<string, { start: EndForces; end: EndForces }>;
    }
  | {
      /** The stiffness matrix is singular: part of the frame can move without straining. */
      kind: 'mechanism';
      joint: string;
      direction: Direction;
      message: string;
    };

export function analyze(frame: Frame): Analysis {
  const index = new Map<string, number>();
  frame.joints.forEach((joint, i) => {
    if (index.has(joint.id)) throw new Error(`Joint ${joint.id} is listed twice.`);
    if (!(Number.isFinite(joint.x) && Number.isFinite(joint.y)))
      throw new Error(`Joint ${joint.id} needs finite coordinates.`);
    index.set(joint.id, i);
  });
  const jointAt = (id: string, where: string): [Joint, number] => {
    const i = index.get(id);
    if (i === undefined) throw new Error(`${where} names joint ${id}, which is not in the frame.`);
    return [frame.joints[i] as Joint, i];
  };
  for (const id of Object.keys(frame.supports)) jointAt(id, 'A support');

  const n = 3 * frame.joints.length;
  const dofs = (i: number) => [3 * i, 3 * i + 1, 3 * i + 2];

  const memberIds = new Set<string>();
  const elements: { element: Element; dofs: number[] }[] = frame.members.map((member) => {
    if (memberIds.has(member.id)) throw new Error(`Member ${member.id} is listed twice.`);
    memberIds.add(member.id);
    if (member.start === member.end) throw new Error(`Member ${member.id} has no length.`);
    const [start, s] = jointAt(member.start, `Member ${member.id}`);
    const [end, t] = jointAt(member.end, `Member ${member.id}`);
    return { element: element(member, start, end), dofs: [...dofs(s), ...dofs(t)] };
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
    const values = [load.fx ?? 0, load.fy ?? 0, load.moment ?? 0];
    values.forEach((v, a) => {
      if (!Number.isFinite(v)) throw new Error(`A load at joint ${load.joint} is not finite.`);
      p[3 * i + a] = (p[3 * i + a] as number) + v;
    });
  }

  const describe = (dof: number) => {
    const joint = frame.joints[Math.floor(dof / 3)] as Joint;
    return { joint: joint.id, direction: DIRECTIONS[dof % 3] as Direction };
  };

  // A rotation no member's end and no support holds has no stiffness at all. It is set aside like
  // a supported one, unless a moment is applied there, which nothing could resist.
  const loose = new Set<number>();
  const free: number[] = [];
  frame.joints.forEach((joint, i) => {
    const held = restrained(frame.supports[joint.id]);
    DIRECTIONS.forEach((direction, a) => {
      const dof = 3 * i + a;
      if (held[direction]) return;
      if (direction === 'rotation' && k.get(dof, dof) === 0 && p[dof] === 0) loose.add(dof);
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

  const displacements: Record<string, JointDisplacement> = {};
  frame.joints.forEach((joint, i) => {
    displacements[joint.id] = {
      x: d[3 * i] as number,
      y: d[3 * i + 1] as number,
      rotation: loose.has(3 * i + 2) ? null : (d[3 * i + 2] as number),
    };
  });

  // Each member's end forces from its own end displacements, f' = k'·Γ·d. A released end's
  // rotation is condensed out of k', so the loose rotation's placeholder zero never enters.
  const atJoints = new Array<number>(n).fill(0);
  const memberForces: Record<string, { start: EndForces; end: EndForces }> = {};
  for (const { element: el, dofs: ds } of elements) {
    const ends = ds.map((dof) => d[dof] as number);
    const local = el.local.times(el.gamma.times(ends));
    const [a1, s1, m1, a2, s2, m2] = local as [number, number, number, number, number, number];
    memberForces[el.member.id] = {
      start: { axial: a1, shear: s1, moment: m1 },
      end: { axial: a2, shear: s2, moment: m2 },
    };
    // Γᵀ·f', the same forces in global axes, which the joints apply to the member.
    const c = el.geometry.cos;
    const s = el.geometry.sin;
    const global = [c * a1 - s * s1, s * a1 + c * s1, m1, c * a2 - s * s2, s * a2 + c * s2, m2];
    ds.forEach((dof, a) => {
      atJoints[dof] = (atJoints[dof] as number) + (global[a] as number);
    });
  }

  // At a supported joint, the support and the applied load together supply what the members take.
  const reactions: Record<string, Reaction> = {};
  frame.joints.forEach((joint, i) => {
    const support = frame.supports[joint.id];
    if (support === undefined) return;
    const held = restrained(support);
    const r = dofs(i).map((dof, a) =>
      held[DIRECTIONS[a] as Direction] ? (atJoints[dof] as number) - (p[dof] as number) : 0,
    );
    reactions[joint.id] = { fx: r[0] as number, fy: r[1] as number, moment: r[2] as number };
  });

  return { kind: 'solved', displacements, reactions, memberForces };
}
