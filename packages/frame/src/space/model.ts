// A space frame as the direct stiffness method takes it. Units throughout: inches, pounds, and
// radians, so E and G are in psi, A in square inches, I and J in inches to the fourth, forces in
// pounds, and moments in inch-pounds. Global axes are right-handed; moments and rotations follow
// the right-hand rule about each axis (McGuire, Gallagher and Ziemian, 2nd edition, Figure 4.6 and
// Section 4.5.4, p. 72).

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Joint3 extends Vec3 {
  id: string;
}

/**
 * Which of a joint's six degrees of freedom a support holds.
 *
 * - `fixed` holds all three translations and all three rotations.
 * - `pinned` holds the three translations; the joint turns freely.
 * - `restraints` names each degree of freedom, for a support with any of them released.
 */
export type Support3 =
  | { kind: 'fixed' }
  | { kind: 'pinned' }
  | {
      kind: 'restraints';
      x: boolean;
      y: boolean;
      z: boolean;
      rx: boolean;
      ry: boolean;
      rz: boolean;
    };

export interface Section3 {
  /** Modulus of elasticity, psi. */
  e: number;
  /** Shear modulus, psi. */
  g: number;
  /** Cross-sectional area, square inches. */
  area: number;
  /** Moment of inertia about the member's local y axis (bending in its x-z plane), in⁴. */
  iy: number;
  /** Moment of inertia about the member's local z axis (bending in its x-y plane), in⁴. */
  iz: number;
  /** Torsion constant, in⁴. */
  j: number;
}

/**
 * A force or moment a member does not carry at one end, so the joint there can move or turn that
 * way without it. `torsion`, `y`, and `z` name the moment about the member's own local axes; an
 * axis in global coordinates releases the moment about it (`moment`) or the force along it
 * (`force`), whichever way the member lies.
 */
export type Release = 'torsion' | 'y' | 'z' | { moment: Vec3 } | { force: Vec3 };

export interface Member3 {
  id: string;
  /** The joint at the member's start; its local x axis runs from start to end. */
  start: string;
  end: string;
  section: Section3;
  /**
   * A vector, in global axes, that sets which way the section faces: the member's local y axis
   * lies in the plane of its local x axis and this vector, on the vector's side, and local z
   * completes a right-handed set. It must not be parallel to the member.
   */
  reference: Vec3;
  /** What each end does not carry; each release acts at the member's end, past any offset. */
  releases?: { start?: readonly Release[]; end?: readonly Release[] };
  /**
   * Rigid links from a joint to the member's end, in global axes, inches: the member's end sits at
   * the joint plus this offset and moves with the joint as a rigid body.
   */
  offsets?: { start?: Vec3; end?: Vec3 };
}

/** A load applied at a joint, in global axes: pounds and inch-pounds. */
export interface JointLoad3 {
  joint: string;
  fx?: number;
  fy?: number;
  fz?: number;
  mx?: number;
  my?: number;
  mz?: number;
}

export interface Frame3 {
  joints: readonly Joint3[];
  members: readonly Member3[];
  supports: Readonly<Record<string, Support3>>;
  loads: readonly JointLoad3[];
}

/** A joint's six degrees of freedom, in the order the analysis numbers them. */
export const DIRECTIONS3 = ['x', 'y', 'z', 'rx', 'ry', 'rz'] as const;
export type Direction3 = (typeof DIRECTIONS3)[number];

export function restrained3(support: Support3 | undefined): Record<Direction3, boolean> {
  switch (support?.kind) {
    case undefined:
      return { x: false, y: false, z: false, rx: false, ry: false, rz: false };
    case 'fixed':
      return { x: true, y: true, z: true, rx: true, ry: true, rz: true };
    case 'pinned':
      return { x: true, y: true, z: true, rx: false, ry: false, rz: false };
    case 'restraints':
      return {
        x: support.x,
        y: support.y,
        z: support.z,
        rx: support.rx,
        ry: support.ry,
        rz: support.rz,
      };
  }
}
