import { z } from 'zod';
import type { Citation } from '../design-values/sources.ts';
import type { MissingInput } from '../structural/types.ts';
import { formatLength } from '../units/length.ts';
import type { FormField } from './form.ts';
import type { Suggestion, SuggestionBasis } from './questions.ts';
import type { HardwareItem, Issue } from './types.ts';

// Bought side-mount drawer slides, which size the drawer box: the box is its opening's width less
// the slide's clearance on each side, and as deep as the longest slide sold that fits the depth
// the opening leaves for it (DOMAIN.md, Drawer slides). The figures are the slide maker's, read
// from its instructions or package (hard rule 3). Until the owner has slides, a template may
// suggest typical figures from a woodworking reference, which stay suggestions until the owner
// confirms or changes them. A figure left out makes the box's size input needed.

const SIXTY_FOURTH = 1 / 64;

export const DrawerSlide = z.object({
  /** The space between the box's side and the opening's side, on each side. */
  sideClearance: z.number().min(SIXTY_FOURTH).max(2).optional(),
  /** The shortest slide sold. */
  shortest: z.number().min(1).max(60).optional(),
  /** The longest slide sold; the same as the shortest when only one length is bought. */
  longest: z.number().min(1).max(60).optional(),
  /** How far apart the lengths sold are, from the shortest. Not needed for a single length. */
  step: z.number().min(SIXTY_FOURTH).max(12).optional(),
});
export type DrawerSlide = z.infer<typeof DrawerSlide>;

const FROM_THE_SLIDE =
  "Read it in the slide's instructions or on its package. Kerf takes inches: divide millimeters by 25.4.";

const LABELS = {
  sideClearance: 'Clearance each side',
  shortest: 'Shortest length sold',
  longest: 'Longest length sold',
  step: 'Lengths sold every',
} as const satisfies Record<keyof DrawerSlide, string>;

const severalLengths = (path: string) => (value: (p: string) => string) => {
  const shortest = value(`${path}.shortest`);
  const longest = value(`${path}.longest`);
  return shortest === '' || longest === '' || shortest !== longest;
};

/**
 * The form fields for one kind of side-mount slide, under `path` in the template's parameters
 * (such as `slides`), each entered or confirmed by the owner from the slide's instructions.
 */
export function drawerSlideFields(path: string): FormField[] {
  return [
    {
      path: `${path}.sideClearance`,
      label: LABELS.sideClearance,
      kind: 'length',
      help: `The space the slide takes between the drawer box's side and the opening's side, on each side. ${FROM_THE_SLIDE} It may be given as how much narrower than the opening to make the box: halve that.`,
      confirmed: true,
    },
    {
      path: `${path}.shortest`,
      label: LABELS.shortest,
      kind: 'length',
      help: `The shortest length the slide is sold in, from the lengths listed on its package, in its instructions, or where it is sold. Once you have bought slides, enter their length here and as the longest.`,
      confirmed: true,
    },
    {
      path: `${path}.longest`,
      label: LABELS.longest,
      kind: 'length',
      help: 'The longest length the slide is sold in, from the same list on its package or in its instructions. Kerf makes each box as deep as the longest length sold that fits its opening.',
      confirmed: true,
    },
    {
      path: `${path}.step`,
      label: LABELS.step,
      kind: 'length',
      help: 'How far apart the lengths sold are, such as 2" for 10", 12", 14", and so on: the difference between two lengths next to each other in the list on its package or in its instructions.',
      when: severalLengths(path),
      confirmed: true,
    },
  ];
}

export const DRAWER_SLIDE_SOURCES = {
  sideClearance: [
    { source: 'woodcraft-drawer-slides-2014', locator: 'Slide and drawer sizes' },
    { source: 'woodsmith-metal-drawer-slides-2019', locator: 'Paragraph on side clearance' },
  ],
  lengths: [{ source: 'woodcraft-drawer-slides-2014', locator: 'Slide and drawer sizes' }],
} as const satisfies Record<string, readonly Citation[]>;

/**
 * Typical figures for ball-bearing side-mount slides, for a template to suggest until the owner
 * has slides (owner, November 4, 2026). Each is a suggestion for the owner to confirm against the
 * slides they buy, never a default.
 */
export const TYPICAL_DRAWER_SLIDE = {
  sideClearance: {
    value: 0.5,
    basis: {
      kind: 'source',
      citation:
        'Woodcraft Magazine, “Drawer Slides: The Inside Story” (Ken Burton, 2014), and Woodsmith, “Metal Drawer Slides” (Ted Raife, 2019): most side-mount slides take 1/2" on each side of the box, read November 4, 2026',
    } satisfies SuggestionBasis,
  },
  lengths: {
    shortest: 10,
    longest: 28,
    step: 2,
    basis: {
      kind: 'source',
      citation:
        'Woodcraft Magazine, “Drawer Slides: The Inside Story” (Ken Burton, 2014): most slides are sold in even lengths from 10" to 28", read November 4, 2026',
    } satisfies SuggestionBasis,
  },
  note: "Typical figures until you buy slides. Check them against the slides' instructions or package before building the boxes.",
} as const;

/** The typical figures as suggestions for the slide fields under `path` in the parameters. */
export function typicalDrawerSlideSuggestions(path: string): Suggestion[] {
  const { sideClearance, lengths, note } = TYPICAL_DRAWER_SLIDE;
  const suggest = (key: keyof DrawerSlide, value: number, basis: SuggestionBasis): Suggestion => ({
    from: 'params',
    path: `${path}.${key}`,
    value,
    basis,
    note,
  });
  return [
    suggest('sideClearance', sideClearance.value, sideClearance.basis),
    suggest('shortest', lengths.shortest, lengths.basis),
    suggest('longest', lengths.longest, lengths.basis),
    suggest('step', lengths.step, lengths.basis),
  ];
}

/** A drawer box's outside width and depth, and the slide length it takes. */
interface DrawerBoxSize {
  width: number;
  depth: number;
  slideLength: number;
}

export type DrawerBoxResult =
  | { status: 'sized'; size: DrawerBoxSize }
  | { status: 'input-needed'; missing: MissingInput[] }
  | { status: 'refused'; issues: Issue[] };

/** Allows for lengths entered as fractions, which are exact in binary but summed with rounding. */
const EPSILON = 1e-9;

/**
 * The longest length sold, shortest + k·step for whole k ≥ 0 and no longer than the longest,
 * that is no longer than `depth`. Undefined when even the shortest is longer.
 */
export function longestSlideWithin(
  lengths: { shortest: number; longest: number; step?: number },
  depth: number,
): number | undefined {
  const { shortest, longest, step } = lengths;
  const room = Math.min(depth, longest);
  if (room < shortest - EPSILON) return undefined;
  if (step === undefined || longest - shortest < EPSILON) return shortest;
  return shortest + Math.floor((room - shortest) / step + EPSILON) * step;
}

/**
 * The box a side-mount slide sizes in an opening: as wide as the opening less twice the slide's
 * side clearance, and as deep as the longest slide sold that fits `opening.depth`, the depth the
 * template leaves the box (any room it keeps behind the box already taken off). Input needed while
 * a figure is missing; refused when the box would have no width, no slide sold fits, or the
 * longest length sold is shorter than the shortest. `path` is where the slide's fields are in the
 * parameters.
 */
export function drawerBox(
  opening: { width: number; depth: number },
  slide: DrawerSlide,
  path: string,
): DrawerBoxResult {
  const { sideClearance, shortest, longest, step } = slide;
  const several = shortest === undefined || longest === undefined || shortest !== longest;
  const missing = (['sideClearance', 'shortest', 'longest', 'step'] as const)
    .filter((k) => slide[k] === undefined && (k !== 'step' || several))
    .map((k) => ({ key: `${path}.${k}`, label: LABELS[k] }));
  if (
    missing.length > 0 ||
    sideClearance === undefined ||
    shortest === undefined ||
    longest === undefined
  ) {
    return { status: 'input-needed', missing };
  }
  const issues: Issue[] = [];
  if (longest < shortest) {
    return {
      status: 'refused',
      issues: [
        {
          code: 'slide-lengths',
          message: `The longest slide sold, ${formatLength(longest)}, is shorter than the shortest, ${formatLength(shortest)}.`,
          params: [`${path}.shortest`, `${path}.longest`],
        },
      ],
    };
  }
  const width = opening.width - 2 * sideClearance;
  if (width <= 0) {
    issues.push({
      code: 'drawer-opening-narrow',
      message: `The opening is ${formatLength(opening.width)} wide, no wider than the slides' clearance of ${formatLength(sideClearance)} on each side.`,
      params: [`${path}.sideClearance`],
    });
  }
  const slideLength = longestSlideWithin({ shortest, longest, step }, opening.depth);
  if (slideLength === undefined) {
    issues.push({
      code: 'drawer-opening-shallow',
      message: `The opening leaves ${formatLength(opening.depth)} for the box, shorter than the shortest slide sold, ${formatLength(shortest)}.`,
      params: [`${path}.shortest`],
    });
  }
  if (issues.length > 0 || slideLength === undefined) return { status: 'refused', issues };
  return { status: 'sized', size: { width, depth: slideLength, slideLength } };
}

/** A line in the hardware list for `pairs` pairs of slides of one length, with their figures. */
export function drawerSlideItem(
  item: { id: string; name: string; group: string },
  pairs: number,
  slideLength: number,
  sideClearance: number,
): HardwareItem {
  return {
    ...item,
    quantity: pairs,
    structural: false,
    notes: [
      `Pairs of side-mount slides ${formatLength(slideLength)} long, one pair for each box.`,
      `Each takes ${formatLength(sideClearance)} on each side of its box, so check the slides you buy say the same before building the boxes.`,
    ],
  };
}
