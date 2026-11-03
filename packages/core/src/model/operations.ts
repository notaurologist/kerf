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
  /** Bring the faces of a glued-up panel flat and level across its joints, to `thickness`. */
  z.object({
    ...onPart,
    type: z.literal('flatten'),
    width: z.number(),
    length: z.number(),
    thickness: z.number(),
  }),
  /**
   * A dado (Part.dadoes) that reaches two opposite edges. `length` runs between them; `width` is
   * across it, the housed part's thickness.
   */
  z.object({ ...onPart, type: z.literal('dado'), ...dadoFields }),
  /** A dado that reaches one edge and stops short of the other, so it doesn't show there. */
  z.object({ ...onPart, type: z.literal('stopped-dado'), ...dadoFields }),
  /**
   * A dado at a part's end, open there and at one edge and stopped short of the other: a rabbet
   * that doesn't show at that edge.
   */
  z.object({ ...onPart, type: z.literal('stopped-rabbet'), ...dadoFields }),
  /**
   * A dado that reaches no edge, stopped short at both ends, such as a track for a sliding panel.
   * `length` is its long way.
   */
  z.object({ ...onPart, type: z.literal('double-stopped-dado'), ...dadoFields }),
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
  /** A pocket for a tenon (Part.mortises): `length` along the part, `width` across, `depth` in. */
  z.object({
    ...onPart,
    type: z.literal('mortise'),
    mortise: z.number().int().nonnegative(),
    length: z.number(),
    width: z.number(),
    depth: z.number(),
  }),
  /**
   * A tenon on a square end (Part.tenons): `length` out from the shoulders, `tenonThickness` and
   * `width` across. The cheeks come off each face, `cheekBack` and `cheekFront` deep, and the
   * shoulders off each edge, `shoulderReference` and `shoulderFar` deep.
   */
  z.object({
    ...onPart,
    type: z.literal('tenon'),
    tenon: z.number().int().nonnegative(),
    end,
    length: z.number(),
    tenonThickness: z.number(),
    width: z.number(),
    thickness: z.number(),
    cheekBack: z.number(),
    cheekFront: z.number(),
    shoulderReference: z.number(),
    shoulderFar: z.number(),
  }),
  /**
   * Clearance holes for wood screws through a part (Part.screwHoles), `round` of them round and
   * `slotted` lengthened by `slot` so what they hold can move. Counts are per piece.
   */
  z.object({
    ...onPart,
    type: z.literal('screw-holes'),
    round: z.number().int().nonnegative(),
    slotted: z.number().int().nonnegative(),
    slot: z.number(),
    thickness: z.number(),
  }),
  /** A groove along an edge (Part.grooves), `length` long; `stopped` when it reaches neither end. */
  z.object({
    ...onPart,
    type: z.literal('groove'),
    groove: z.number().int().nonnegative(),
    length: z.number(),
    width: z.number(),
    depth: z.number(),
    stopped: z.boolean(),
  }),
  /** A rabbet along an edge or end (Part.rabbets), the whole `length` of it. */
  z.object({
    ...onPart,
    type: z.literal('rabbet'),
    rabbet: z.number().int().nonnegative(),
    length: z.number(),
    width: z.number(),
    depth: z.number(),
  }),
  /** A finger recess in a face (Part.recesses). */
  z.object({
    ...onPart,
    type: z.literal('finger-recess'),
    recess: z.number().int().nonnegative(),
    width: z.number(),
    height: z.number(),
    depth: z.number(),
  }),
  /** Round over sharp edges and sand off splinters on every face a person can touch. */
  z.object({ ...onPart, type: z.literal('ease-edges') }),
  /**
   * Fit parts together without glue, to check every joint before gluing. `reach` is the farthest
   * a clamp must open across the assembly.
   */
  z.object({
    ...base,
    type: z.literal('dry-fit'),
    partIds: z.array(z.string()).min(2),
    reach: z.number(),
  }),
  /** Drive `count` screws through holes already drilled, joining the parts named, without glue. */
  z.object({
    ...base,
    type: z.literal('fasten'),
    partIds: z.array(z.string()).min(2),
  }),
  /** Glue parts together and clamp them until the glue holds, the clamps opening to `reach`. */
  z.object({
    ...base,
    type: z.literal('glue-assembly'),
    partIds: z.array(z.string()).min(2),
    reach: z.number(),
  }),
  /**
   * Bring the lumber indoors before cutting, so it nears the moisture content it will have in
   * service before it is glued (Wood Handbook, ch. 13, pp. 13-5 and 13-15).
   */
  z.object({ ...base, type: z.literal('acclimate'), partIds: z.array(z.string()).min(1) }),
  /** Sand and finish every face a person can see or touch. */
  z.object({ ...base, type: z.literal('finish'), partIds: z.array(z.string()).min(1) }),
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
 * the panel ripped to width; a panel of one board is only cut to length and ripped. A plan with
 * glued-up panels first lets its lumber settle indoors.
 */
export function cutAndDrillOperations(
  parts: readonly Part[],
  hardware: readonly HardwareItem[],
): Operation[] {
  const ops: Operation[] = [];
  // Glued-up wood should be near its service moisture content first (DOMAIN.md, Wood movement).
  const glued = parts.filter((p) => isPanel(p.stock) && p.stock.boards > 1).map((p) => p.id);
  if (glued.length > 0) {
    ops.push({ id: 'lumber/acclimate', type: 'acclimate', count: 1, partIds: glued });
  }
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
        // A taper that takes off thickness is cut through the width.
        thickness: t.plane ? width : thickness,
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
    part.mortises.forEach((m, i) => {
      ops.push({
        id: `${part.id}/mortise-${i}`,
        type: 'mortise',
        partId: part.id,
        count: part.quantity,
        mortise: i,
        length: m.u1 - m.u0,
        width: m.a1 - m.a0,
        depth: m.depth,
      });
    });
    part.tenons.forEach((t, i) => {
      if (part.ends[t.end].setting !== 0)
        throw new Error(`${part.id}/tenon-${i} is on an angled end`);
      ops.push({
        id: `${part.id}/tenon-${i}`,
        type: 'tenon',
        partId: part.id,
        count: part.quantity,
        tenon: i,
        end: t.end,
        length: t.length,
        tenonThickness: t.thickness,
        width: t.width,
        thickness,
        cheekBack: t.n0,
        cheekFront: thickness - t.n0 - t.thickness,
        shoulderReference: t.v0,
        shoulderFar: width - t.v0 - t.width,
      });
    });
    part.grooves.forEach((g, i) => {
      const L = part.length;
      ops.push({
        id: `${part.id}/groove-${i}`,
        type: 'groove',
        partId: part.id,
        count: part.quantity,
        groove: i,
        length: g.u1 - g.u0,
        width: g.width,
        depth: g.depth,
        stopped: g.u0 > AT_EDGE || g.u1 < L - AT_EDGE,
      });
    });
    part.rabbets.forEach((r, i) => {
      ops.push({
        id: `${part.id}/rabbet-${i}`,
        type: 'rabbet',
        partId: part.id,
        count: part.quantity,
        rabbet: i,
        length: r.edge === 'reference' || r.edge === 'far' ? part.length : width,
        width: r.width,
        depth: r.depth,
      });
    });
    part.recesses.forEach((r, i) => {
      ops.push({
        id: `${part.id}/finger-recess-${i}`,
        type: 'finger-recess',
        partId: part.id,
        count: part.quantity,
        recess: i,
        width: r.width,
        height: r.height,
        depth: r.depth,
      });
    });
    const screws = part.screwHoles;
    if (screws.length > 0) {
      const slots = screws.filter((h) => h.slot > 0);
      ops.push({
        id: `${part.id}/screw-holes`,
        type: 'screw-holes',
        partId: part.id,
        count: part.quantity,
        round: screws.length - slots.length,
        slotted: slots.length,
        slot: Math.max(0, ...slots.map((h) => h.slot)),
        thickness,
      });
    }
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
    if (!item.bolt || item.quantity === undefined) continue;
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
 * stopped dado that runs in from that edge, an end and an edge a stopped rabbet, and none a dado
 * stopped at both ends. Any other dado has no operation type yet and is refused rather than
 * mislabeled.
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
  if (uEdges === 1 && vEdges === 1) {
    return { ...base, type: 'stopped-rabbet', length: across.v, width: across.u };
  }
  if (uEdges === 0 && vEdges === 0) {
    const [length, width] = across.u >= across.v ? [across.u, across.v] : [across.v, across.u];
    return { ...base, type: 'double-stopped-dado', length, width };
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
        thickness: stock.thickness,
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

/** The operation types that put parts together, which a step's action drawing shows. */
export const JOINING_OPERATION_TYPES: readonly OperationType[] = [
  'bolt-holes',
  'dry-fit',
  'glue-assembly',
  'fasten',
];

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
  'stopped-rabbet': 'Stopped rabbet',
  'double-stopped-dado': 'Dado stopped at both ends',
  notch: 'Notch',
  cutout: 'Cutout',
  mortise: 'Mortise',
  tenon: 'Tenon',
  'screw-holes': 'Screw holes',
  groove: 'Groove',
  rabbet: 'Rabbet',
  'finger-recess': 'Finger recess',
  'bolt-holes': 'Bolt holes',
  'ease-edges': 'Ease edges',
  'dry-fit': 'Dry-fit',
  'glue-assembly': 'Glue and clamp',
  fasten: 'Screw together',
  acclimate: 'Let the lumber settle',
  finish: 'Finish',
  'dig-holes': 'Dig holes',
  'level-pads': 'Level pads',
};
