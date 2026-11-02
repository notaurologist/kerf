import { buildFromForm } from '../../model/form.ts';
import { type Suggestion, type SuggestionBasis, suggestedValues } from '../../model/questions.ts';
import { type BoltJoint, shortfalls } from '../../structural/boltDistances.ts';
import { formatLength } from '../../units/length.ts';
import { BOLT_DIAMETERS, SWING_SET_FORM } from './form.ts';
import { generate } from './template.ts';

// Bolt sizes for a new swing set's starting questions (#389; hard rule 3 as amended in #355, and
// decision 0016 as amended): the largest diameter the form offers whose joint, laid out by the
// template's own rule on the suggested frame, has every distance within its NDS 2024 values. It
// is geometry, not capacity (0016): the note says so, and the size is the owner's to settle.

/** Bolts per crossbar and gusset joint: the worked example's two, never fewer. */
const PER_JOINT = 2;

const FITS: SuggestionBasis = {
  kind: 'source',
  citation:
    "National Design Specification (NDS) for Wood Construction (2024), Tables 12.5.1A to 12.5.1D: the largest bolt whose edge, end, and spacing distances in Kerf's layout of this frame are all within them",
};
const NOTE =
  'Kerf computes no bolt capacity; settle the size with an experienced builder. The structural review shows each distance.';

/** The joints, laid out with every bolt at `diameter`, or null when the frame does not generate. */
function jointsAt(params: Record<string, unknown>, diameter: number): BoltJoint[] | null {
  const made = generate({
    ...params,
    hardware: {
      legBoltDiameter: diameter,
      crossbarBolts: { diameter, perJoint: PER_JOINT },
      gussetBolts: { diameter, perJoint: PER_JOINT },
      // Required to generate a built-up beam; it does not change these joints' distances, and it
      // is not suggested.
      plyBolts: { diameter, count: 1 },
    },
  });
  return made.ok ? (made.output.boltLayout ?? null) : null;
}

const fits = (joint: BoltJoint | undefined) =>
  joint?.distances.every((d) => shortfalls(d).length === 0);

/** The largest diameter that fits each joint, by its title, or null where none does. */
function largestFitting(params: Record<string, unknown>) {
  const titles = ['Leg to beam', 'Crossbar to leg', 'Gusset to leg'] as const;
  const found = new Map<string, number | null>(titles.map((t) => [t, null]));
  // Largest first, so the first that fits a joint is its suggestion.
  for (const diameter of [...BOLT_DIAMETERS].sort((a, b) => b - a)) {
    const joints = jointsAt(params, diameter);
    if (!joints) return null;
    for (const title of titles) {
      if (found.get(title) === null && fits(joints.find((j) => j.title === title))) {
        found.set(title, diameter);
      }
    }
  }
  return found;
}

/**
 * Bolt suggestions for the frame the other suggestions describe. With no frame (a yard too small
 * for any beam), or no size that fits a joint, the field is left empty and the note says why.
 */
export function boltSuggestions(others: readonly Suggestion[]): Suggestion[] {
  const { params: text } = suggestedValues(SWING_SET_FORM, others);
  const params = buildFromForm(SWING_SET_FORM.params, text);
  const found = largestFitting(params);
  const smallest = formatLength(Math.min(...BOLT_DIAMETERS));
  const diameter = (path: string, title: string): Suggestion => {
    const d = found?.get(title) ?? null;
    return {
      from: 'params',
      path,
      value: d,
      basis: FITS,
      note:
        d !== null
          ? NOTE
          : found
            ? `Even a ${smallest} bolt leaves a distance outside NDS 2024 at this joint; settle it with an experienced builder.`
            : 'Kerf needs the frame to lay the bolts out.',
    };
  };
  const count = (path: string): Suggestion => ({
    from: 'params',
    path,
    value: PER_JOINT,
    basis: { kind: 'example' },
    note: 'The bolt layout checks this count with the size above.',
  });
  return [
    diameter('hardware.legBoltDiameter', 'Leg to beam'),
    diameter('hardware.crossbarBolts.diameter', 'Crossbar to leg'),
    count('hardware.crossbarBolts.perJoint'),
    diameter('hardware.gussetBolts.diameter', 'Gusset to leg'),
    count('hardware.gussetBolts.perJoint'),
  ];
}
