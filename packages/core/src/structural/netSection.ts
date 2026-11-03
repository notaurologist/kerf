import type { Quantity } from './types.ts';

// The net section of a rectangular member at a bored hole (NDS 2024 3.1.2.1, p. 16): the gross
// section less the projected area of the hole. A built-up member is taken one ply at a time, as
// its checks are (decision 0013). Where the load hangs from bolts across the member, shear uses
// the effective depth NDS 2024 3.4.4.1 gives for connections instead.

/**
 * A hole bored through a member at one section along it.
 * - `through-depth`: bored down through the whole depth, `center` across the member's whole
 *   breadth (every ply) from its first face.
 * - `through-breadth`: bored across the whole breadth, through every ply, its center `height`
 *   above the member's bottom.
 */
export type SectionHole =
  | { kind: 'through-depth'; diameter: number; center: number }
  | { kind: 'through-breadth'; diameter: number; height: number };

export interface NetSection {
  /** Section modulus of the ply the hole takes most from. */
  S: number;
  steps: Quantity[];
}

/** Length of [a0, a1] that lies within [b0, b1]. */
const overlap = (a0: number, a1: number, b0: number, b1: number) =>
  Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** Why the hole cannot be in the member, or null when it fits. */
function misfit(b: number, d: number, plies: number, hole: SectionHole): string | null {
  const r = hole.diameter / 2;
  if (hole.kind === 'through-depth')
    return hole.center - r < 0 || hole.center + r > plies * b
      ? 'The hole reaches past the side of the member.'
      : null;
  return hole.height - r < 0 || hole.height + r > d
    ? 'The hole reaches past the top or bottom of the member.'
    : null;
}

/** The breadth a hole down through the depth takes from the ply it cuts most. */
function removedFromPly(b: number, plies: number, hole: { diameter: number; center: number }) {
  const lo = hole.center - hole.diameter / 2;
  const hi = hole.center + hole.diameter / 2;
  return Math.max(...Array.from({ length: plies }, (_, i) => overlap(lo, hi, i * b, (i + 1) * b)));
}

/** The net breadth at a hole down through the depth, and its working. */
function netBreadth(
  b: number,
  plies: number,
  hole: { diameter: number; center: number },
): { bNet: number; steps: Quantity[] } | string {
  const removed = removedFromPly(b, plies, hole);
  const bNet = b - removed;
  if (bNet <= 0) return 'The hole is as wide as the ply it passes through.';
  return {
    bNet,
    steps: [
      { symbol: 'D_h', label: 'Hole diameter', value: hole.diameter, unit: 'in' },
      ...(plies > 1
        ? [
            {
              symbol: 'r',
              label: 'Width of hole within the ply it cuts most',
              value: removed,
              unit: 'in',
            },
          ]
        : []),
      {
        symbol: 'b_net',
        label: `Net breadth${plies > 1 ? ' of one ply' : ''}`,
        value: bNet,
        unit: 'in',
      },
    ],
  };
}

/**
 * The net section of one ply, `b` by `d`, of a member of `plies` plies, at `hole`: the ply the
 * hole takes most from. A string when the hole leaves no section or reaches past the member.
 */
export function netSection(
  b: number,
  d: number,
  plies: number,
  hole: SectionHole,
): NetSection | string {
  const bad = misfit(b, d, plies, hole);
  if (bad) return bad;
  const D = hole.diameter;
  const per = plies > 1 ? ' of one ply' : '';
  if (hole.kind === 'through-depth') {
    const net = netBreadth(b, plies, hole);
    if (typeof net === 'string') return net;
    const S = (net.bNet * d * d) / 6;
    return {
      S,
      steps: [
        ...net.steps,
        { symbol: 'S_net', label: 'Net section modulus, b_net·d² / 6', value: S, unit: 'in³' },
      ],
    };
  }
  const h = hole.height;
  // A band D tall across the ply, centered h above the bottom. The neutral axis moves to the
  // centroid of what is left, and S is taken to the farther face.
  const A = b * (d - D);
  const yBar = (b * d * (d / 2) - b * D * h) / A;
  const I =
    (b * d ** 3) / 12 + b * d * (d / 2 - yBar) ** 2 - ((b * D ** 3) / 12 + b * D * (h - yBar) ** 2);
  const c = Math.max(yBar, d - yBar);
  return {
    S: I / c,
    steps: [
      { symbol: 'D_h', label: 'Hole diameter', value: D, unit: 'in' },
      { symbol: 'h', label: "Hole center above the member's bottom", value: h, unit: 'in' },
      {
        symbol: 'ȳ',
        label: `Neutral axis above the bottom, net section${per}`,
        value: yBar,
        unit: 'in',
      },
      { symbol: 'I_net', label: `Net moment of inertia${per}`, value: I, unit: 'in⁴' },
      { symbol: 'c', label: 'Neutral axis to the farther face', value: c, unit: 'in' },
      { symbol: 'S_net', label: 'Net section modulus, I_net / c', value: I / c, unit: 'in³' },
    ],
  };
}

export interface ShearSection {
  /**
   * The area A_v of one ply for which the adjusted design shear is Vr' = 2/3 · Fv' · A_v, as
   * b·d is for the gross section (NDS 2024 Eq. 3.4-2).
   */
  A: number;
  /** How A_v was found, as a formula. */
  formula: string;
  /** True when it comes from the effective depth at a connection rather than the net section. */
  connection: boolean;
  steps: Quantity[];
}

/**
 * The section that resists shear in one ply at `hole`. Down through the depth, the net section
 * (NDS 2024 3.1.2.1): A_v = b_net·d. Across the breadth, only for bolts the load hangs from: their
 * effective depth d_e is their height above the bottom, the unloaded edge being the top (NDS 2024
 * 3.4.4.1, Figure 3E), and A_v = b·d_e beyond 5d from the member's end (Eq. 3.4-9) or
 * b·d_e·(d_e/d)² within it (Eq. 3.4-8). A string when it cannot be worked out.
 */
export function shearSection(
  b: number,
  d: number,
  plies: number,
  hole: SectionHole,
  hung?: { fromEnd: number },
): ShearSection | string {
  const bad = misfit(b, d, plies, hole);
  if (bad) return bad;
  if (hole.kind === 'through-depth') {
    const net = netBreadth(b, plies, hole);
    if (typeof net === 'string') return net;
    const A = net.bNet * d;
    return {
      A,
      formula: 'A_v = b_net·d, the net section (NDS 2024 3.1.2.1)',
      connection: false,
      steps: [...net.steps, { symbol: 'A_v', label: 'Shear area, b_net·d', value: A, unit: 'in²' }],
    };
  }
  if (!hung)
    return 'Kerf does not work out shear at a hole across the member that no load hangs from.';
  const de = hole.height;
  const near = hung.fromEnd < 5 * d;
  const A = near ? b * de * (de / d) ** 2 : b * de;
  return {
    A,
    connection: true,
    formula: near
      ? "A_v = b·d_e·(d_e / d)², the bolts being within 5d of the member's end (NDS 2024 3.4.4.1, Eq. 3.4-8)"
      : "A_v = b·d_e, the bolts being at least 5d from the member's end (NDS 2024 3.4.4.1, Eq. 3.4-9)",
    steps: [
      { symbol: 'D_h', label: 'Hole diameter', value: hole.diameter, unit: 'in' },
      {
        symbol: 'd_e',
        label: "Effective depth, the bolts' height above the bottom",
        value: de,
        unit: 'in',
      },
      {
        symbol: 'x_e',
        label: "Distance from the member's nearer end",
        value: hung.fromEnd,
        unit: 'in',
      },
      { symbol: '5d', label: 'Five times the depth', value: 5 * d, unit: 'in' },
      {
        symbol: 'A_v',
        label: near ? 'Shear area, b·d_e·(d_e / d)²' : 'Shear area, b·d_e',
        value: A,
        unit: 'in²',
      },
    ],
  };
}
