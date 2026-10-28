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
});
export type EndCut = z.infer<typeof EndCut>;

export const Part = z.object({
  id: z.string(),
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
});
export type Part = z.infer<typeof Part>;

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

/** Something to confirm with an experienced builder, tied to one element of the design. */
export const ChecklistItem = z.object({
  category: ChecklistCategory,
  /** The specific design element, such as 'Leg-to-beam bolt, each frame'. */
  element: z.string(),
  confirm: z.string(),
  why: z.string(),
});
export type ChecklistItem = z.infer<typeof ChecklistItem>;
