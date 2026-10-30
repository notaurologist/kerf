import { z } from 'zod';
import { Citation } from '../design-values/sources.ts';

// Expert-check categories (DOMAIN.md, Expert-check categories; decision 0009): what a flag can be
// about, each with what to ask an experienced builder and why. Templates' flags and methods' flags
// name these IDs, and this is the one list of them.

export const FLAG_CATEGORY_IDS = [
  'table-saw',
  'router',
  'jointer-planer-lathe',
  'load-bearing',
  'dynamic-loads',
  'wood-movement',
  'finishes',
  'dust-and-species',
] as const;
export const FlagCategory = z.enum(FLAG_CATEGORY_IDS);
export type FlagCategory = z.infer<typeof FlagCategory>;

export const ExpertCheckCategory = z.object({
  id: FlagCategory,
  /** A short label, in sentence case, shown after "Expert check". */
  label: z.string().min(1),
  /** What falls in the category. */
  covers: z.string().min(1),
  /** What to ask an experienced builder, in the content guide's "Ask whether..." form. */
  ask: z.string().min(1),
  /** One sentence on what is at stake. */
  why: z.string().min(1),
  /** Where the hazard in `why` is described (hard rule 5). */
  sources: z.array(Citation),
});
export type ExpertCheckCategory = z.infer<typeof ExpertCheckCategory>;

const ETOOL = 'https://www.osha.gov/etools/woodworking/production/machines-tools';

/** In DOMAIN.md's order. */
export const EXPERT_CHECK_CATEGORIES = [
  {
    id: 'table-saw',
    label: 'Table saw',
    covers:
      'Ripping, dadoes, and kickback, and the blade guard, spreader or riving knife, and anti-kickback fingers.',
    ask: 'Ask an experienced builder to look over your setup before the first cut: the blade height, the guard, and the spreader or riving knife.',
    why: 'A table saw throws the board back at you when the blade height is wrong or the wood pinches the blade, and the blade is exposed wherever the guard is off.',
    sources: [
      {
        source: 'osha-woodworking-etool',
        locator: 'Table Saws: kickback and point of operation',
        url: `${ETOOL}/table-saws`,
      },
    ],
  },
  {
    id: 'router',
    label: 'Router technique',
    covers: 'Feed direction, bit choice, and working on a table or by hand.',
    ask: 'Ask an experienced builder which way to feed for this cut, and whether to make it on a table or by hand.',
    why: 'Feeding the wrong way or too abruptly can throw the work or the router, and a loose bit can be thrown from the collet.',
    sources: [
      {
        source: 'osha-woodworking-etool',
        locator: 'Routers: hazards and safe work practices',
        url: `${ETOOL}/routers`,
      },
    ],
  },
  {
    id: 'jointer-planer-lathe',
    label: 'Jointer, planer, or lathe',
    covers: 'Jointers, planers, and lathes.',
    ask: 'Ask an experienced builder to show you the guards and how to feed the board before you use the machine.',
    why: 'Your hands come close to exposed knives, and the guard is what keeps them off.',
    sources: [
      {
        source: 'osha-woodworking-etool',
        locator: 'Jointers: point of operation',
        url: `${ETOOL}/jointers`,
      },
    ],
  },
  {
    id: 'load-bearing',
    label: 'Load-bearing design',
    covers:
      'Spans, sag, anchoring, and wall mounting, and anything people sit on, hang from, or climb.',
    ask: 'Ask an experienced builder to look over the structural checks and the checklist, with the margins and assumptions they list.',
    why: 'A part that breaks, sags, or tips under a person can hurt them, and Kerf checks only part of what holds a structure up.',
    sources: [],
  },
  {
    id: 'dynamic-loads',
    label: 'Dynamic loads',
    covers: 'Anything that moves under load, such as a hammock. Forces exceed body weight.',
    ask: 'Ask an experienced builder whether the loads the structural checks use match how the structure will be used.',
    why: 'A load moving along an arc pulls harder than its weight at the bottom of the arc.',
    sources: [
      { source: 'openstax-university-physics-1', locator: 'Section 6.3, Centripetal Force' },
    ],
  },
  {
    id: 'wood-movement',
    label: 'Wood movement',
    covers: 'Glued or rigid joints across the grain.',
    ask: 'Ask an experienced builder whether the joint lets the wood shrink and swell across its grain.',
    why: 'Wood shrinks and swells far more across the grain than along it, so a rigid joint across the grain can split the wood.',
    sources: [{ source: 'fpl-gtr-282', locator: 'Chapter 4, Shrinkage, pp. 4-7 to 4-10' }],
  },
  {
    id: 'finishes',
    label: 'Finishes',
    covers: 'Oil-based finishes and their rags, ventilation, and the product instructions.',
    ask: "Ask an experienced builder which finish suits the wood and where it will stand, and follow the product's instructions for ventilation.",
    why: 'Rags wet with oil-based finish can catch fire on their own. Store them in a tightly sealed metal container, then throw them away.',
    sources: [{ source: 'usfa-oily-rags', locator: 'Pictograph' }],
  },
  {
    id: 'dust-and-species',
    label: 'Dust and species',
    covers: 'Species that irritate or sensitize, dust collection, and respiratory protection.',
    ask: 'Ask an experienced builder whether your species or treated lumber calls for more than a dust mask, and how to collect the dust.',
    why: 'Breathing wood dust can cause allergic and other respiratory symptoms, and cancer.',
    sources: [{ source: 'osha-wood-dust', locator: 'Overview' }],
  },
] as const satisfies readonly z.input<typeof ExpertCheckCategory>[];

export const FLAG_CATEGORY_LABELS = Object.fromEntries(
  EXPERT_CHECK_CATEGORIES.map((c) => [c.id, c.label]),
) as Record<FlagCategory, string>;

/** The category entry for an ID. */
export function findExpertCheckCategory(id: FlagCategory): ExpertCheckCategory {
  const found = EXPERT_CHECK_CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`no expert-check category ${id}`);
  return found;
}
