import { z } from 'zod';
import { Stock } from '../lumber/stock.ts';

// Shared shapes of template output. Each is a Zod schema with its type inferred from it, so the
// same definition types the code and parses a stored project snapshot (decision 0003).

/** A problem with the parameters that stops generation. */
export const Issue = z.object({
  code: z.string(),
  message: z.string(),
  /** Parameter names involved, so a form can point at them. */
  params: z.array(z.string()),
});
export type Issue = z.infer<typeof Issue>;

/** Expert-check categories from DOMAIN.md. */
export const FlagCategory = z.enum([
  'table-saw',
  'router',
  'jointer-planer-lathe',
  'load-bearing',
  'dynamic-loads',
  'wood-movement',
  'finishes',
  'dust-and-species',
]);
export type FlagCategory = z.infer<typeof FlagCategory>;

export const FLAG_CATEGORY_LABELS: Record<FlagCategory, string> = {
  'table-saw': 'Table saw',
  router: 'Router technique',
  'jointer-planer-lathe': 'Jointer, planer, or lathe',
  'load-bearing': 'Load-bearing design',
  'dynamic-loads': 'Dynamic loads',
  'wood-movement': 'Wood movement',
  finishes: 'Finishes',
  'dust-and-species': 'Dust and species',
};

/** Something to ask an experienced builder about, and why (DOMAIN.md, Expert-check categories). */
export const Flag = z.object({
  category: FlagCategory,
  ask: z.string(),
  why: z.string(),
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
   * and measured from the face. Plans made before template version 4 do not say.
   */
  measuredFrom: z.enum(['reference-edge', 'reference-face']).optional(),
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
  diameter: z.number(),
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
 * A straight cut along a part rather than across it, such as a leg's flush cut. It runs through
 * the thickness, from `start` on the reference edge to `end` on the first end cut, and removes
 * the wood between that line and the corner where those two meet.
 */
export const Taper = z.object({
  description: z.string(),
  start: z.object({ u: z.number(), v: z.number() }),
  end: z.object({ u: z.number(), v: z.number() }),
  /** The angle between the taper and the reference edge, in degrees. */
  angleToEdge: z.number(),
});
export type Taper = z.infer<typeof Taper>;

export const Part = z.object({
  id: z.string(),
  /** Names the part in the cut list and every drawing, assigned in cut-list order (#66). */
  letter: z.string(),
  name: z.string(),
  /** What the part does in its template, such as 'leg'. Set by the template. */
  role: z.string(),
  stock: Stock,
  quantity: z.number().int(),
  /** Overall length, long point to long point: the stock each piece needs. */
  length: z.number(),
  /** Other lengths to mark, such as each edge of an angled part. */
  markLengths: z.array(z.object({ label: z.string(), value: z.number() })),
  ends: z.tuple([EndCut, EndCut]),
  /**
   * True when the two end cuts are parallel (the part is a parallelogram, like a leg with level
   * cuts at both ends); false when they angle in opposite directions (a trapezoid).
   */
  endsParallel: z.boolean(),
  notes: z.array(z.string()),
  /** The edge `across` starts from (Placement), in words, such as "inner edge, against the beam". */
  referenceEdge: z.string().optional(),
  holes: z.array(Hole).optional(),
  boltAreas: z.array(BoltArea).optional(),
  tapers: z.array(Taper).optional(),
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
  quantity: z.number().int(),
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
  /** The specific design element, such as 'Leg-to-beam bolt, each frame'. */
  element: z.string(),
  confirm: z.string(),
  why: z.string(),
});
export type ChecklistItem = z.infer<typeof ChecklistItem>;
