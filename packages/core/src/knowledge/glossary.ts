import { z } from 'zod';
import { Citation, SOURCE_LINKS } from '../design-values/sources.ts';
import { IllustrationId } from './illustrations.ts';
import { TOOL_TYPES } from './tools.ts';

// The glossary (decision 0009): the woodworking terms Kerf's text uses, each with a short
// definition in the content guide's voice. The glossary page lists them, and text marks the first
// use of each on a screen (docs/design/content.md, Definitions).

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Citations that several definitions share, at the locators the structural checks, board
// selection guides, and methods already cite.
const nds = (locator: string, url: string) => ({ source: 'nds-2024', locator, url }) as const;
const ndsChapter2 = (locator: string) => nds(locator, SOURCE_LINKS.ndsChapter2);
const ndsChapter3 = (locator: string) => nds(locator, SOURCE_LINKS.ndsChapter3);
const ndsChapter4 = (locator: string) => nds(locator, SOURCE_LINKS.ndsChapter4);
const ndsChapter12 = (locator: string) => nds(locator, SOURCE_LINKS.ndsChapter12);
const SECTION_PROPERTIES = {
  source: 'nds-supplement-2024',
  locator: 'Table 1B, Section Properties of Standard Dressed (S4S) Sawn Lumber, pp. 14-15',
  url: SOURCE_LINKS.supplementChapter3,
} as const;
const WET_SERVICE = {
  source: 'nds-supplement-2024',
  locator: 'Table 4B Adjustment Factors, Wet Service Factor C_M, p. 39',
  url: SOURCE_LINKS.supplementChapter4,
} as const;
const WOOD_HANDBOOK = 'https://research.fs.usda.gov/download/treesearch/62200.pdf';
const WARP = {
  source: 'fpl-gtr-282',
  locator: 'Chapter 13, Warp, p. 13-13 (bow, crook, twist; Figure 13-13)',
  url: WOOD_HANDBOOK,
} as const;
const AWPA = { source: 'awpa-homeowners', locator: 'Use categories; end tags' } as const;
const ETOOL = 'https://www.osha.gov/etools/woodworking/production/machines-tools';
const TABLE_SAW_KICKBACK = {
  source: 'osha-woodworking-etool',
  locator: 'Table Saws: kickback and point of operation',
  url: `${ETOOL}/table-saws`,
} as const;
const CIRCULAR_SAW_KICKBACK = {
  source: 'osha-woodworking-etool',
  locator: 'Handheld Circular Saws: kickbacks and point of operation',
  url: `${ETOOL}/handheld-circular-saws`,
} as const;

/** The glossary index's groups, in the order it lists them. */
export const GLOSSARY_GROUPS = [
  'lumber',
  'treated-lumber',
  'cutting',
  'joints',
  'site',
  'structure',
] as const;
export const GlossaryGroup = z.enum(GLOSSARY_GROUPS);
export type GlossaryGroup = z.infer<typeof GlossaryGroup>;

export const GLOSSARY_GROUP_LABELS: Record<GlossaryGroup, string> = {
  lumber: 'Lumber',
  'treated-lumber': 'Treated lumber',
  cutting: 'Cutting and shaping',
  joints: 'Joints and frames',
  site: 'The site',
  structure: 'Structural checks',
};

export const GlossaryEntry = z.object({
  id: z.string().regex(ID, 'must be a lowercase ID like end-cut'),
  /** The term as a heading, in sentence case. */
  term: z.string().min(1),
  /** Where the glossary index lists it. */
  group: GlossaryGroup,
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
    id: 'adjustment-factor',
    term: 'Adjustment factor',
    group: 'structure',
    forms: ['adjustment factors'],
    definition:
      'A multiplier on a design value for how the lumber is used, such as how long a load lasts or whether the wood stays wet.',
    sources: [ndsChapter2('2.3, Adjustment of Reference Design Values')],
  },
  {
    id: 'angle-to-the-edge',
    term: 'Angle to the edge',
    group: 'cutting',
    forms: ['angles to the edge'],
    definition:
      "The angle between a cut line and the board's edge: 90° minus the saw setting. A protractor or sliding bevel reads this angle, not the saw setting.",
    illustration: 'saw-setting',
    sources: [],
  },
  {
    id: 'awpa-u1',
    term: 'AWPA U1',
    group: 'treated-lumber',
    forms: [],
    definition:
      "The American Wood Protection Association's standard for which preservative treatment each use needs. A treated board's end tag names it with the use category.",
    sources: [AWPA],
  },
  {
    id: 'backfill',
    term: 'Backfill',
    group: 'site',
    forms: ['backfilling', 'backfilled'],
    definition:
      'Soil put back into a hole around a part after it is set. Tamp it in layers so it does not settle.',
    sources: [],
  },
  {
    id: 'bending-stress',
    term: 'Bending stress',
    group: 'structure',
    forms: ['bending'],
    definition:
      'The stress in a beam as it bends: one face is squeezed and the other stretched. A structural check compares it with the adjusted bending design value.',
    sources: [ndsChapter3('3.3.2, Eq. 3.3-2 and 3.3-4, p. 17')],
  },
  {
    id: 'bevel',
    term: 'Bevel',
    group: 'cutting',
    forms: ['bevels', 'beveled'],
    definition:
      "An end cut angled through the board's thickness, made with the saw blade tilted. The cut list gives it as a saw setting.",
    illustration: 'bevel',
    sources: [],
  },
  {
    id: 'bow',
    term: 'Bow',
    group: 'lumber',
    forms: ['bowed'],
    definition:
      "A curve along a board's length that you see sighting along its face, so the face is not flat end to end.",
    illustration: 'bow',
    sources: [WARP],
  },
  {
    id: 'built-up-beam',
    term: 'Built-up beam',
    group: 'joints',
    forms: ['built-up beams'],
    definition: 'A beam made of boards fastened face to face, each one a ply.',
    sources: [],
  },
  {
    id: 'burial-depth',
    term: 'Burial depth',
    group: 'site',
    forms: [],
    definition: 'How far a part goes below the ground, measured straight down.',
    sources: [],
  },
  {
    id: 'centripetal-force',
    term: 'Centripetal force',
    group: 'structure',
    forms: [],
    definition:
      'The inward pull it takes to keep something moving along a curve, such as a weight swinging on a rope.',
    sources: [{ source: 'openstax-university-physics-1', locator: '6.3, Centripetal Force' }],
  },
  {
    id: 'chamfer',
    term: 'Chamfer',
    group: 'cutting',
    forms: ['chamfers', 'chamfered'],
    definition: 'A narrow flat bevel planed or sanded along an edge to take off its sharp corner.',
    sources: [],
  },
  {
    id: 'counterbore',
    term: 'Counterbore',
    group: 'cutting',
    forms: ['counterbores', 'counterbored'],
    definition:
      'A wider, shallow hole that lets a bolt head or nut sit below the surface. Drill it first, then drill the through hole from its center.',
    sources: [],
  },
  {
    id: 'creep',
    term: 'Creep',
    group: 'structure',
    forms: [],
    definition: 'Sag that keeps growing over time under a load that stays on.',
    sources: [ndsChapter3('3.5.2')],
  },
  {
    id: 'crook',
    term: 'Crook',
    group: 'lumber',
    forms: ['crooks', 'crooked'],
    definition:
      "A curve along a board's length that you see sighting along its narrow edge, so the edge is not straight end to end.",
    illustration: 'crook',
    sources: [WARP],
  },
  {
    id: 'cross-grain',
    term: 'Cross grain',
    group: 'lumber',
    forms: [],
    definition:
      "Grain that runs at a slant to a board's edges instead of along them. It lowers the board's strength.",
    sources: [
      { source: 'fpl-gtr-282', locator: 'Chapter 7, Slope of Grain, p. 7-4', url: WOOD_HANDBOOK },
    ],
  },
  {
    id: 'crosscut',
    term: 'Crosscut',
    group: 'cutting',
    forms: ['crosscuts', 'crosscutting'],
    definition: 'A cut across the grain, such as cutting a board to length.',
    sources: [],
  },
  {
    id: 'crown',
    term: 'Crown',
    group: 'lumber',
    forms: [],
    definition:
      "The outward side of a slight curve along a board's narrow edge. In a beam it goes on top, so the load straightens the board instead of adding to its sag.",
    sources: [],
  },
  {
    id: 'dado',
    term: 'Dado',
    group: 'cutting',
    forms: ['dadoes', 'dados'],
    definition: "A flat-bottomed groove cut across a board's grain.",
    sources: [],
  },
  {
    id: 'deflection',
    term: 'Deflection',
    group: 'structure',
    forms: ['deflections'],
    definition:
      'How far a beam sags under load. Kerf compares it with a limit you enter: the span divided by a number, such as 240.',
    sources: [ndsChapter3('3.5.1, p. 22')],
  },
  {
    id: 'design-value',
    term: 'Design value',
    group: 'structure',
    forms: ['design values', 'reference design value', 'reference design values'],
    definition:
      'The stress or stiffness a species and grade of lumber is rated for, from published tables. Structural checks adjust it for how the lumber is used.',
    sources: [ndsChapter2('2.3, Adjustment of Reference Design Values')],
  },
  {
    id: 'dressed-size',
    term: 'Dressed size',
    group: 'lumber',
    forms: ['dressed sizes', 'actual size', 'actual sizes'],
    definition:
      "A board's actual thickness and width after drying and planing, such as 1-1/2 by 3-1/2 inches for a 2x4.",
    sources: [SECTION_PROPERTIES],
  },
  {
    id: 'dynamic-factor',
    term: 'Dynamic factor',
    group: 'structure',
    forms: ['dynamic factors'],
    definition:
      'A multiplier on a load for the extra force of jolts and sudden stops. Kerf does not suggest one: choose it with an experienced builder.',
    sources: [],
  },
  {
    id: 'edge-distance',
    term: 'Edge distance',
    group: 'joints',
    forms: ['edge distances'],
    definition: "The distance from a bolt's center to the edge of the part, across the grain.",
    illustration: 'bolt-distances',
    sources: [ndsChapter12('Table 12.5.1C, Edge Distance Requirements, p. 99')],
  },
  {
    id: 'end-cut',
    term: 'End cut',
    group: 'cutting',
    forms: ['end cuts'],
    definition:
      'The cut across a part at each of its ends. The cut list gives each one as square or as a saw setting.',
    sources: [],
  },
  {
    id: 'end-distance',
    term: 'End distance',
    group: 'joints',
    forms: ['end distances'],
    definition: "The distance from a bolt's center to the end of the part, along the grain.",
    illustration: 'bolt-distances',
    sources: [ndsChapter12('Table 12.5.1A, End Distance Requirements, p. 98')],
  },
  {
    id: 'end-grain',
    term: 'End grain',
    group: 'lumber',
    forms: [],
    definition: "The ends of the wood fibers, as seen on a board's cut end.",
    sources: [],
  },
  {
    id: 'end-tag',
    term: 'End tag',
    group: 'treated-lumber',
    forms: ['end tags'],
    definition:
      'The label on the end of a treated board that names its preservative and use category.',
    sources: [AWPA],
  },
  {
    id: 'flat-use-factor',
    term: 'Flat use factor',
    group: 'structure',
    forms: ['flat use'],
    definition:
      'An adjustment factor for a board bent across its wide face, laid flat instead of on edge.',
    sources: [ndsChapter4('4.3.7, p. 31')],
  },
  {
    id: 'flush',
    term: 'Flush',
    group: 'cutting',
    forms: [],
    definition: 'Level with the surface next to it, with no step between them.',
    sources: [],
  },
  {
    id: 'footprint',
    term: 'Footprint',
    group: 'site',
    forms: ['footprints'],
    definition: 'The area a frame covers at the ground, measured to its outside faces.',
    sources: [],
  },
  {
    id: 'grade-stamp',
    term: 'Grade stamp',
    group: 'lumber',
    forms: ['grade stamps'],
    definition: 'The ink stamp on a board that names its species and grade.',
    sources: [],
  },
  {
    id: 'grain',
    term: 'Grain',
    group: 'lumber',
    forms: [],
    definition:
      "The direction the wood's fibers run, along a board's length. Wood is strongest along the grain and shrinks and swells far more across it.",
    sources: [
      {
        source: 'fpl-gtr-282',
        locator: 'Chapter 4, Shrinkage, pp. 4-7 to 4-10',
        url: WOOD_HANDBOOK,
      },
    ],
  },
  {
    id: 'grip',
    term: 'Grip',
    group: 'joints',
    forms: ['grips'],
    definition:
      'The thickness of wood a bolt goes through, from where it goes in to where it comes out. The hardware list gives each bolt length from its grip.',
    sources: [],
  },
  {
    id: 'ground-contact',
    term: 'Ground contact',
    group: 'treated-lumber',
    forms: [],
    definition:
      'Use in or touching the ground. It needs lumber treated for use category UC4A or higher.',
    sources: [AWPA],
  },
  {
    id: 'gusset',
    term: 'Gusset',
    group: 'joints',
    forms: ['gussets'],
    definition:
      'A board fastened across a joint, on the faces of the parts it joins, to stiffen it.',
    sources: [],
  },
  {
    id: 'incising',
    term: 'Incising',
    group: 'treated-lumber',
    forms: ['incised'],
    definition:
      "Rows of small slits cut into lumber's faces so preservative goes deeper. It lowers some design values, and the structural checks adjust for it.",
    sources: [ndsChapter4('4.3.8 and Table 4.3.8, p. 32')],
  },
  {
    id: 'kerf',
    term: 'Kerf',
    group: 'cutting',
    forms: ['kerfs'],
    definition:
      'The width of wood a saw blade removes in a cut. Cut with the kerf on the waste side of the line, so the part keeps its length.',
    illustration: 'kerf',
    sources: [],
  },
  {
    id: 'kickback',
    term: 'Kickback',
    group: 'cutting',
    forms: ['kickbacks'],
    definition:
      'A saw throwing the work, or itself, back toward you when the blade pinches in the cut.',
    sources: [TABLE_SAW_KICKBACK, CIRCULAR_SAW_KICKBACK],
  },
  {
    id: 'knot',
    term: 'Knot',
    group: 'lumber',
    forms: ['knots'],
    definition:
      'Where a branch grew out of the trunk, seen as a round or oval patch with the grain curving around it. A knot lowers strength, most on an edge that is stretched under load.',
    sources: [{ source: 'fpl-gtr-282', locator: 'Chapter 7, Knots, p. 7-4', url: WOOD_HANDBOOK }],
  },
  {
    id: 'lateral-support',
    term: 'Lateral support',
    group: 'structure',
    forms: [],
    definition: 'Bracing that stops a beam from moving sideways or twisting along its length.',
    sources: [ndsChapter3('3.3.3.7, p. 18')],
  },
  {
    id: 'level-cut',
    term: 'Level cut',
    group: 'cutting',
    forms: ['level cuts'],
    definition: 'An end cut that is level, parallel to the ground, once the part stands in place.',
    sources: [],
  },
  {
    id: 'load-duration-factor',
    term: 'Load duration factor',
    group: 'structure',
    forms: ['load duration factors', 'load duration'],
    definition:
      'An adjustment factor for how long a load lasts in all: wood carries a brief load better than a permanent one.',
    sources: [ndsChapter2('2.3.2 and Table 2.3.2, p. 13')],
  },
  {
    id: 'load-bearing',
    term: 'Load-bearing',
    group: 'structure',
    forms: ['load bearing'],
    definition: 'Carrying weight or force from other parts, or from people, down to the ground.',
    sources: [],
  },
  {
    id: 'long-point',
    term: 'Long point',
    group: 'cutting',
    forms: ['long points'],
    definition:
      "The end of an angled cut where the part is longest. A part's length in the cut list is measured from long point to long point.",
    illustration: 'long-and-short-point',
    sources: [],
  },
  {
    id: 'margin',
    term: 'Margin',
    group: 'structure',
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
    id: 'midspan',
    term: 'Midspan',
    group: 'structure',
    forms: [],
    definition: 'The middle of a span, where a beam carrying an even load bends most.',
    sources: [
      { source: 'awc-da6', locator: 'Figure 1, Simple Beam, Uniformly Distributed Load, p. 4' },
    ],
  },
  {
    id: 'miter',
    term: 'Miter',
    group: 'cutting',
    forms: ['miters', 'mitered'],
    definition:
      "An end cut angled across the board's face, with the blade square to the face. The cut list gives it as a saw setting.",
    illustration: 'miter',
    sources: [],
  },
  {
    id: 'modulus-of-elasticity',
    term: 'Modulus of elasticity',
    group: 'structure',
    forms: [],
    definition:
      "A measure of a material's stiffness: how much it resists bending or stretching under load. Deflection depends on it.",
    sources: [ndsChapter3('3.5.1, p. 22')],
  },
  {
    id: 'moisture-content',
    term: 'Moisture content',
    group: 'lumber',
    forms: [],
    definition: "The weight of water in wood as a percentage of the wood's oven-dry weight.",
    sources: [{ source: 'fpl-gtr-76', locator: 'Equations 4 and 6 to 9, pp. 1-3' }],
  },
  {
    id: 'moment-of-inertia',
    term: 'Moment of inertia',
    group: 'structure',
    forms: [],
    definition:
      "A measure of how a cross-section's shape resists bending: a board on edge has far more than the same board laid flat. Deflection depends on it.",
    sources: [SECTION_PROPERTIES],
  },
  {
    id: 'nds',
    term: 'NDS',
    group: 'structure',
    forms: [],
    definition:
      "The National Design Specification for Wood Construction, the American Wood Council's standard for designing with wood. Kerf's structural checks follow its 2024 edition.",
    sources: [ndsChapter2('2.3, Adjustment of Reference Design Values')],
  },
  {
    id: 'nominal-size',
    term: 'Nominal size',
    group: 'lumber',
    forms: ['nominal sizes'],
    definition:
      "The size a board is sold by, such as 2x4. It is larger than the board's dressed size.",
    sources: [SECTION_PROPERTIES],
  },
  {
    id: 'offcut',
    term: 'Offcut',
    group: 'cutting',
    forms: ['offcuts'],
    definition: 'What is left of a board after its parts are cut from it.',
    sources: [],
  },
  {
    id: 'pare',
    term: 'Pare',
    group: 'cutting',
    forms: ['paring', 'pared'],
    definition:
      'Take off thin shavings with a chisel or plane, by hand, to bring a cut exactly to a line.',
    sources: [],
  },
  {
    id: 'plumb',
    term: 'Plumb',
    group: 'cutting',
    forms: [],
    definition: 'Exactly vertical. Check it with a level held against the side of the part.',
    sources: [],
  },
  {
    id: 'ply',
    term: 'Ply',
    group: 'joints',
    forms: ['plies'],
    definition: 'One of the boards in a built-up beam.',
    sources: [],
  },
  {
    id: 'pressure-treated',
    term: 'Pressure-treated',
    group: 'treated-lumber',
    forms: ['pressure treated'],
    definition:
      'Lumber with preservative forced deep into it under pressure, so it resists decay and insects. Its end tag says what use it is treated for.',
    sources: [AWPA],
  },
  {
    id: 'proud',
    term: 'Proud',
    group: 'cutting',
    forms: [],
    definition: 'Standing slightly above the surface or line next to it, to be trimmed down later.',
    sources: [],
  },
  {
    id: 'racking',
    term: 'Racking',
    group: 'joints',
    forms: [],
    definition:
      'A frame leaning sideways as its joints give, so its rectangles turn into parallelograms.',
    sources: [],
  },
  {
    id: 'rated-working-load',
    term: 'Rated working load',
    group: 'joints',
    forms: ['rated working loads'],
    definition:
      'The largest load a manufacturer rates a piece of hardware to carry in use, from its specification.',
    sources: [],
  },
  {
    id: 'reference-face',
    term: 'Reference face',
    group: 'cutting',
    forms: ['reference faces'],
    definition:
      "The face a part's angles and marks are measured from. Each cut detail shows which face it is.",
    sources: [],
  },
  {
    id: 'repetitive-member-factor',
    term: 'Repetitive member factor',
    group: 'structure',
    forms: ['repetitive member', 'repetitive members'],
    definition:
      'An adjustment factor that raises the bending design value of three or more boards that share a load closely, such as floor joists.',
    sources: [ndsChapter4('4.3.9, p. 32')],
  },
  {
    id: 'rip',
    term: 'Rip',
    group: 'cutting',
    forms: ['rips', 'ripping', 'ripped'],
    definition: 'A cut along the grain, such as cutting a board to width.',
    sources: [],
  },
  {
    id: 'riving-knife',
    term: 'Riving knife',
    group: 'cutting',
    forms: ['riving knives'],
    definition:
      'A metal fin behind a table saw blade that rises and falls with it and keeps the kerf open, so the wood cannot pinch the blade.',
    sources: [TABLE_SAW_KICKBACK],
  },
  {
    id: 'saw-setting',
    term: 'Saw setting',
    group: 'cutting',
    forms: ['saw settings'],
    definition:
      "An angle as a miter saw's scale reads it: 0° is a square cut, and the angle is measured from square. Kerf gives every cut angle this way, with the angle to the edge beside it.",
    illustration: 'saw-setting',
    sources: [],
  },
  {
    id: 'section-modulus',
    term: 'Section modulus',
    group: 'structure',
    forms: [],
    definition:
      "A measure of how a cross-section's shape resists bending stress: its moment of inertia divided by the distance from its center to its outer face.",
    sources: [SECTION_PROPERTIES],
  },
  {
    id: 'shake',
    term: 'Shake',
    group: 'lumber',
    forms: [],
    definition:
      "A separation along the grain, between the growth rings. It lowers the wood's resistance to shear.",
    sources: [
      {
        source: 'fpl-gtr-282',
        locator: 'Chapter 7, Checks and Splits, and Shake, pp. 7-4 to 7-5',
        url: WOOD_HANDBOOK,
      },
    ],
  },
  {
    id: 'shear-stress',
    term: 'Shear stress',
    group: 'structure',
    forms: ['shear'],
    definition:
      "The stress of the wood's fibers sliding past each other along the grain, highest near a beam's supports. A structural check compares it with the adjusted shear design value.",
    sources: [ndsChapter3('3.4.1 and 3.4.2, Eq. 3.4-2, p. 19')],
  },
  {
    id: 'short-point',
    term: 'Short point',
    group: 'cutting',
    forms: ['short points'],
    definition:
      'The end of an angled cut where the part is shortest, across the board from the long point.',
    illustration: 'long-and-short-point',
    sources: [],
  },
  {
    id: 'slenderness-ratio',
    term: 'Slenderness ratio',
    group: 'structure',
    forms: [],
    definition:
      'A number for how likely a deep, narrow beam is to buckle sideways, from its unbraced length, depth, and width. The NDS allows at most 50.',
    sources: [ndsChapter3('3.3.3.7, p. 18')],
  },
  {
    id: 'span',
    term: 'Span',
    group: 'structure',
    forms: ['spans'],
    definition:
      "The distance a beam reaches between its supports. Kerf measures it between the supports' centerlines.",
    sources: [ndsChapter3('3.2.1, p. 17')],
  },
  {
    id: 'species-and-grade',
    term: 'Species and grade',
    group: 'lumber',
    forms: [],
    definition:
      "The kind of tree a board comes from, and its grade: a rating of its quality under grading rules. Together they set the board's design values.",
    sources: [],
  },
  {
    id: 'splay',
    term: 'Splay',
    group: 'joints',
    forms: ['splayed'],
    definition:
      "The outward lean of a frame's sides from vertical, so the frame stands wider at the ground than at the top.",
    sources: [],
  },
  {
    id: 'spreader',
    term: 'Spreader',
    group: 'cutting',
    forms: ['spreaders'],
    definition:
      'A metal fin behind a table saw blade, part of the blade guard, that keeps the kerf open so the wood cannot pinch the blade.',
    sources: [TABLE_SAW_KICKBACK],
  },
  {
    id: 'stock',
    term: 'Stock',
    group: 'lumber',
    forms: [],
    definition:
      'The lumber a part is cut from, named by its nominal size, such as 2x4. The cut list gives both the nominal and the actual size.',
    sources: [],
  },
  {
    id: 'tamp',
    term: 'Tamp',
    group: 'site',
    forms: ['tamping', 'tamped'],
    definition: 'Pack loose soil or gravel down firmly by pounding it, a thin layer at a time.',
    sources: [],
  },
  {
    id: 'through-bolt',
    term: 'Through-bolt',
    group: 'joints',
    forms: ['through-bolts', 'through bolt', 'through bolts'],
    definition:
      'A bolt that goes all the way through the parts it joins, with a washer and nut on the far side.',
    sources: [],
  },
  {
    id: 'twist',
    term: 'Twist',
    group: 'lumber',
    forms: ['twisted'],
    definition:
      "Warp that turns a board's ends in different directions, so it rocks on a flat surface.",
    illustration: 'twist',
    sources: [WARP],
  },
  {
    id: 'unbraced-length',
    term: 'Unbraced length',
    group: 'structure',
    forms: ['unbraced lengths'],
    definition:
      'The length of a beam between the points that stop it from twisting or moving sideways.',
    sources: [ndsChapter3('3.3.3.7, p. 18')],
  },
  {
    id: 'undisturbed-ground',
    term: 'Undisturbed ground',
    group: 'site',
    forms: ['undisturbed soil'],
    definition:
      "Soil that has not been dug or loosened. Measure a hole's depth from it, not from the loose soil piled beside the hole.",
    sources: [],
  },
  {
    id: 'use-category',
    term: 'Use category',
    group: 'treated-lumber',
    forms: ['use categories'],
    definition:
      "AWPA's rating of where treated wood can go, from indoors to ground contact. UC4A and higher are for ground contact.",
    sources: [AWPA],
  },
  {
    id: 'wane',
    term: 'Wane',
    group: 'lumber',
    forms: [],
    definition: "Bark, or a rounded edge where wood is missing, along a board's edge or corner.",
    sources: [],
  },
  {
    id: 'warp',
    term: 'Warp',
    group: 'lumber',
    forms: ['warped', 'warps'],
    definition: 'Any change from flat and straight in a board, such as bow, crook, or twist.',
    sources: [WARP],
  },
  {
    id: 'waste-side',
    term: 'Waste side',
    group: 'cutting',
    forms: [],
    definition:
      'The side of a cut line away from the part you keep. Cut with the kerf there, so the part keeps its full size.',
    sources: [],
  },
  {
    id: 'wet-service-factor',
    term: 'Wet service factor',
    group: 'structure',
    forms: ['wet service'],
    definition:
      'An adjustment factor that lowers design values for lumber whose moisture content stays above 19% in use.',
    sources: [WET_SERVICE],
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
