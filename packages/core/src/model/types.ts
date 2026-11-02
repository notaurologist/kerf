import { z } from 'zod';
import { FlagCategory } from '../knowledge/categories.ts';
import { PartStock } from '../lumber/panel.ts';
import { MissingInput } from '../structural/types.ts';

// Shared shapes of template output. Each is a Zod schema with its type inferred from it, so the
// same definition types the code and parses a project snapshot (decision 0003). These are what a
// template generates now, so every field is required. A template whose older snapshots lack a
// field relaxes it in its own stored-output schema (`TemplateDefinition.storedOutputs`).

/** A problem with the parameters that stops generation. */
export const Issue = z.object({
  code: z.string(),
  message: z.string(),
  /** Parameter names involved, so a form can point at them. */
  params: z.array(z.string()),
});
export type Issue = z.infer<typeof Issue>;

/**
 * The parts and hardware items a flag or checklist item concerns, by ID (#51), so a cut card or
 * build step can show it without matching on its words. Both are empty when it concerns the whole
 * design.
 */
const concerns = {
  partIds: z.array(z.string()),
  hardwareIds: z.array(z.string()),
};

/** Something to ask an experienced builder about, and why (DOMAIN.md, Expert-check categories). */
export const Flag = z.object({
  category: FlagCategory,
  ask: z.string(),
  why: z.string(),
  ...concerns,
});
export type Flag = z.infer<typeof Flag>;

export const EndCut = z.object({
  /** Saw setting in degrees, miter-saw convention: 0 is square (DOMAIN.md, Units). */
  setting: z.number(),
  /** What the cut is, without its angle; displays add the angle from `setting`. */
  description: z.string(),
  /**
   * Which the angle is laid out from (DOMAIN.md, Units): `reference-edge` for a miter, drawn on
   * the face and measured from the reference edge; `reference-face` for a bevel, drawn on the edge
   * and measured from the face.
   */
  measuredFrom: z.enum(['reference-edge', 'reference-face']),
});
export type EndCut = z.infer<typeof EndCut>;

/**
 * A point or direction in a part's own frame (Placement): u along its length from the first end,
 * v across its width from the reference edge, n through its thickness. Decimal inches.
 */
export const LocalPoint = z.object({ u: z.number(), v: z.number(), n: z.number() });
export type LocalPoint = z.infer<typeof LocalPoint>;

/** A hole drilled in a part, for the hardware item that passes through it. */
export const Hole = z.object({
  hardwareId: z.string(),
  /** The hole to drill: the bolt's diameter plus the oversize NDS 12.1.3.2 allows (#110). */
  diameter: z.number(),
  /** The bolt that goes through it. */
  boltDiameter: z.number(),
  /** Where the drill enters, in the part's frame. */
  entry: LocalPoint,
  /** The drilling direction, a unit vector in the part's frame. */
  direction: LocalPoint,
  /** Length of the hole through the part, from entry to exit. */
  length: z.number(),
});
export type Hole = z.infer<typeof Hole>;

/**
 * Where a joint's bolts go when the template does not fix each position: the outline of the
 * area two parts share, on the part's face, in (u, v). The bolts are laid out within it with an
 * experienced builder (an expert check).
 */
export const BoltArea = z.object({
  hardwareId: z.string(),
  /** How many of the hardware item's bolts go in this area. */
  count: z.number().int().positive(),
  diameter: z.number(),
  /** The part it is bolted to. */
  withPart: z.string(),
  outline: z.array(z.object({ u: z.number(), v: z.number() })).min(3),
});
export type BoltArea = z.infer<typeof BoltArea>;

/**
 * A straight cut along a part rather than across it, such as a taper on a post. It runs through
 * the thickness, from `start` on the reference edge to `end` on the first end cut, and removes
 * the wood between that line and the corner where those two meet.
 */
export const Taper = z.object({
  description: z.string(),
  start: z.object({ u: z.number(), v: z.number() }),
  end: z.object({ u: z.number(), v: z.number() }),
  /** The angle between the taper and the reference edge, in degrees. */
  angleToEdge: z.number(),
  /**
   * Set when the taper takes off thickness rather than width: it is cut into the near face, through
   * the width, and `start` and `end` give n in place of v. Left out for one that takes off width.
   */
  plane: z.literal('thickness').optional(),
});
export type Taper = z.infer<typeof Taper>;

/** Tapers that take off width, which the face outline shows. */
export const widthTapers = (tapers: readonly Taper[]) => tapers.filter((t) => !t.plane);

const end = z.union([z.literal(0), z.literal(1)]);

/**
 * A flat-bottomed groove in one face of a part, such as the one that houses a shelf's end. It
 * covers u from `u0` to `u1` and v from `v0` to `v1` in the part's frame, `depth` deep. One that
 * reaches two opposite edges runs through; one that reaches a single edge stops short of the
 * other. Edges are the stock's width and the part's square ends.
 */
export const Dado = z.object({
  /** The part whose end or edge it houses. */
  withPart: z.string(),
  /** The face it is cut into: `near` at n = 0, `far` at n = the stock's thickness. */
  face: z.enum(['near', 'far']),
  u0: z.number(),
  u1: z.number(),
  v0: z.number(),
  v1: z.number(),
  depth: z.number(),
});
export type Dado = z.infer<typeof Dado>;

/**
 * A rectangle cut out of a corner where a square end meets an edge, through the thickness:
 * `along` the part from the end, and `across` it from the edge.
 */
export const Notch = z.object({
  end,
  edge: z.enum(['reference', 'far']),
  along: z.number(),
  across: z.number(),
});
export type Notch = z.infer<typeof Notch>;

/**
 * A rectangle cut out of a square end, through the thickness, from v0 to v1 and `depth` in from
 * the end, such as the opening between two feet.
 */
export const Cutout = z.object({
  end,
  v0: z.number(),
  v1: z.number(),
  depth: z.number(),
});
export type Cutout = z.infer<typeof Cutout>;

/**
 * A rectangular pocket that houses another part's tenon (Tenon), cut into a face or an edge. It
 * runs along the part from `u0` to `u1`, and across its side from `a0` to `a1`: v on a face (from
 * the reference edge), n on an edge (from the near face). `depth` is into the part, square to its
 * side.
 */
export const Mortise = z.object({
  /** The part whose tenon it houses. */
  withPart: z.string(),
  /** Faces are at n = 0 (`near`) and n = the stock's thickness (`far`); edges at v = 0 and v = W. */
  side: z.enum(['near', 'far', 'reference-edge', 'far-edge']),
  u0: z.number(),
  u1: z.number(),
  a0: z.number(),
  a1: z.number(),
  depth: z.number(),
});
export type Mortise = z.infer<typeof Mortise>;

/**
 * A tongue on a square end that fits a mortise: `length` out from its shoulders, `thickness` from
 * n0 (the near face), and `width` from v0 (the reference edge). The part's length includes it.
 */
export const Tenon = z.object({
  end,
  length: z.number(),
  n0: z.number(),
  thickness: z.number(),
  v0: z.number(),
  width: z.number(),
});
export type Tenon = z.infer<typeof Tenon>;

/**
 * A hole a wood screw passes through, square to the part's face at (u, v): round, or a slot
 * `slot` longer than the round hole, toward the second end (`along`) or the far edge (`across`),
 * so the part the screw holds can move (DOMAIN.md, Joints that let wood move).
 */
export const ScrewHole = z.object({
  hardwareId: z.string(),
  u: z.number(),
  v: z.number(),
  slot: z.number(),
  direction: z.enum(['along', 'across']),
});
export type ScrewHole = z.infer<typeof ScrewHole>;

/**
 * A groove along an edge, such as the one a frame's panel floats in: `width` across the edge from
 * n0 (the near face), `depth` into the part, from u0 to u1; through when it reaches both ends.
 */
export const EdgeGroove = z.object({
  edge: z.enum(['reference', 'far']),
  u0: z.number(),
  u1: z.number(),
  n0: z.number(),
  width: z.number(),
  depth: z.number(),
});
export type EdgeGroove = z.infer<typeof EdgeGroove>;

/**
 * A rabbet along an edge or end, cut into one face the whole way along it: `width` in from the
 * edge, `depth` down from the face, such as the step that makes a panel's tongue.
 */
export const EdgeRabbet = z.object({
  edge: z.enum(['reference', 'far', 'first-end', 'second-end']),
  face: z.enum(['near', 'far']),
  width: z.number(),
  depth: z.number(),
});
export type EdgeRabbet = z.infer<typeof EdgeRabbet>;

/** A shallow scoop in a face to pull with, centered at (u, v): `width` along u, `height` along v. */
export const FingerRecess = z.object({
  face: z.enum(['near', 'far']),
  u: z.number(),
  v: z.number(),
  width: z.number(),
  height: z.number(),
  depth: z.number(),
});
export type FingerRecess = z.infer<typeof FingerRecess>;

export const Part = z.object({
  id: z.string(),
  /** Names the part in the cut list and every drawing, assigned in cut-list order (#66). */
  letter: z.string(),
  name: z.string(),
  /** What the part does in its template, such as 'post'. Set by the template. */
  role: z.string(),
  stock: PartStock,
  quantity: z.number().int(),
  /** Overall length, long point to long point: the stock each piece needs. */
  length: z.number(),
  /** Other lengths to mark, such as each edge of an angled part. */
  markLengths: z.array(z.object({ label: z.string(), value: z.number() })),
  ends: z.tuple([EndCut, EndCut]),
  /**
   * True when the two end cuts are parallel (the part is a parallelogram, like a sloped post
   * with level cuts at both ends); false when they angle in opposite directions (a trapezoid).
   */
  endsParallel: z.boolean(),
  notes: z.array(z.string()),
  /**
   * What to look for when choosing its board: IDs of guides in the knowledge base
   * (knowledge/boardSelection.ts), most general first.
   */
  selection: z.array(z.string()),
  /** The edge `across` starts from (Placement), in words, such as "inner edge, against the beam". */
  referenceEdge: z.string(),
  holes: z.array(Hole),
  boltAreas: z.array(BoltArea),
  tapers: z.array(Taper),
  dadoes: z.array(Dado),
  notches: z.array(Notch),
  cutouts: z.array(Cutout),
  /** Left out when there are none, so parts stored before them read unchanged. */
  mortises: z.array(Mortise).optional(),
  tenons: z.array(Tenon).optional(),
  screwHoles: z.array(ScrewHole).optional(),
  grooves: z.array(EdgeGroove).optional(),
  rabbets: z.array(EdgeRabbet).optional(),
  recesses: z.array(FingerRecess).optional(),
});
export type Part = z.infer<typeof Part>;

/** A point or direction in a template's 3D coordinates, in decimal inches. */
export const Vec3 = z.object({ x: z.number(), y: z.number(), z: z.number() });
export type Vec3 = z.infer<typeof Vec3>;

/**
 * Where one instance of a part sits in 3D (DOMAIN.md, Geometry). Each part has a local frame:
 *
 * - `along` runs the part's length, from its first end to its second (the order of `ends`).
 * - `across` runs its width (the stock's width), from its reference edge: the edge on which the
 *   first end cut has its long point.
 * - `through` runs its thickness, so that along × across = through (right-handed).
 * - `origin` is the corner where the first end meets the reference edge, on the face where
 *   `through` starts.
 *
 * With that frame, the part's shape follows from its own data. A point (u, v, n) with
 * 0 ≤ v ≤ width and 0 ≤ n ≤ thickness is in the part when u is between its end cuts: the first
 * at u = v·tan(setting₁), the second at u = length − (width − v)·tan(setting₂) when the ends are
 * parallel, or u = length − v·tan(setting₂) when they are not. The world point is
 * origin + u·along + v·across + n·through. The three axes are unit vectors.
 */
export const Placement = z.object({
  partId: z.string(),
  /** Which of the part's `quantity` pieces this is, from 0. */
  instance: z.number().int().nonnegative(),
  origin: Vec3,
  along: Vec3,
  across: Vec3,
  through: Vec3,
});
export type Placement = z.infer<typeof Placement>;

export const HardwareItem = z.object({
  id: z.string(),
  name: z.string(),
  /** Absent while the input it is counted from is not entered; `quantityNeeded` names it. */
  quantity: z.number().int().optional(),
  /**
   * The input the quantity waits for, such as a count read from the maker's instructions at the
   * store. The item is still listed, so the plan can be made and shopped for without it.
   */
  quantityNeeded: MissingInput.optional(),
  /**
   * Through-bolts only: diameter, grip (thickness of wood the bolt passes through), and the
   * fittings each bolt takes. The template decides the fittings; shopping lists total them.
   */
  bolt: z
    .object({
      diameter: z.number(),
      grip: z.number(),
      washers: z.number().int(),
      nut: z.enum(['locking', 'standard']),
      cap: z.boolean(),
    })
    .optional(),
  /** True when the item carries load and its size was confirmed with an experienced builder. */
  structural: z.boolean(),
  notes: z.array(z.string()),
  /**
   * Where it is found in a store, such as "Bolts and fittings" (#59): the template's words, shown
   * as a heading on the store checklist.
   */
  group: z.string(),
});
export type HardwareItem = z.infer<typeof HardwareItem>;

export type GenerateResult<Output> = { ok: true; output: Output } | { ok: false; issues: Issue[] };

/** Checklist-only categories (DOMAIN.md, Structural checks, Checklist only). */
export const ChecklistCategory = z.enum([
  'bolted-connections',
  'racking',
  'tipping-and-anchoring',
  'long-term-condition',
  'lumber-quality',
  'check-assumptions',
]);
export type ChecklistCategory = z.infer<typeof ChecklistCategory>;

export const CHECKLIST_CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  'bolted-connections': 'Bolted connections',
  racking: 'Racking',
  'tipping-and-anchoring': 'Tipping and anchoring',
  'long-term-condition': 'Long-term condition',
  'lumber-quality': 'Lumber quality',
  'check-assumptions': 'Assumptions to confirm',
};

/** Something to confirm with an experienced builder, tied to one element of the design. */
export const ChecklistItem = z.object({
  category: ChecklistCategory,
  /** The specific design element, such as 'Post-to-beam bolt, each end'. */
  element: z.string(),
  confirm: z.string(),
  why: z.string(),
  ...concerns,
});
export type ChecklistItem = z.infer<typeof ChecklistItem>;
