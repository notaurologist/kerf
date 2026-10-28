import { z } from 'zod';

// Publications that design values, adjustment factors, and structural formulas come from
// (decision 0009). Every value and formula cites one of these with a locator, so the app can show
// where a number came from and link to the source for checking.

export const Source = z.object({
  title: z.string().min(1),
  publisher: z.string().min(1),
  edition: z.string().min(1),
  /** Where to read it. AWC links are its free view-only copies. */
  url: z.url(),
  note: z.string().optional(),
});
export type Source = z.infer<typeof Source>;

export const SOURCES = {
  'nds-2024': {
    title: 'National Design Specification (NDS) for Wood Construction',
    publisher: 'American Wood Council',
    edition: '2024',
    url: 'https://awc.org/publications/2024-nds/',
  },
  'nds-supplement-2024': {
    title: 'NDS Supplement: Design Values for Wood Construction',
    publisher: 'American Wood Council',
    edition: '2024, with addenda of February 2024 and March 2025',
    url: 'https://awc.org/publications/2024-nds-supplement/',
    note: 'The addenda change Hem-Fir (North) and add Red Alder; neither touches Table 4B.',
  },
  'spib-southern-pine-2013': {
    title:
      'Southern Pine Reference Design Values (Southern Pine Use Guide, Table 1 and Tables A-1 to A-4)',
    publisher: 'Southern Forest Products Association, based on SPIB grading rules',
    edition: 'Values effective June 1, 2013',
    url: 'https://www.southernpine.com/wp-content/uploads/2023/09/TABLE01_L1.pdf',
    note: 'Used to corroborate NDS Supplement Table 4B, not as the primary source.',
  },
  'awc-da6': {
    title: 'Design Aid No. 6: Beam Design Formulas with Shear and Moment Diagrams',
    publisher: 'American Wood Council',
    edition: '2007',
    url: 'https://awc.org/wp-content/uploads/2021/12/AWC-DA6-BeamFormulas-0710.pdf',
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

const SOURCE_IDS = Object.keys(SOURCES) as [SourceId, ...SourceId[]];

/** A pointer into a source: which table, section, or equation, and a deep link where one exists. */
export const Citation = z.object({
  source: z.enum(SOURCE_IDS),
  /** Table, section, equation, or figure, with the printed page number where useful. */
  locator: z.string().min(1),
  url: z.url().optional(),
});
export type Citation = z.infer<typeof Citation>;

/** AWC's view-only chapter links, for deep links in citations. */
export const SOURCE_LINKS = {
  ndsChapter2:
    'https://awc.org/pdf-viewer/index.html#https://web-media.awc.org/wp-content/uploads/2021/12/17210153/AWC_NDS2024_20231129_AWCWebsite_Chapter2.pdf',
  ndsChapter3:
    'https://awc.org/pdf-viewer/index.html#https://awc.org/wp-content/uploads/2026/09/AWC_NDS2024_withCommentary_20260911_Website-Chapter-3-Design-Provisions-Equations.pdf',
  ndsChapter4:
    'https://awc.org/pdf-viewer/index.html#https://awc.org/wp-content/uploads/2026/09/AWC_NDS2024_withCommentary_20260911_Website_Chapter-4-Sawn-Lumber.pdf',
  supplementChapter4:
    'https://awc.org/pdf-viewer/index.html#https://awc.org/wp-content/uploads/2026/08/AWC_NDS2024-Supplement_20240719_Chapter-4-Reference-Design-Values_Website-1.pdf',
} as const;
