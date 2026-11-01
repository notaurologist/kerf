import { z } from 'zod';
import { isPanel, type PanelStock } from '../lumber/panel.ts';
import { boltHoleDiameter } from '../structural/boltHoles.ts';
import type { Dado, HardwareItem, Part } from './types.ts';

// Operations: what needs to happen to each part, before any choice of how (DOMAIN.md, Operations).
// Methods (#104) say how, given tools; build steps (#105) order them. Generic: the cuts and bolt
// holes come from data every template's parts and hardware already carry, so their numbers are
// the cut list's own, and so does the work of making a panel from boards (DOMAIN.md, Edge-glued
// panels). A template adds the work its parts do not describe, such as easing edges or site work. Types cover what templates use; add one when a template needs it.

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

const dadoFields = {
  /** Index into the part's dadoes. */
  dado: z.number().int().nonnegative(),
  width: z.number(),
  length: z.number(),
  depth: z.number(),
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
    /**
     * True when it cuts a panel's boards to their length before gluing, in the cutting steps. A
     * panel's own end cuts come after glue-up and leave this out.
     */
    panelBoards: z.literal(true).optional(),
  }),
  /** Straighten and square each edge of a panel's boards that is glued to another. */
  z.object({
    ...onPart,
    type: z.literal('joint-edges'),
    /** The edge's length: the panel's board length. */
    length: z.number(),
    thickness: z.number(),
  }),
  /** Glue a panel's boards edge to edge and clamp them until the glue sets. */
  z.object({
    ...onPart,
    type: z.literal('glue-up'),
    boards: z.number().int().positive(),
    /** Width across the boards once glued, which the clamps reach across. */
    width: z.number(),
    length: z.number(),
  }),
  /** Bring the faces of a glued-up panel flat and level across its joints. */
  z.object({
    ...onPart,
    type: z.literal('flatten'),
    width: z.number(),
    length: z.number(),
  }),
  /**
   * A dado (Part.dadoes) that reaches two opposite edges. `length` runs between them; `width` is
   * across it, the housed part's thickness.
   */
  z.object({ ...onPart, type: z.literal('dado'), ...dadoFields }),
  /** A dado that reaches one edge and stops short of the other, so it doesn't show there. */
  z.object({ ...onPart, type: z.literal('stopped-dado'), ...dadoFields }),
  /** A corner notch (Part.notches), through the part's thickness. */
  z.object({
    ...onPart,
    type: z.literal('notch'),
    notch: z.number().int().nonnegative(),
    along: z.number(),
    across: z.number(),
    thickness: z.number(),
  }),
  /** A cutout from an end (Part.cutouts), such as between two feet, through the thickness. */
  z.object({
    ...onPart,
    type: z.literal('cutout'),
    cutout: z.number().int().nonnegative(),
    width: z.number(),
    depth: z.number(),
    thickness: z.number(),
  }),
  /** A cut along the grain, taking a panel or board down to its finished width. */
  z.object({
    ...onPart,
    type: z.literal('rip'),
    /** The finished width, measured from the edge kept. */
    width: z.number(),
    length: z.number(),
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
    /** The hole to drill (#110). */
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
 * (a bevel) has no operation type yet and is refused rather than mislabeled. A panel part first
 * has its boards cut to length, their glued edges jointed, the boards glued up and flattened, and
 * the panel ripped to width; a panel of one board is only cut to length and ripped.
 */
export function cutAndDrillOperations(
  parts: readonly Part[],
  hardware: readonly HardwareItem[],
): Operation[] {
  const ops: Operation[] = [];
  for (const part of parts) {
    const { width, thickness } = part.stock;
    if (isPanel(part.stock)) ops.push(...panelOperations(part, part.stock));
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
    part.tapers.forEach((t, i) => {
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
    ops.push(...part.dadoes.map((d, i) => dadoOperation(part, d, i)));
    part.notches.forEach((n, i) => {
      if (part.ends[n.end].setting !== 0)
        throw new Error(`${part.id}/notch-${i} is on an angled end`);
      ops.push({
        id: `${part.id}/notch-${i}`,
        type: 'notch',
        partId: part.id,
        count: part.quantity,
        notch: i,
        along: n.along,
        across: n.across,
        thickness,
      });
    });
    part.cutouts.forEach((c, i) => {
      if (part.ends[c.end].setting !== 0)
        throw new Error(`${part.id}/cutout-${i} is on an angled end`);
      ops.push({
        id: `${part.id}/cutout-${i}`,
        type: 'cutout',
        partId: part.id,
        count: part.quantity,
        cutout: i,
        width: c.v1 - c.v0,
        depth: c.depth,
        thickness,
      });
    });
  }
  for (const item of hardware) {
    if (!item.bolt) continue;
    const partIds = parts
      .filter(
        (p) =>
          p.holes.some((h) => h.hardwareId === item.id) ||
          p.boltAreas.some((a) => a.hardwareId === item.id),
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

/** Distances within this of an edge are taken as reaching it. */
const AT_EDGE = 1e-9;

/**
 * A dado's operation, from the edges it reaches: two opposite edges make it a through dado, one a
 * stopped dado that runs in from that edge. Any other dado has no operation type yet and is
 * refused rather than mislabeled.
 */
function dadoOperation(part: Part, d: Dado, i: number): Operation {
  const W = part.stock.width;
  const L = part.length;
  const at = (a: number, b: number) => Math.abs(a - b) <= AT_EDGE;
  const vOpen = [at(d.v0, 0), at(d.v1, W)];
  const uOpen = [at(d.u0, 0), at(d.u1, L)];
  const across = { v: d.v1 - d.v0, u: d.u1 - d.u0 };
  const base = {
    id: `${part.id}/dado-${i}`,
    partId: part.id,
    count: part.quantity,
    dado: i,
    depth: d.depth,
  };
  const vEdges = vOpen.filter(Boolean).length;
  const uEdges = uOpen.filter(Boolean).length;
  if (vEdges === 2 && uEdges === 0)
    return { ...base, type: 'dado', length: across.v, width: across.u };
  if (uEdges === 2 && vEdges === 0)
    return { ...base, type: 'dado', length: across.u, width: across.v };
  if (vEdges === 1 && uEdges === 0) {
    return { ...base, type: 'stopped-dado', length: across.v, width: across.u };
  }
  if (uEdges === 1 && vEdges === 0) {
    return { ...base, type: 'stopped-dado', length: across.u, width: across.v };
  }
  throw new Error(
    `${base.id} reaches ${vEdges + uEdges} edges; add an operation type before using one`,
  );
}

function panelOperations(part: Part, stock: PanelStock): Operation[] {
  const { board, boards, boardLength: length, gluedWidth } = stock;
  const onPart = { partId: part.id };
  const ops: Operation[] = ([0, 1] as const).map((e) => ({
    id: `${part.id}/board-end-${e}`,
    type: 'crosscut',
    ...onPart,
    count: part.quantity * boards,
    end: e,
    width: board.width,
    thickness: board.thickness,
    panelBoards: true,
  }));
  if (boards > 1) {
    ops.push(
      {
        id: `${part.id}/joint-edges`,
        type: 'joint-edges',
        ...onPart,
        count: part.quantity * 2 * (boards - 1),
        length,
        thickness: board.thickness,
      },
      {
        id: `${part.id}/glue-up`,
        type: 'glue-up',
        ...onPart,
        count: part.quantity,
        boards,
        width: gluedWidth,
        length,
      },
      {
        id: `${part.id}/flatten`,
        type: 'flatten',
        ...onPart,
        count: part.quantity,
        width: gluedWidth,
        length,
      },
    );
  }
  ops.push({
    id: `${part.id}/rip`,
    type: 'rip',
    ...onPart,
    count: part.quantity,
    width: stock.width,
    length,
    thickness: stock.thickness,
  });
  return ops;
}

/**
 * The operations done while breaking boards into pieces: cutting steps go board by board (#58)
 * and do these for each piece. Every other operation is ordered by the template's step outline.
 */
export const CUTTING_OPERATION_TYPES: readonly OperationType[] = ['crosscut', 'miter', 'taper'];

type OnPart = Extract<Operation, { partId: string }>;

/**
 * The operations cutting steps do on each piece as boards are broken down: its end cuts and
 * tapers, or for a panel's boards, the cuts to their length. A panel's own end cuts and tapers
 * come after glue-up, so the template's step outline places them with its other work.
 */
export function boardCuts(operations: readonly Operation[]): OnPart[] {
  const panels = new Set(
    operations.flatMap((op) => (op.type === 'crosscut' && op.panelBoards ? [op.partId] : [])),
  );
  return operations.filter(
    (op): op is OnPart =>
      CUTTING_OPERATION_TYPES.includes(op.type) &&
      'partId' in op &&
      (!panels.has(op.partId) || (op.type === 'crosscut' && op.panelBoards === true)),
  );
}

/** Each operation type's name, in sentence case, for displays. */
export const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  crosscut: 'Square crosscut',
  miter: 'Miter',
  taper: 'Taper',
  'joint-edges': 'Joint edges',
  'glue-up': 'Glue up',
  flatten: 'Flatten',
  rip: 'Rip to width',
  dado: 'Dado',
  'stopped-dado': 'Stopped dado',
  notch: 'Notch',
  cutout: 'Cutout',
  'bolt-holes': 'Bolt holes',
  'ease-edges': 'Ease edges',
  'dig-holes': 'Dig holes',
  'level-pads': 'Level pads',
};
