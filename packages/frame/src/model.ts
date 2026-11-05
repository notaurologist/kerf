// A plane frame as the direct stiffness method takes it. Units throughout: inches, pounds, and
// radians, so E is in psi, A in square inches, I in inches to the fourth, forces in pounds, and
// moments in inch-pounds. Global axes: x to the right, y up, rotation counterclockwise positive.

export interface Joint {
  id: string;
  x: number;
  y: number;
}

/**
 * Which of a joint's degrees of freedom a support holds.
 *
 * - `fixed` holds x, y, and rotation.
 * - `pinned` holds x and y; the joint turns freely.
 * - `roller` holds one translation (`restrains`) and leaves the other and rotation free.
 * - `restraints` names each degree of freedom, for a support with any of them released, such as
 *   a guided end (y and rotation held, x free).
 */
export type Support =
  | { kind: 'fixed' }
  | { kind: 'pinned' }
  | { kind: 'roller'; restrains: 'x' | 'y' }
  | { kind: 'restraints'; x: boolean; y: boolean; rotation: boolean };

export interface Section {
  /** Modulus of elasticity, psi. */
  e: number;
  /** Cross-sectional area, square inches. */
  area: number;
  /** Moment of inertia about the bending axis, inches to the fourth. */
  inertia: number;
}

export interface Member {
  id: string;
  /** The joint at the member's start; its local x axis runs from start to end. */
  start: string;
  end: string;
  section: Section;
  /**
   * Ends whose moment is released: the member is pinned to the joint there and carries no moment
   * across it. A joint where every member is released has no defined rotation of its own.
   */
  releases?: { start?: boolean; end?: boolean };
}

/** A load applied at a joint, in global axes. */
export interface JointLoad {
  joint: string;
  /** Pounds. */
  fx?: number;
  /** Pounds. */
  fy?: number;
  /** Inch-pounds, counterclockwise positive. */
  moment?: number;
}

export interface Frame {
  joints: readonly Joint[];
  members: readonly Member[];
  supports: Readonly<Record<string, Support>>;
  loads: readonly JointLoad[];
}

/** A joint's three degrees of freedom, in the order the analysis numbers them. */
export const DIRECTIONS = ['x', 'y', 'rotation'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export function restrained(support: Support | undefined): Record<Direction, boolean> {
  switch (support?.kind) {
    case undefined:
      return { x: false, y: false, rotation: false };
    case 'fixed':
      return { x: true, y: true, rotation: true };
    case 'pinned':
      return { x: true, y: true, rotation: false };
    case 'roller':
      return { x: support.restrains === 'x', y: support.restrains === 'y', rotation: false };
    case 'restraints':
      return { x: support.x, y: support.y, rotation: support.rotation };
  }
}
