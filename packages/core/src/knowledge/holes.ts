import type { Citation } from '../design-values/sources.ts';
import type { SuggestionBasis } from '../model/questions.ts';

// Hole sizes a template may suggest, each with its source, for the owner to confirm (hard rule 3).

/**
 * The round hole that makers offer the widest range of bought hold-downs and stops for, bored straight down
 * through a top: 3/4". A template offers it as a suggestion for such holes, never as a default.
 */
export const ROUND_HOLDING_HOLE = {
  diameter: 0.75,
  citation: {
    source: 'popular-woodworking-round-holes-2010',
    locator: 'Paragraph on round holes and their accessories',
  } satisfies Citation,
  basis: {
    kind: 'source',
    citation:
      'Popular Woodworking, “I Have a Dog in this Fight” (Christopher Schwarz, April 26, 2010): makers offer a wide range of hold-downs and stops for a 3/4" round hole',
  } satisfies SuggestionBasis,
  note: 'Check the hold-downs and stops you will use before boring, and bore the size they are made for.',
} as const;
