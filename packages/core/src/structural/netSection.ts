import type { Quantity } from './types.ts';

// The net section of a rectangular member at a bored hole (NDS 2024 3.1.2.1, p. 16): the gross
// section less the projected area of the hole. A built-up member is taken one ply at a time, as
// its checks are (decision 0013).

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
  const D = hole.diameter;
  const per = plies > 1 ? ' of one ply' : '';
  if (hole.kind === 'through-depth') {
    const lo = hole.center - D / 2;
    const hi = hole.center + D / 2;
    if (lo < 0 || hi > plies * b) return 'The hole reaches past the side of the member.';
    const removed = Math.max(
      ...Array.from({ length: plies }, (_, i) => overlap(lo, hi, i * b, (i + 1) * b)),
    );
    const bNet = b - removed;
    if (bNet <= 0) return 'The hole is as wide as the ply it passes through.';
    return {
      S: (bNet * d * d) / 6,
      steps: [
        { symbol: 'D_h', label: 'Hole diameter', value: D, unit: 'in' },
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
        { symbol: 'b_net', label: `Net breadth${per}`, value: bNet, unit: 'in' },
        {
          symbol: 'S_net',
          label: 'Net section modulus, b_net·d² / 6',
          value: (bNet * d * d) / 6,
          unit: 'in³',
        },
      ],
    };
  }
  const h = hole.height;
  if (h - D / 2 < 0 || h + D / 2 > d)
    return 'The hole reaches past the top or bottom of the member.';
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
