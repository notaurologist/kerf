import { z } from 'zod';
import { FlagCategory } from '../knowledge/categories.ts';
import { PartStock } from '../lumber/partStock.ts';
import { MissingInput } from '../structural/types.ts';
import { CupHinge } from './cupHinge.ts';

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
  /**
   * The build step it is shown on, by the ID in the template's step outline, when the template
   * places it: a question to settle before work that neither drills for its hardware nor first
   * touches its parts, such as the order an assembly goes up in. Otherwise it is placed from its
   * parts and hardware (`steps/build.ts`).
   */
  step: z.string().optional(),
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
  /**
   * Room left past the tenon on one side, so the part can move across its grain there while the
   * tenon is held at the other (DOMAIN.md, Joints that let wood move): the side of the pocket it is
   * at and its length. `u0` to `u1` and `a0` to `a1` are the whole pocket, room included.
   */
  room: z
    .object({ at: z.enum(['u0', 'u1', 'a0', 'a1']), length: z.number().positive() })
    .optional(),
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
 * How a corner's through dovetails are laid out across the boards' shared width, read the same on
 * both boards (`joinery/dovetails.ts`): `tails` tails between a half pin `halfPin` wide at each
 * edge and a pin `pin` wide between each two tails, every pin measured at its narrow end, where
 * the tails are widest. Each tail's sides slope 1 across in `slope` along (the 8 of 1:8).
 */
const dovetailLayout = {
  tails: z.number().int().positive(),
  slope: z.number().positive(),
  halfPin: z.number().positive(),
  pin: z.number().positive(),
};

/**
 * A through-dovetailed corner at a square end, on one of its two boards. Tails are cut through
 * the tail board's thickness, sloped on its faces and widest at its end. Pins are cut on the pin
 * board's end, sloped across its thickness, narrowest at its `outside` face, which lies flush
 * with the tail board's end. `baseline` is how far in from the end the cuts stop: the other
 * board's thickness. `withPart` names the other board by ID or role.
 */
export const Dovetails = z.discriminatedUnion('board', [
  z.object({
    board: z.literal('tails'),
    withPart: z.string(),
    end,
    baseline: z.number(),
    ...dovetailLayout,
  }),
  z.object({
    board: z.literal('pins'),
    withPart: z.string(),
    end,
    baseline: z.number(),
    outside: z.enum(['near', 'far']),
    ...dovetailLayout,
  }),
]);
export type Dovetails = z.infer<typeof Dovetails>;

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

/**
 * A round hole bored into a part with no hardware through it, such as a hole for a bought
 * accessory to stand in or a cup for a hinge. The bit enters at `entry`, on a face, edge, or square
 * end, and goes `depth` along `direction` (a unit vector in the part's frame). A `through` hole
 * comes out on the other side, so `depth` is the wood it crosses; a stopped one has a flat bottom
 * inside the part.
 */
export const BoredHole = z.object({
  /** What the hole is for, in the template's words, for the cut detail: "for a hold-down". */
  use: z.string(),
  diameter: z.number().positive(),
  entry: LocalPoint,
  direction: LocalPoint,
  depth: z.number().positive(),
  through: z.boolean(),
  /**
   * Set on a concealed hinge's cup: the hinge's hardware item ID. The cup is bored with the
   * hinge's own methods, and its plate on the other part names the same item (HingePlate).
   */
  hinge: z.string().optional(),
});
export type BoredHole = z.infer<typeof BoredHole>;

/**
 * Where a concealed hinge's mounting plate screws to a part, opposite the hinge's cup in the part
 * it hangs (BoredHole.hinge): the face it sits on, and each of its screws at (u, v) on that face.
 */
export const HingePlate = z.object({
  hardwareId: z.string(),
  face: z.enum(['near', 'far']),
  screws: z.array(z.object({ u: z.number(), v: z.number() })).min(1),
});
export type HingePlate = z.infer<typeof HingePlate>;

/**
 * Every list defaults to empty. A stored snapshot leaves out an empty one (`snapshot/defaults.ts`)
 * and reading fills it back in, so a list added later changes nothing a template already stores.
 */
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
  markLengths: z.array(z.object({ label: z.string(), value: z.number() })).default([]),
  ends: z.tuple([EndCut, EndCut]),
  /**
   * True when the two end cuts are parallel (the part is a parallelogram, like a sloped post
   * with level cuts at both ends); false when they angle in opposite directions (a trapezoid).
   */
  endsParallel: z.boolean(),
  notes: z.array(z.string()).default([]),
  /**
   * What to look for when choosing its board: IDs of guides in the knowledge base
   * (knowledge/boardSelection.ts), most general first.
   */
  selection: z.array(z.string()).default([]),
  /**
   * Cut from preservative-treated lumber, so its cuts and bolt holes are field-treated (IRC 2021
   * R317.1.1). Absent for untreated wood.
   */
  treated: z.literal(true).optional(),
  /** The edge `across` starts from (Placement), in words, such as "inner edge, against the beam". */
  referenceEdge: z.string(),
  holes: z.array(Hole).default([]),
  boltAreas: z.array(BoltArea).default([]),
  tapers: z.array(Taper).default([]),
  dadoes: z.array(Dado).default([]),
  notches: z.array(Notch).default([]),
  cutouts: z.array(Cutout).default([]),
  mortises: z.array(Mortise).default([]),
  tenons: z.array(Tenon).default([]),
  dovetails: z.array(Dovetails).default([]),
  screwHoles: z.array(ScrewHole).default([]),
  grooves: z.array(EdgeGroove).default([]),
  rabbets: z.array(EdgeRabbet).default([]),
  recesses: z.array(FingerRecess).default([]),
  boredHoles: z.array(BoredHole).default([]),
  hingePlates: z.array(HingePlate).default([]),
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
   * Through-bolts only: diameter, grip (thickness of wood the bolt passes through), the length to
   * buy, and the fittings each bolt takes. The template decides the fittings; shopping lists total
   * them. `length` is absent for fittings `structural/boltLength.ts` has no sizes for, and in plans
   * made before it was computed. `fits` is the shortest and longest bolt that fit, absent in the
   * same cases.
   */
  bolt: z
    .object({
      diameter: z.number(),
      grip: z.number(),
      length: z.number().optional(),
      fits: z.object({ min: z.number(), max: z.number() }).optional(),
      washers: z.number().int(),
      nut: z.enum(['locking', 'standard']),
      cap: z.boolean(),
    })
    .optional(),
  /** A concealed hinge's sizes, as the owner entered them from its maker (`model/cupHinge.ts`). */
  hinge: CupHinge.optional(),
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
