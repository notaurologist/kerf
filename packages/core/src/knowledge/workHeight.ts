import type { Citation } from '../design-values/sources.ts';
import type { FormField } from '../model/form.ts';
import type { SuggestionBasis } from '../model/questions.ts';

// The height of a work surface for hand work, suggested from the owner's height (hard rule 3 does
// not cover it; it is a starting suggestion the owner can change).

/**
 * Wrist height, floor to the wrist with the arms hanging at the sides, as a share of standing
 * height. The 2012 Army survey's medians give 84.7 / 175.5 = 0.483 for men and
 * 79.4 / 162.6 = 0.488 for women; 0.485 sits between them.
 */
export const WRIST_HEIGHT_PER_STATURE = 0.485;

export const WORK_HEIGHT_CITATIONS = [
  { source: 'fww-work-at-right-height-2017', locator: 'Opening section, on bench height' },
  { source: 'popular-woodworking-best-bench-height-2019', locator: 'Whole post' },
  { source: 'ansur-ii-explorer', locator: 'Stature and Wrist Height, men and women' },
] as const satisfies readonly Citation[];

const BASIS: SuggestionBasis = {
  kind: 'rule-of-thumb',
  rule: 'a surface for hand work at about wrist height (Fine Woodworking, Becksvoort, 2017; Popular Woodworking, Tolpin, 2019), with wrist height taken as 0.485 of your height from the 2012 Army anthropometric survey’s medians',
};

const NOTE =
  'Your own wrist may sit higher or lower than average. For a closer fit, stand in the shoes you work in, let your arms hang, and measure from the floor to the crease of your wrist. Lower suits heavy hand planing; higher suits sawing joinery and close work.';

/** The question that asks for the owner's height. */
export function standingHeightField(path: string): FormField {
  return {
    path,
    label: 'Your height',
    kind: 'length',
    help: 'Standing, without shoes, as on a doctor’s chart. Enter feet and inches, such as 5\' 10", or inches, such as 70.',
  };
}

/**
 * A work surface's height at the owner's wrist, from their standing height: 0.485 of it, to the
 * nearest 1/16" the form takes.
 */
export function wristWorkHeight(stature: number): {
  value: number;
  basis: SuggestionBasis;
  note: string;
} {
  if (!(stature > 0)) throw new Error(`A height must be more than zero, not ${stature}.`);
  return {
    value: Math.round(stature * WRIST_HEIGHT_PER_STATURE * 16) / 16,
    basis: BASIS,
    note: NOTE,
  };
}
