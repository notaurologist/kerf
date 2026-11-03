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

/** The entered inputs `keys` names, or each one not entered with its label. */
export function need<I extends object, K extends keyof I & string>(
  inputs: I,
  labels: Readonly<Record<keyof I, string>>,
  ...keys: K[]
): Needed<{ [P in K]: NonNullable<I[P]> }> {
  const missing: MissingInput[] = keys
    .filter((k) => inputs[k] === undefined)
    .map((k) => ({ key: k, label: labels[k] }));
  if (missing.length > 0) return { missing };
  return { value: inputs as { [P in K]: NonNullable<I[P]> } };
}

export function mapNeeded<T, U>(n: Needed<T>, f: (value: T) => U): Needed<U> {
  return 'value' in n ? { value: f(n.value) } : n;
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
  /**
   * The structural input it is, by its path in the form, as in a missing input's key. A display
   * reads it against the project's suggestions to say whether the value was entered or suggested.
   */
  input: z.string().optional(),
});
export type Quantity = z.infer<typeof Quantity>;

export const DesignValueName = z.enum(['Fb', 'Fv', 'Fc', 'E', 'Emin']);
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

export const CheckKind = z.enum([
  'beam-bending',
  'beam-shear',
  'beam-deflection',
  'column',
  'hardware',
]);
export type CheckKind = z.infer<typeof CheckKind>;

/**
 * The value of a load factor, such as a dynamic factor, at which a check's margin reaches 1.0 with
 * every other input as entered. 0 when the loads the factor does not multiply reach margin 1.0 on
 * their own. Shown beside the check and the factor's field, so a factor can be chosen against it.
 */
export const BreakEven = z.object({
  /** The factor's input, so a form can point at it. */
  key: z.string(),
  symbol: z.string(),
  label: z.string(),
  value: z.number().min(0),
});
export type BreakEven = z.infer<typeof BreakEven>;

/**
 * The same check with the member in another stock and every other input as entered, so the stock
 * can be chosen against the break-even factor. The template lists the stock; it does not choose.
 */
const OtherStock = z.object({
  /** The member in that stock, as the check names its subject. */
  subject: z.string(),
  /** Missing while the factor is. */
  margin: z.number().optional(),
  breakEven: BreakEven,
});
export type OtherStock = z.infer<typeof OtherStock>;

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
  breakEven: BreakEven.optional(),
  /** The check in the next deeper stock the template can build; empty when there is none. */
  deeperStock: z.array(OtherStock).optional(),
});
export type ComputedCheck = z.infer<typeof ComputedCheck>;

export const InputNeededCheck = z.object({
  ...CheckHeader,
  status: z.literal('input-needed'),
  missing: z.array(MissingInput),
  /** Known once only the factor is missing. */
  breakEven: BreakEven.optional(),
  deeperStock: z.array(OtherStock).optional(),
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

/**
 * A break-even factor as results read it, rounded down to 0.1 so the margin is 1.0 or more at the
 * value shown: "margin 1.0 or more while the dynamic factor is 2.1 or less".
 */
export function formatBreakEven(b: BreakEven): string {
  const name = b.label.toLowerCase();
  if (b.value === 0) {
    return `below margin 1.0 at any ${name}: the loads it does not multiply reach margin 1.0 on their own`;
  }
  return `margin 1.0 or more while the ${name} is ${formatBreakEvenLimit(b)}`;
}

/**
 * The factor alone, for a table of checks under a heading that names it: "2.1 or less", or
 * "no value" with the reason when the margin is below 1.0 at any factor.
 */
export function formatBreakEvenLimit(b: BreakEven): string {
  if (b.value === 0)
    return 'no value: the loads it does not multiply reach margin 1.0 on their own';
  // The small allowance keeps a value such as 2.0 from showing as 1.9 after floating-point error.
  const shown = Math.floor(b.value * 10 + 1e-9) / 10;
  return `${shown.toFixed(1)} or less`;
}
