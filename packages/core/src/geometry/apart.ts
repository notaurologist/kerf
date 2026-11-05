import type { Part, Placement } from '../model/types.ts';
import { type Box, solid, solidBox } from './solid.ts';
import type { Vec3 } from './vec.ts';

// What a template works out a sub-assembly's explode from (#647): where each placed instance
// stands, as a box around its solid, and how far a part moves along one axis to clear the parts
// it leaves. Templates choose the directions and stages; these only measure.

/** A placed part instance and the box around its solid. */
export interface Member {
  pl: Placement;
  box: Box;
}

/** Every placement with a part, with its box. */
export function placedMembers(parts: readonly Part[], placements: readonly Placement[]): Member[] {
  return placements.flatMap((pl) => {
    const part = parts.find((q) => q.id === pl.partId);
    return part ? [{ pl, box: solidBox(solid(part, pl)) }] : [];
  });
}

/**
 * How far `a` moves along `axis`, toward `sign`, to clear every box in `from` by `gap`: past the
 * far side of each.
 */
export function clear(
  a: Box,
  from: readonly Box[],
  axis: keyof Vec3,
  sign: 1 | -1,
  gap: number,
): number {
  const past = from.map((b) => (sign > 0 ? b[axis][1] - a[axis][0] : a[axis][1] - b[axis][0]));
  return sign * (Math.max(0, ...past) + gap);
}

/** A move of `by` along one axis. */
export const along = (axis: keyof Vec3, by: number): Vec3 => ({ x: 0, y: 0, z: 0, [axis]: by });

/** How far the members run along an axis, from the least of their boxes to the most. */
export const extent = (members: readonly Member[], axis: keyof Vec3) =>
  Math.max(...members.map((m) => m.box[axis][1])) - Math.min(...members.map((m) => m.box[axis][0]));

/** The middle of a box along an axis. */
export const center = (box: Box, axis: keyof Vec3) => (box[axis][0] + box[axis][1]) / 2;
