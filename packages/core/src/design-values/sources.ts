import { z } from 'zod';

// Publications that design values, adjustment factors, structural formulas, and knowledge-base
// entries come from (decision 0009). Every value and formula cites one of these with a locator, so
// the app can show where a number came from and link to the source for checking.

export const Source = z.object({
  title: z.string().min(1),
  publisher: z.string().min(1),
  edition: z.string().min(1),
  /** Where to read it. AWC links are its free view-only copies. */
  url: z.url({ protocol: /^https$/ }),
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
  'fpl-gtr-76': {
    title: 'Specific Gravity, Moisture Content, and Density Relationship for Wood (FPL-GTR-76)',
    publisher: 'USDA Forest Service, Forest Products Laboratory (William T. Simpson)',
    edition: 'July 1993',
    url: 'https://research.fs.usda.gov/download/treesearch/5914.pdf',
  },
  'awc-da6': {
    title: 'Design Aid No. 6: Beam Design Formulas with Shear and Moment Diagrams',
    publisher: 'American Wood Council',
    edition: '2007',
    url: 'https://awc.org/wp-content/uploads/2021/12/AWC-DA6-BeamFormulas-0710.pdf',
  },
  'openstax-university-physics-1': {
    title: 'University Physics Volume 1',
    publisher: 'OpenStax, Rice University (William Moebs, Samuel J. Ling, Jeff Sanny)',
    edition: '2016',
    url: 'https://openstax.org/details/books/university-physics-volume-1',
    note: 'For the pendulum load: speed at the bottom of the arc and the centripetal force.',
  },
  'fpl-gtr-282': {
    title: 'Wood Handbook: Wood as an Engineering Material (FPL-GTR-282)',
    publisher: 'USDA Forest Service, Forest Products Laboratory (Robert J. Ross, editor)',
    edition: '2021',
    url: 'https://research.fs.usda.gov/treesearch/62200',
    note: 'For board selection (knots, cross grain, checks, shake, decay, and warp) and wood movement.',
  },
  'awpa-homeowners': {
    title: 'Information for Homeowners',
    publisher: 'American Wood Protection Association',
    edition: 'Web page, read October 2026 (undated)',
    url: 'https://awpa.com/info/technical/homeowners',
    note: 'For ground-contact use categories and end tags.',
  },
  'awpa-u1': {
    title: 'Standard U1-25, Use Category System: User Specification for Treated Wood (excerpt)',
    publisher: 'American Wood Protection Association',
    edition:
      '2025; the free excerpt of Sections 1 to 6 and Commodity Specification A, read November 2026',
    url: 'https://awpa.com/images/2025/U1-25_excerpt.pdf',
    note: 'For which ground-contact parts need UC4B rather than UC4A.',
  },
  'osha-3080': {
    title: 'Hand and Power Tools (OSHA 3080)',
    publisher: 'U.S. Department of Labor, Occupational Safety and Health Administration',
    edition: '2002 (Revised)',
    url: 'https://www.osha.gov/sites/default/files/publications/osha3080.pdf',
    note: 'For guards, eye protection, clamping the work, and unplugging a tool to change a blade or bit.',
  },
  'osha-woodworking-etool': {
    title: 'Woodworking eTool',
    publisher: 'U.S. Department of Labor, Occupational Safety and Health Administration',
    edition: 'Web pages, read October 2026 (undated)',
    url: 'https://www.osha.gov/etools/woodworking',
    note: 'For kickback, supporting the work, the guards on saws, routers, and jointers, and hearing protection.',
  },
  'pti-circular-saws': {
    title: 'Circular Saws',
    publisher: 'Power Tool Institute',
    edition: 'PDF of November 2025',
    url: 'https://www.powertoolinstitute.com/wp-content/uploads/2025/10/PTI_Circular-Saws.pdf',
    note: 'For letting the blade stop before lifting the saw out of a partial cut.',
  },
  'osha-wood-dust': {
    title: 'Wood Dust: Overview',
    publisher: 'U.S. Department of Labor, Occupational Safety and Health Administration',
    edition: 'Web page, read October 2026 (undated)',
    url: 'https://www.osha.gov/wood-dust',
  },
  'usfa-oily-rags': {
    title: 'Pictograph: Store Oily and Solvent-Wet Rags in a Metal Container',
    publisher: 'U.S. Fire Administration (FEMA)',
    edition: 'Web page, last reviewed January 9, 2022',
    url: 'https://www.usfa.fema.gov/gallery/pictographs/pictograph98.html',
  },
  'cga-811': {
    title: '811 Before You Dig',
    publisher: 'Common Ground Alliance',
    edition: 'Web page, read October 2026 (undated)',
    url: 'https://811beforeyoudig.com/',
    note: 'For having buried utility lines marked before digging.',
  },
  'osha-1926-1053': {
    title: 'Safety and Health Regulations for Construction, 29 CFR 1926.1053: Ladders',
    publisher: 'U.S. Department of Labor, Occupational Safety and Health Administration',
    edition: 'Regulation text on osha.gov, read November 2026',
    url: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.1053',
    note: 'A rule for construction work, read here for using a stepladder: locked open, on stable and level ground, never standing on its top step, and carrying nothing that could throw your balance.',
  },
  'osha-etool-heavy-lifting': {
    title: 'Electrical Contractors eTool: Materials Handling, Heavy Lifting',
    publisher: 'U.S. Department of Labor, Occupational Safety and Health Administration',
    edition: 'Web page, read November 2026 (undated)',
    url: 'https://www.osha.gov/etools/electrical-contractors/materials-handling/heavy',
    note: 'For lifting a load heavier than 50 pounds with two or more people.',
  },
  'nrcs-co-382': {
    title: 'Conservation Practice Standard 382, Fence: Specification Guide, Suspension',
    publisher: 'USDA Natural Resources Conservation Service, Colorado',
    edition: 'December 2014 (file of 2021)',
    url: 'https://efotg.sc.egov.usda.gov/api/CPSFile/3378/382_CO_IR_Fence_Suspension_2021',
    note: 'For setting posts: backfilled in shallow layers, each tamped firm, the posts plumb, and the fill mounded so water does not pond at the post.',
  },
  'nist-ps-20-25': {
    title: 'Voluntary Product Standard PS 20-25, American Softwood Lumber Standard',
    publisher: 'National Institute of Standards and Technology, U.S. Department of Commerce',
    edition: 'Effective January 2025',
    url: 'https://www.nist.gov/document/ps-20-25-final',
    note: 'For what a grade stamp shows.',
  },
  'asme-b18-21-1-2009': {
    title: 'ASME B18.21.1, Washers (Inch Series): USS flat washers',
    publisher: 'ASME',
    edition: '2009',
    url: 'https://www.tannerbolt.com/media/akeneo_connector/WashersUSS.pdf',
    note: 'The standard is sold, not free to read. The link is a fastener supplier’s catalog page that reproduces its table of USS flat washers.',
  },
  'asme-b18-16-6-2008': {
    title: 'ASME B18.16.6, Nylon Insert Locknuts (Inch Series)',
    publisher: 'ASME',
    edition: '2008',
    url: 'https://boltingspecialist.com/dimensions/asme-b18-16-6-nylon-insert-lock-nuts/index.html',
    note: 'The standard is sold, not free to read. The link reproduces its Table 1; the minimum heights also match the copy at fasten.it.',
  },
  'irc-2021': {
    title: 'International Residential Code',
    publisher: 'International Code Council',
    edition: '2021',
    url: 'https://codes.iccsafe.org/content/IRC2021P2/chapter-3-building-planning',
    note: 'A code for houses, not play sets. Kerf follows it where it names materials for treated lumber, and for field-treating cuts and holes in it (R317.1.1).',
  },
  'awpa-m4-06': {
    title: 'M4, Standard for the Care of Preservative-Treated Wood Products',
    publisher:
      'American Wood Protection Association (then the American Wood-Preservers’ Association)',
    edition: 'M4-06, 2007',
    url: 'https://www.anthonyforest.com/assets/pdf/awpa-M4-06-REM-2016-11-22-RG.pdf',
    note: 'IRC 2021 refers to M4-15, which is sold, not free to read. The link is a lumber maker’s copy of the 2006 edition, read November 2026.',
  },
  'wwpi-field-treating': {
    title: 'Field Treating',
    publisher: 'Western Wood Preservers Institute',
    edition: 'Web page, read November 2026 (undated)',
    url: 'https://preservedwood.org/how-to/field-treatment/',
    note: 'For how to apply a field treatment: brushed on, worked into holes, as the label says.',
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

const SOURCE_IDS = Object.keys(SOURCES) as [SourceId, ...SourceId[]];

/** A pointer into a source: which table, section, or equation, and a deep link where one exists. */
export const Citation = z.object({
  source: z.enum(SOURCE_IDS),
  /** Table, section, equation, or figure, with the printed page number where useful. */
  locator: z.string().min(1),
  url: z.url({ protocol: /^https$/ }).optional(),
});
export type Citation = z.infer<typeof Citation>;

/** AWC's view-only chapter links, for deep links in citations. */
export const SOURCE_LINKS = {
  ndsChapter2:
    'https://awc.org/pdf-viewer/index.html#https://web-media.awc.org/wp-content/uploads/2021/12/17210153/AWC_NDS2024_20231129_AWCWebsite_Chapter2.pdf',
  ndsChapter3:
    'https://awc.org/pdf-viewer/index.html#https://awc.org/wp-content/uploads/2026/09/AWC_NDS2024_withCommentary_20260911_Website-Chapter-3-Design-Provisions-Equations.pdf',
  ndsChapter12:
    'https://awc.org/pdf-viewer/index.html#https://awc.org/wp-content/uploads/2026/09/AWC_NDS2024_withCommentary_20260911_Website_Chapter-12-Dowel-Type-Fasteners.pdf',
  ndsChapter4:
    'https://awc.org/pdf-viewer/index.html#https://awc.org/wp-content/uploads/2026/09/AWC_NDS2024_withCommentary_20260911_Website_Chapter-4-Sawn-Lumber.pdf',
  ndsAppendix:
    'https://awc.org/pdf-viewer/index.html#https://awc.org/wp-content/uploads/2026/09/AWC_NDS2024_withCommentary_20260911_Website-Appendix.pdf',
  supplementChapter3:
    'https://awc.org/pdf-viewer/index.html#https://web-media.awc.org/wp-content/uploads/2021/10/17210145/AWC_NDS2024-Supplement_20231129_AWCWebsite_Section-Properties.pdf',
  supplementChapter4:
    'https://awc.org/pdf-viewer/index.html#https://awc.org/wp-content/uploads/2026/08/AWC_NDS2024-Supplement_20240719_Chapter-4-Reference-Design-Values_Website-1.pdf',
} as const;
