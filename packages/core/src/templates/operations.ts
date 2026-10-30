import { z } from 'zod';
import { boltHoleDiameter } from '../structural/boltHoles.ts';
import type { HardwareItem, Part } from './types.ts';

// Operations: what needs to happen to each part, before any choice of how (DOMAIN.md, Operations).
// Methods (#104) say how, given tools; build steps (#105) order them. Generic: the cuts and bolt
// holes come from data every template's parts and hardware already carry, so their numbers are
// the cut list's own; a template adds the work its parts do not describe, such as easing edges
// or site work. Types cover what templates use; add one when a template needs it.

const end = z.union([z.literal(0), z.literal(1)]);
const base = {
  /** Unique within a plan, stable across regenerations: build steps and history refer to it. */
  id: z.string(),
  /** How many times it is done: a part's quantity, or the number of holes. */
  count: z.number().int().positive(),
};
const onPart = {
  ...base,
  partId: z.string(),
};

export const Operation = z.discriminatedUnion('type', [
  /** A square cut across the board at one end. */
  z.object({
    ...onPart,
    type: z.literal('crosscut'),
    end,
    /** The stock's actual width and thickness: what the cut goes across and through. */
    width: z.number(),
    thickness: z.number(),
  }),
  /** An angled cut across the board's face at one end, laid out from the reference edge. */
  z.object({
    ...onPart,
    type: z.literal('miter'),
    end,
    /** Saw setting in degrees, miter-saw convention: 0 is square (DOMAIN.md, Units). */
    setting: z.number(),
    width: z.number(),
    thickness: z.number(),
  }),
  /** A straight cut along the part rather than across it (Part.tapers). */
  z.object({
    ...onPart,
    type: z.literal('taper'),
    /** Index into the part's tapers. */
    taper: z.number().int().nonnegative(),
    /** The angle between the cut and the reference edge, in degrees. */
    angleToEdge: z.number(),
    /** Length of the cut line, from its start on the reference edge to the end cut. */
    length: z.number(),
    thickness: z.number(),
  }),
  /**
   * Holes for one through-bolt item, drilled through the parts it joins. `depth` is the bolt's
   * grip: the wood each hole passes through, from entry to exit.
   */
  z.object({
    ...base,
    type: z.literal('bolt-holes'),
    hardwareId: z.string(),
    /** Every part the holes pass through, in the order of the parts list. */
    partIds: z.array(z.string()).min(1),
    boltDiameter: z.number(),
    /**
     * The hole to drill (#110). Plans made before template version 9 drilled at the bolt's
     * diameter, and reading them sets this to `boltDiameter` (snapshot shape 9).
     */
    holeDiameter: z.number(),
    depth: z.number(),
  }),
  /** Round over sharp edges and sand off splinters on every face a person can touch. */
  z.object({ ...onPart, type: z.literal('ease-edges') }),
  /** Holes dug for parts set below grade. */
  z.object({
    ...base,
    type: z.literal('dig-holes'),
    /** Depth below grade, from the template. */
    depth: z.number(),
  }),
  /** Level pads or footings at grade for parts that stand on them. */
  z.object({ ...base, type: z.literal('level-pads') }),
]);
export type Operation = z.infer<typeof Operation>;
export type OperationType = Operation['type'];

/**
 * Every end cut and taper on every part, and every through-bolt item's holes, in parts order. A
 * square end is a crosscut and an angled one a miter; an end measured from the reference face
 * (a bevel) has no operation type yet and is refused rather than mislabeled.
 */
export function cutAndDrillOperations(
  parts: readonly Part[],
  hardware: readonly HardwareItem[],
): Operation[] {
  const ops: Operation[] = [];
  for (const part of parts) {
    const { width, thickness } = part.stock;
    part.ends.forEach((cut, e) => {
      const at = { partId: part.id, count: part.quantity, end: e as 0 | 1, width, thickness };
      const id = `${part.id}/end-${e}`;
      if (cut.measuredFrom === 'reference-face') {
        throw new Error(`${id} is a bevel; add a bevel operation type before using one`);
      }
      ops.push(
        cut.setting === 0
          ? { id, type: 'crosscut', ...at }
          : { id, type: 'miter', setting: cut.setting, ...at },
      );
    });
    (part.tapers ?? []).forEach((t, i) => {
      ops.push({
        id: `${part.id}/taper-${i}`,
        type: 'taper',
        partId: part.id,
        count: part.quantity,
        taper: i,
        angleToEdge: t.angleToEdge,
        length: Math.hypot(t.end.u - t.start.u, t.end.v - t.start.v),
        thickness,
      });
    });
  }
  for (const item of hardware) {
    if (!item.bolt) continue;
    const partIds = parts
      .filter(
        (p) =>
          p.holes?.some((h) => h.hardwareId === item.id) ||
          p.boltAreas?.some((a) => a.hardwareId === item.id),
      )
      .map((p) => p.id);
    if (partIds.length === 0) continue;
    ops.push({
      id: `${item.id}/holes`,
      type: 'bolt-holes',
      hardwareId: item.id,
      partIds,
      count: item.quantity,
      boltDiameter: item.bolt.diameter,
      holeDiameter: boltHoleDiameter(item.bolt.diameter),
      depth: item.bolt.grip,
    });
  }
  return ops;
}

/** Each operation type's name, in sentence case, for displays. */
export const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  crosscut: 'Square crosscut',
  miter: 'Miter',
  taper: 'Taper',
  'bolt-holes': 'Bolt holes',
  'ease-edges': 'Ease edges',
  'dig-holes': 'Dig holes',
  'level-pads': 'Level pads',
};
