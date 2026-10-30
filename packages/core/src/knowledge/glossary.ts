import { z } from 'zod';
import { Citation, SOURCE_LINKS } from '../design-values/sources.ts';
import { IllustrationId } from './illustrations.ts';
import { TOOL_TYPES } from './tools.ts';

// The glossary (decision 0009): the woodworking terms Kerf's text uses, each with a short
// definition in the content guide's voice. The glossary page lists them, and text marks the first
// use of each on a screen (docs/design/content.md, Definitions).

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const GlossaryEntry = z.object({
  id: z.string().regex(ID, 'must be a lowercase ID like end-cut'),
  /** The term as a heading, in sentence case. */
  term: z.string().min(1),
  /** Other forms the term appears in, such as plurals, as written in running text. */
  forms: z.array(z.string().min(1)),
  /** One or two sentences, in the content guide's voice. */
  definition: z.string().min(1),
  /** The drawing that goes with the definition, if one does. */
  illustration: IllustrationId.optional(),
  /** Where a safety-relevant definition comes from (hard rule 5). */
  sources: z.array(Citation),
});
export type GlossaryEntry = z.infer<typeof GlossaryEntry>;

/** In alphabetical order of term, the order the glossary page lists them. */
export const GLOSSARY = [
  {
    id: 'angle-to-the-edge',
    term: 'Angle to the edge',
    forms: ['angles to the edge'],
    definition:
      "The angle between a cut line and the board's edge: 90° minus the saw setting. A protractor or sliding bevel reads this angle, not the saw setting.",
    illustration: 'saw-setting',
    sources: [],
  },
  {
    id: 'bevel',
    term: 'Bevel',
    forms: ['bevels', 'beveled'],
    definition:
      "An end cut angled through the board's thickness, made with the saw blade tilted. The cut list gives it as a saw setting.",
    illustration: 'bevel',
    sources: [],
  },
  {
    id: 'counterbore',
    term: 'Counterbore',
    forms: ['counterbores', 'counterbored'],
    definition:
      'A wider, shallow hole that lets a bolt head or nut sit below the surface. Drill it first, then drill the through hole from its center.',
    sources: [],
  },
  {
    id: 'end-cut',
    term: 'End cut',
    forms: ['end cuts'],
    definition:
      'The cut across a part at each of its ends. The cut list gives each one as square or as a saw setting.',
    sources: [],
  },
  {
    id: 'grip',
    term: 'Grip',
    forms: ['grips'],
    definition:
      'The thickness of wood a bolt passes through, from where it goes in to where it comes out. The hardware list gives each bolt length from its grip.',
    sources: [],
  },
  {
    id: 'gusset',
    term: 'Gusset',
    forms: ['gussets'],
    definition:
      'A board fastened across a joint, on the faces of the parts it joins, to stiffen it.',
    sources: [],
  },
  {
    id: 'kerf',
    term: 'Kerf',
    forms: ['kerfs'],
    definition:
      'The width of wood a saw blade removes in a cut. Cut with the kerf on the waste side of the line, so the part keeps its length.',
    illustration: 'kerf',
    sources: [],
  },
  {
    id: 'long-point',
    term: 'Long point',
    forms: ['long points'],
    definition:
      "The end of an angled cut where the part is longest. A part's length in the cut list is measured from long point to long point.",
    illustration: 'long-and-short-point',
    sources: [],
  },
  {
    id: 'margin',
    term: 'Margin',
    forms: ['margins'],
    definition:
      "A structural check's adjusted allowable value divided by the value computed for the loads. It holds only under the assumptions the check lists, and is a number to judge with an experienced builder.",
    sources: [
      {
        source: 'nds-2024',
        locator: '2.3, Adjustment of Reference Design Values',
        url: SOURCE_LINKS.ndsChapter2,
      },
    ],
  },
  {
    id: 'miter',
    term: 'Miter',
    forms: ['miters', 'mitered'],
    definition:
      "An end cut angled across the board's face, with the blade square to the face. The cut list gives it as a saw setting.",
    illustration: 'miter',
    sources: [],
  },
  {
    id: 'offcut',
    term: 'Offcut',
    forms: ['offcuts'],
    definition: 'What is left of a board after its parts are cut from it.',
    sources: [],
  },
  {
    id: 'plumb',
    term: 'Plumb',
    forms: [],
    definition: 'Exactly vertical. Check it with a level held against the side of the part.',
    sources: [],
  },
  {
    id: 'reference-face',
    term: 'Reference face',
    forms: ['reference faces'],
    definition:
      "The face a part's angles and marks are measured from. Each cut detail shows which face it is.",
    sources: [],
  },
  {
    id: 'saw-setting',
    term: 'Saw setting',
    forms: ['saw settings'],
    definition:
      "An angle as a miter saw's scale reads it: 0° is a square cut, and the angle is measured from square. Kerf gives every cut angle this way, with the angle to the edge beside it.",
    illustration: 'saw-setting',
    sources: [],
  },
  {
    id: 'short-point',
    term: 'Short point',
    forms: ['short points'],
    definition:
      'The end of an angled cut where the part is shortest, across the board from the long point.',
    illustration: 'long-and-short-point',
    sources: [],
  },
  {
    id: 'stock',
    term: 'Stock',
    forms: [],
    definition:
      'The lumber a part is cut from, named by its nominal size, such as 2x4. The cut list gives both the nominal and the actual size.',
    sources: [],
  },
] as const satisfies readonly z.input<typeof GlossaryEntry>[];

export type GlossaryId = (typeof GLOSSARY)[number]['id'];

/** The entry for an ID, or undefined for an ID not in the glossary. */
export function findGlossaryEntry(id: string): GlossaryEntry | undefined {
  return GLOSSARY.find((e) => e.id === id);
}

/** One use of a glossary term in a string: `text.slice(start, end)` is the words used. */
export interface TermUse {
  id: GlossaryId;
  start: number;
  end: number;
}

// Words that contain a term without being one: tool names ("miter" in "miter saw", "bevel" in
// "sliding bevel"), each with a plural, and the app's own name, which only a capital tells apart
// from the term.
const NOT_TERMS = TOOL_TYPES.flatMap((t) => {
  const name = t.name.toLowerCase();
  return name.endsWith('s') ? [name] : [name, `${name}s`];
});
const APP_NAME = 'Kerf';

const PHRASES: readonly { words: string; id: GlossaryId | null }[] = [
  ...GLOSSARY.flatMap((e) =>
    [e.term, ...e.forms].map((words) => ({ words: words.toLowerCase(), id: e.id })),
  ),
  ...NOT_TERMS.map((words) => ({ words, id: null })),
].sort((a, b) => b.words.length - a.words.length);

// Longer phrases come first, so at each place the longest one matches. Spaces in a phrase match
// any run of spaces or hyphens ("miter-saw settings").
const PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${PHRASES.map((p) => `(${pattern(p.words)})`).join('|')})(?![\\p{L}\\p{N}])`,
  'giu',
);

function pattern(words: string): string {
  return words
    .split(' ')
    .map((w) => w.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'))
    .join('[\\s-]+');
}

/**
 * Every use of a glossary term in `text`, in order: whole words, ignoring case, the longest term
 * at each place, and never inside a tool's name.
 */
export function findTerms(text: string): TermUse[] {
  const uses: TermUse[] = [];
  for (const match of text.matchAll(PATTERN)) {
    const group = match.slice(1).findIndex((g) => g !== undefined);
    const id = PHRASES[group]?.id;
    if (!id || match[0] === APP_NAME) continue;
    uses.push({ id, start: match.index, end: match.index + match[0].length });
  }
  return uses;
}
