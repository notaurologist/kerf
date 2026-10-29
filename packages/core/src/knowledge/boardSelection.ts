import { z } from 'zod';
import { Citation } from '../design-values/sources.ts';

// What to look for when choosing a board at the store (DOMAIN.md, Grain and defects; #53), as
// data. Guides are by what a board does (carries load across a span, along its length, at bolts,
// in the ground), so they stay generic: a template says which guides each of its parts needs
// (Part.selection), and the shopping list carries them by part ID.
//
// Claims about strength or decay cite the Wood Handbook or AWPA, checked against them in October
// 2026. A check with no source is shop practice that no number or structural result depends on.

const WOOD_HANDBOOK = 'https://research.fs.usda.gov/download/treesearch/62200.pdf';

export const SelectionCheck = z.object({
  /** What to do or look for, in the shop voice. */
  look: z.string().min(1),
  /** Why, in one or two sentences. */
  why: z.string().min(1),
  sources: z.array(Citation),
});
export type SelectionCheck = z.infer<typeof SelectionCheck>;

export const BoardGuide = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  /** Names the kind of board, as a heading. */
  title: z.string().min(1),
  checks: z.array(SelectionCheck).min(1),
});
export type BoardGuide = z.infer<typeof BoardGuide>;

export const BOARD_GUIDES = [
  {
    id: 'structural',
    title: 'Every board that carries load',
    checks: [
      {
        look: 'Read the grade stamp. Confirm the species and grade match what you entered for the structural checks.',
        why: 'The structural checks use the design values for that species and grade.',
        sources: [],
      },
      {
        look: 'Sight along each edge and each face from one end. Choose boards with the least bow, crook, and twist.',
        why: 'A warped board is hard to line up and bolt square, and it does not straighten on its own.',
        sources: [
          {
            source: 'fpl-gtr-282',
            locator: 'Chapter 13, Warp, p. 13-13 (bow, crook, twist; Figure 13-13)',
            url: WOOD_HANDBOOK,
          },
        ],
      },
      {
        look: 'Look along the face for grain that runs at a slant to the edges. Choose boards whose grain runs along them.',
        why: 'Grain that slants across a board lowers its strength, and the board tends to warp as its moisture changes.',
        sources: [
          {
            source: 'fpl-gtr-282',
            locator: 'Chapter 7, Slope of Grain, p. 7-4',
            url: WOOD_HANDBOOK,
          },
        ],
      },
      {
        look: 'Choose boards with no soft or crumbling patches of rot.',
        why: 'Decay often weakens wood more than it looks, which is why grading rules restrict it closely.',
        sources: [
          { source: 'fpl-gtr-282', locator: 'Chapter 7, Decay, p. 7-5', url: WOOD_HANDBOOK },
        ],
      },
    ],
  },
  {
    id: 'span',
    title: 'A board that carries load across a span',
    checks: [
      {
        look: 'Look most closely at the middle of the length, along the top and bottom edges. Choose a board with no large knots there, above all on the bottom edge.',
        why: 'Across a span, stress is highest in the middle of the length and at the top and bottom edges. A knot on the bottom edge, which is in tension, lowers strength more than one on the top; knots near the middle of the depth do little harm.',
        sources: [
          { source: 'fpl-gtr-282', locator: 'Chapter 7, Knots, p. 7-4', url: WOOD_HANDBOOK },
          {
            source: 'fpl-gtr-282',
            locator: 'Chapter 5, Knots, pp. 5-27 to 5-28',
            url: WOOD_HANDBOOK,
          },
        ],
      },
      {
        look: 'Look at both ends for splits and shake (separations along the grain). Choose a board without them.',
        why: 'Splits and shake reduce resistance to shear, which is highest near the supports.',
        sources: [
          {
            source: 'fpl-gtr-282',
            locator: 'Chapter 7, Checks and Splits, and Shake, pp. 7-4 to 7-5',
            url: WOOD_HANDBOOK,
          },
        ],
      },
      {
        look: 'Sight along the narrow edge to find the crown, the edge that bows outward. Mark it so it goes on top.',
        why: 'With the crown up, the load flattens the board instead of adding to its sag.',
        sources: [],
      },
    ],
  },
  {
    id: 'along-length',
    title: 'A board that carries load along its length',
    checks: [
      {
        look: 'Choose the straightest board you can. Sight along both edges and both faces.',
        why: 'A bowed or crooked board carries its load off center, which adds bending to it.',
        sources: [
          {
            source: 'fpl-gtr-282',
            locator: 'Chapter 7, Round Timbers and Ties (crooks in columns), p. 7-14',
            url: WOOD_HANDBOOK,
          },
        ],
      },
      {
        look: 'Look along the whole length for large knots.',
        why: 'A board loaded along its length is stressed about equally throughout, so a knot matters wherever it is.',
        sources: [
          { source: 'fpl-gtr-282', locator: 'Chapter 7, Knots, p. 7-4', url: WOOD_HANDBOOK },
        ],
      },
    ],
  },
  {
    id: 'bolted',
    title: 'A board joined with bolts',
    checks: [
      {
        look: 'Look at each place a bolt goes. Choose wood there with no knots, splits, checks, or shake.',
        why: 'Published joint strengths come from tests on wood free of checks, shake, and splits at the joint, and a knot beside a joint takes away wood that carries its load.',
        sources: [
          {
            source: 'fpl-gtr-282',
            locator:
              'Chapter 8, Grade and Quality of Lumber, p. 8-22, and Net Section, p. 8-23 (timber connectors)',
            url: WOOD_HANDBOOK,
          },
        ],
      },
    ],
  },
  {
    id: 'ground-contact',
    title: 'A board in or on the ground',
    checks: [
      {
        look: 'Read the end tag. It must show AWPA U1 and use category UC4A or higher (ground contact).',
        why: 'Ground contact needs UC4A or higher, and some treated lumber 2 inches thick or less is treated only for use above ground. A tag without AWPA U1 and a use category probably does not meet AWPA standards.',
        sources: [{ source: 'awpa-homeowners', locator: 'Use categories; end tags' }],
      },
    ],
  },
] as const satisfies readonly z.input<typeof BoardGuide>[];

export type BoardGuideId = (typeof BOARD_GUIDES)[number]['id'];

const BY_ID: ReadonlyMap<string, BoardGuide> = new Map(
  BOARD_GUIDES.map((g) => [g.id, g as BoardGuide]),
);

/** The guide for an ID, or undefined for an ID not in the knowledge base. */
export function findBoardGuide(id: string): BoardGuide | undefined {
  return BY_ID.get(id);
}
