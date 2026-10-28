import type { Citation } from '../design-values/sources.ts';

// Results of structural checks. Every result carries its working (ARCHITECTURE.md, principle 4):
// inputs with sources, formulas, intermediate values, adjustment factors, assumptions, and the
// margin. A margin is the allowable value divided by the computed one; there is no verdict
// (decision 0001).

/** An input the user has to enter or confirm before a check can run. */
export interface MissingInput {
  /** Path a form can point at, such as 'loads.weight'. */
  key: string;
  label: string;
}

/** A value the check needs, or the inputs still missing for it. Never a stand-in default. */
export type Needed<T> = { value: T } | { missing: MissingInput[] };

export function isMissing<T>(n: Needed<T>): n is { missing: MissingInput[] } {
  return 'missing' in n;
}

/** A named number in the working, with where it came from. */
export interface Quantity {
  symbol: string;
  label: string;
  value: number;
  unit: string;
  /** How it was obtained: entered by the user, from the template, a table, or a formula. */
  basis?: string;
  sources?: Citation[];
}

export type DesignValueName = 'Fb' | 'Fv' | 'E' | 'Emin';

/** One adjustment factor as applied, including factors equal to 1.0, with the reason. */
export interface AppliedFactor {
  symbol: string;
  name: string;
  value: number;
  appliesTo: DesignValueName[];
  reason: string;
  sources: Citation[];
}

export type CheckKind = 'beam-bending' | 'beam-shear' | 'beam-deflection' | 'hardware';

interface CheckHeader {
  kind: CheckKind;
  /** Such as 'Bending'. */
  title: string;
  /** The member or hardware checked, named by the template. */
  subject: string;
  /** The load case used, named by the template. */
  loadCase: string;
}

export interface ComputedCheck extends CheckHeader {
  status: 'computed';
  inputs: Quantity[];
  formulas: string[];
  steps: Quantity[];
  factors: AppliedFactor[];
  assumptions: string[];
  sources: Citation[];
  /** What the loads produce, and what the member or hardware is allowed. Same units. */
  computed: Quantity;
  allowable: Quantity;
  /** allowable / computed: "margin 2.1x under these assumptions". */
  margin: number;
}

export interface InputNeededCheck extends CheckHeader {
  status: 'input-needed';
  missing: MissingInput[];
}

/** The check cannot be computed for a reason other than missing input. */
export interface NotComputedCheck extends CheckHeader {
  status: 'not-computed';
  reason: string;
  sources: Citation[];
}

export type CheckResult = ComputedCheck | InputNeededCheck | NotComputedCheck;

/** Formats a margin the way results read it: "margin 2.1x". */
export function formatMargin(margin: number): string {
  return `margin ${margin.toFixed(1)}x`;
}
