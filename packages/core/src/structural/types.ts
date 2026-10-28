import { z } from 'zod';
import { Citation } from '../design-values/sources.ts';

// Results of structural checks. Every result carries its working (ARCHITECTURE.md, principle 4):
// inputs with sources, formulas, intermediate values, adjustment factors, assumptions, and the
// margin. A margin is the allowable value divided by the computed one; there is no verdict
// (decision 0001). The result shapes are Zod schemas so a stored snapshot can be parsed back.

/** An input the user has to enter or confirm before a check can run. */
export const MissingInput = z.object({
  /** Path a form can point at, such as 'loads.weight'. */
  key: z.string(),
  label: z.string(),
});
export type MissingInput = z.infer<typeof MissingInput>;

/** A value the check needs, or the inputs still missing for it. Never a stand-in default. */
export type Needed<T> = { value: T } | { missing: MissingInput[] };

export function isMissing<T>(n: Needed<T>): n is { missing: MissingInput[] } {
  return 'missing' in n;
}

/** A named number in the working, with where it came from. */
export const Quantity = z.object({
  symbol: z.string(),
  label: z.string(),
  value: z.number(),
  unit: z.string(),
  /** How it was obtained: entered by the user, from the template, a table, or a formula. */
  basis: z.string().optional(),
  sources: z.array(Citation).optional(),
});
export type Quantity = z.infer<typeof Quantity>;

export const DesignValueName = z.enum(['Fb', 'Fv', 'E', 'Emin']);
export type DesignValueName = z.infer<typeof DesignValueName>;

/** One adjustment factor as applied, including factors equal to 1.0, with the reason. */
export const AppliedFactor = z.object({
  symbol: z.string(),
  name: z.string(),
  value: z.number(),
  appliesTo: z.array(DesignValueName),
  reason: z.string(),
  sources: z.array(Citation),
});
export type AppliedFactor = z.infer<typeof AppliedFactor>;

export const CheckKind = z.enum(['beam-bending', 'beam-shear', 'beam-deflection', 'hardware']);
export type CheckKind = z.infer<typeof CheckKind>;

const CheckHeader = {
  kind: CheckKind,
  /** Such as 'Bending'. */
  title: z.string(),
  /** The member or hardware checked, named by the template. */
  subject: z.string(),
  /** The load case used, named by the template. */
  loadCase: z.string(),
};

export const ComputedCheck = z.object({
  ...CheckHeader,
  status: z.literal('computed'),
  inputs: z.array(Quantity),
  formulas: z.array(z.string()),
  steps: z.array(Quantity),
  factors: z.array(AppliedFactor),
  assumptions: z.array(z.string()),
  sources: z.array(Citation),
  /** What the loads produce, and what the member or hardware is allowed. Same units. */
  computed: Quantity,
  allowable: Quantity,
  /** allowable / computed: "margin 2.1x under these assumptions". */
  margin: z.number(),
});
export type ComputedCheck = z.infer<typeof ComputedCheck>;

export const InputNeededCheck = z.object({
  ...CheckHeader,
  status: z.literal('input-needed'),
  missing: z.array(MissingInput),
});
export type InputNeededCheck = z.infer<typeof InputNeededCheck>;

/** The check cannot be computed for a reason other than missing input. */
export const NotComputedCheck = z.object({
  ...CheckHeader,
  status: z.literal('not-computed'),
  reason: z.string(),
  sources: z.array(Citation),
});
export type NotComputedCheck = z.infer<typeof NotComputedCheck>;

export const CheckResult = z.discriminatedUnion('status', [
  ComputedCheck,
  InputNeededCheck,
  NotComputedCheck,
]);
export type CheckResult = z.infer<typeof CheckResult>;

/** Formats a margin the way results read it: "margin 2.1x". */
export function formatMargin(margin: number): string {
  return `margin ${margin.toFixed(1)}x`;
}
