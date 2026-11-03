import { z } from 'zod';
import { Citation } from '../design-values/sources.ts';
import type { Operation, OperationType } from '../model/operations.ts';
import { formatAngle } from '../units/angle.ts';
import { formatLength } from '../units/length.ts';
import { FlagCategory, findExpertCheckCategory } from './categories.ts';
import { SkillIdSchema } from './skills.ts';
import { TOOL_TYPES, type ToolTypeId } from './tools.ts';

// Methods: how to do each operation with specific tool types (DOMAIN.md, Operations; decision
// 0009). Build steps (#105) pick, for each operation, the first method in METHODS whose tools the
// inventory has (ARCHITECTURE.md, Method selection), and suggest a tool from a method that is
// easier or more accurate than the one picked.
//
// Text holds no numbers of its own (hard rule 1). A {name} in a step or mistake is a value from
// the operation, filled and formatted by fillMethodText: lengths to the sixteenth and angles with
// their reference, from core's formatters. Text names no tool angle scale: angled lines are laid
// out from measured marks (DOMAIN.md, Units). Safety notes carry their sources (hard rule 5).

const TOOL_IDS = TOOL_TYPES.map((t) => t.id) as [ToolTypeId, ...ToolTypeId[]];

/**
 * A capability that must cover a number from the operation: the owner's value is at least the
 * operation's `atLeast` field divided by `passes`. Two passes is cutting or drilling from two
 * opposite faces, each reaching past halfway.
 */
export const CapabilityNeed = z.object({
  capability: z.string(),
  atLeast: z.string(),
  passes: z.union([z.literal(1), z.literal(2)]).default(1),
});
export type CapabilityNeed = z.infer<typeof CapabilityNeed>;

export const ToolChoice = z.object({
  tool: z.enum(TOOL_IDS),
  needs: z.array(CapabilityNeed).default([]),
});
export type ToolChoice = z.infer<typeof ToolChoice>;

/** One tool the method needs, as any of `anyOf`, and what it is used for. */
export const ToolRequirement = z.object({
  /** What the tool does in this method, after "for": "marking the line". */
  use: z.string().min(1),
  anyOf: z.array(ToolChoice).min(1),
});
export type ToolRequirement = z.infer<typeof ToolRequirement>;

/** A hazard and what to do about it, with where both are described (hard rule 5). */
export const SafetyNote = z.object({
  text: z.string().min(1),
  sources: z.array(Citation).min(1),
});
export type SafetyNote = z.infer<typeof SafetyNote>;

/** An expert check the method raises, in a category from categories.ts. */
export const MethodFlag = z.object({
  category: FlagCategory,
  ask: z.string().min(1),
  why: z.string().min(1),
  sources: z.array(Citation),
});
export type MethodFlag = z.infer<typeof MethodFlag>;

export const Method = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  operation: z.enum([
    'crosscut',
    'miter',
    'taper',
    'joint-edges',
    'glue-up',
    'flatten',
    'rip',
    'dado',
    'stopped-dado',
    'stopped-rabbet',
    'double-stopped-dado',
    'notch',
    'cutout',
    'mortise',
    'tenon',
    'screw-holes',
    'groove',
    'rabbet',
    'finger-recess',
    'bolt-holes',
    'ease-edges',
    'dry-fit',
    'glue-assembly',
    'fasten',
    'acclimate',
    'finish',
    'dig-holes',
    'level-pads',
  ] satisfies OperationType[]),
  /** A short name, in sentence case: "With a miter saw". */
  name: z.string().min(1),
  /** Empty for a method done without tools, such as letting lumber settle. */
  tools: z.array(ToolRequirement),
  skills: z.array(SkillIdSchema).min(1),
  setup: z.array(z.string().min(1)),
  technique: z.array(z.string().min(1)).min(1),
  /** The mistake as it happens, then how to avoid it (docs/design/content.md). */
  mistakes: z.array(z.string().min(1)).min(1),
  safety: z.array(SafetyNote),
  flags: z.array(MethodFlag),
  /** Methods for the same operation that this one is easier than, for tool suggestions. */
  easierThan: z.array(z.string()),
  /** Methods for the same operation that this one is more accurate than. */
  moreAccurateThan: z.array(z.string()),
});
export type Method = z.infer<typeof Method>;

// Values a method's text can name, by operation type: each is a field of the operation or follows
// from its fields. `offset` is where an angled line's short point sits along the far edge,
// measured square from the long point: width · tan(setting).
type Kind = 'length' | 'angle' | 'count';
type ValuesOf<T extends OperationType> = Record<
  string,
  { kind: Kind; of: (op: Extract<Operation, { type: T }>) => number }
>;
const RAD = Math.PI / 180;
const count = { kind: 'count', of: (op: { count: number }) => op.count } as const;

export const METHOD_VALUES: { [T in OperationType]: ValuesOf<T> } = {
  crosscut: {
    count,
    width: { kind: 'length', of: (op) => op.width },
    thickness: { kind: 'length', of: (op) => op.thickness },
  },
  miter: {
    count,
    setting: { kind: 'angle', of: (op) => op.setting },
    width: { kind: 'length', of: (op) => op.width },
    thickness: { kind: 'length', of: (op) => op.thickness },
    offset: { kind: 'length', of: (op) => op.width * Math.tan(op.setting * RAD) },
  },
  taper: {
    count,
    angleToEdge: { kind: 'angle', of: (op) => op.angleToEdge },
    length: { kind: 'length', of: (op) => op.length },
    thickness: { kind: 'length', of: (op) => op.thickness },
  },
  'joint-edges': {
    count,
    length: { kind: 'length', of: (op) => op.length },
    thickness: { kind: 'length', of: (op) => op.thickness },
  },
  'glue-up': {
    count,
    boards: { kind: 'count', of: (op) => op.boards },
    width: { kind: 'length', of: (op) => op.width },
    length: { kind: 'length', of: (op) => op.length },
  },
  flatten: {
    count,
    width: { kind: 'length', of: (op) => op.width },
    length: { kind: 'length', of: (op) => op.length },
    thickness: { kind: 'length', of: (op) => op.thickness },
  },
  rip: {
    count,
    width: { kind: 'length', of: (op) => op.width },
    length: { kind: 'length', of: (op) => op.length },
    thickness: { kind: 'length', of: (op) => op.thickness },
  },
  dado: {
    count,
    width: { kind: 'length', of: (op) => op.width },
    length: { kind: 'length', of: (op) => op.length },
    depth: { kind: 'length', of: (op) => op.depth },
  },
  'stopped-dado': {
    count,
    width: { kind: 'length', of: (op) => op.width },
    length: { kind: 'length', of: (op) => op.length },
    depth: { kind: 'length', of: (op) => op.depth },
  },
  'double-stopped-dado': {
    count,
    width: { kind: 'length', of: (op) => op.width },
    length: { kind: 'length', of: (op) => op.length },
    depth: { kind: 'length', of: (op) => op.depth },
  },
  'stopped-rabbet': {
    count,
    width: { kind: 'length', of: (op) => op.width },
    length: { kind: 'length', of: (op) => op.length },
    depth: { kind: 'length', of: (op) => op.depth },
  },
  notch: {
    count,
    along: { kind: 'length', of: (op) => op.along },
    across: { kind: 'length', of: (op) => op.across },
    thickness: { kind: 'length', of: (op) => op.thickness },
  },
  cutout: {
    count,
    width: { kind: 'length', of: (op) => op.width },
    depth: { kind: 'length', of: (op) => op.depth },
    thickness: { kind: 'length', of: (op) => op.thickness },
  },
  mortise: {
    count,
    length: { kind: 'length', of: (op) => op.length },
    width: { kind: 'length', of: (op) => op.width },
    depth: { kind: 'length', of: (op) => op.depth },
  },
  groove: {
    count,
    length: { kind: 'length', of: (op) => op.length },
    width: { kind: 'length', of: (op) => op.width },
    depth: { kind: 'length', of: (op) => op.depth },
  },
  rabbet: {
    count,
    length: { kind: 'length', of: (op) => op.length },
    width: { kind: 'length', of: (op) => op.width },
    depth: { kind: 'length', of: (op) => op.depth },
  },
  'finger-recess': {
    count,
    width: { kind: 'length', of: (op) => op.width },
    height: { kind: 'length', of: (op) => op.height },
    depth: { kind: 'length', of: (op) => op.depth },
  },
  'screw-holes': {
    count,
    round: { kind: 'count', of: (op) => op.round },
    slotted: { kind: 'count', of: (op) => op.slotted },
    slot: { kind: 'length', of: (op) => op.slot },
    thickness: { kind: 'length', of: (op) => op.thickness },
  },
  tenon: {
    count,
    length: { kind: 'length', of: (op) => op.length },
    tenonThickness: { kind: 'length', of: (op) => op.tenonThickness },
    width: { kind: 'length', of: (op) => op.width },
    cheekBack: { kind: 'length', of: (op) => op.cheekBack },
    cheekFront: { kind: 'length', of: (op) => op.cheekFront },
  },
  'bolt-holes': {
    count,
    boltDiameter: { kind: 'length', of: (op) => op.boltDiameter },
    holeDiameter: { kind: 'length', of: (op) => op.holeDiameter },
    depth: { kind: 'length', of: (op) => op.depth },
  },
  'ease-edges': { count },
  'dry-fit': { count, reach: { kind: 'length', of: (op) => op.reach } },
  'glue-assembly': { count, reach: { kind: 'length', of: (op) => op.reach } },
  fasten: { count },
  acclimate: { count },
  finish: { count },
  'dig-holes': { count, depth: { kind: 'length', of: (op) => op.depth } },
  'level-pads': { count },
};

const PLACEHOLDER = /\{([a-zA-Z]+)\}/g;

/** The names of the values a piece of method text uses. */
export function placeholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[1] ?? '');
}

/**
 * Method text with each {name} replaced by the operation's value, formatted by core: lengths to
 * the sixteenth, angles to a tenth of a degree. Throws on a name the operation type does not have.
 */
export function fillMethodText(text: string, op: Operation): string {
  const values = METHOD_VALUES[op.type] as ValuesOf<OperationType>;
  return text.replace(PLACEHOLDER, (_, name: string) => {
    const value = values[name];
    if (!value) throw new Error(`${op.type} has no value {${name}}`);
    const n = value.of(op as never);
    return value.kind === 'length'
      ? formatLength(n)
      : value.kind === 'angle'
        ? formatAngle(n)
        : `${n}`;
  });
}

// Safety notes used by several methods.
const ETOOL_CIRCULAR =
  'https://www.osha.gov/etools/woodworking/production/machines-tools/handheld-circular-saws';

const CIRCULAR_SAW_KICKBACK = {
  text: 'A circular saw kicks back toward you when the blade pinches in the cut. Support the board and both pieces of it, so neither drops into the blade as the cut finishes, and keep your hands out of the line of the cut.',
  sources: [
    {
      source: 'osha-woodworking-etool',
      locator: 'Handheld Circular Saws: kickbacks and point of operation',
      url: ETOOL_CIRCULAR,
    },
  ],
} satisfies z.input<typeof SafetyNote>;

const CIRCULAR_SAW_GUARD = {
  text: 'Let the lower guard close over the blade on its own after every cut. Never wedge or tie it open.',
  sources: [{ source: 'osha-3080', locator: 'Guards, p. 5' }],
} satisfies z.input<typeof SafetyNote>;

const GUARDS_STAY_ON = {
  text: 'Keep the blade guard on and working: it must cover the blade whenever the blade is not in the wood.',
  sources: [{ source: 'osha-3080', locator: 'Guards, p. 5' }],
} satisfies z.input<typeof SafetyNote>;

const CLAMP_THE_WORK = {
  text: 'Clamp the work down, so both hands are free for the tool.',
  sources: [{ source: 'osha-3080', locator: 'Power tools, general precautions, p. 4' }],
} satisfies z.input<typeof SafetyNote>;

const UNPLUG_TO_CHANGE = {
  text: 'Unplug the tool, or take out its battery, before you change a blade or bit.',
  sources: [{ source: 'osha-3080', locator: 'Power tools, general precautions, p. 4' }],
} satisfies z.input<typeof SafetyNote>;

const WOOD_DUST = {
  text: 'Breathing wood dust can cause respiratory symptoms. Wear a dust mask while you sand, and sweep up the dust rather than blowing it.',
  sources: [{ source: 'osha-wood-dust', locator: 'Overview' }],
} satisfies z.input<typeof SafetyNote>;

const OILY_RAGS = {
  text: 'Rags wet with oil-based finish can catch fire on their own. Store them in a tightly sealed metal container, then throw them away.',
  sources: [{ source: 'usfa-oily-rags', locator: 'Pictograph' }],
} satisfies z.input<typeof SafetyNote>;

const BURIED_LINES = {
  text: 'Contact 811 a few business days before you dig, to have buried utility lines marked. Wait until every utility has marked its lines, then dig carefully around the marks.',
  sources: [{ source: 'cga-811', locator: 'Home page' }],
} satisfies z.input<typeof SafetyNote>;

const BOLT_HOLE_SIZE = {
  text: 'Drill {holeDiameter} for a {boltDiameter} bolt. A hole a little larger than the bolt lets it go in without being driven.',
  sources: [{ source: 'nds-2024', locator: 'Section 12.1.3.2' }],
} satisfies z.input<typeof SafetyNote>;

const DUST_FLAG = {
  category: 'dust-and-species',
  ask: 'Ask an experienced builder whether the preservative in your treated lumber calls for more than a dust mask, gloves, and washing up when you sand it.',
  why: 'Breathing wood dust can cause allergic and other respiratory symptoms, and dust from treated wood carries the preservative.',
  sources: [{ source: 'osha-wood-dust', locator: 'Overview' }],
} satisfies z.input<typeof MethodFlag>;

const ETOOL = 'https://www.osha.gov/etools/woodworking/production/machines-tools';

const TABLE_SAW_KICKBACK = {
  text: 'Kickback is more likely when ripping than crosscutting. Use a spreader, guide the board along the fence, push it past the blade with a push stick, and stand to the side of the blade.',
  sources: [
    {
      source: 'osha-woodworking-etool',
      locator: 'Table Saws: kickbacks and point of operation',
      url: `${ETOOL}/table-saws`,
    },
  ],
} satisfies z.input<typeof SafetyNote>;

const RIP_BLADE = {
  text: 'Use a sharp blade made for ripping, set to the height its manual gives. A wrong or dull blade, or the wrong height, makes kickback more likely.',
  sources: [
    {
      source: 'osha-woodworking-etool',
      locator: 'Table Saws: kickbacks',
      url: `${ETOOL}/table-saws`,
    },
  ],
} satisfies z.input<typeof SafetyNote>;

const JOINTER_GUARD = {
  text: 'Keep the jointer guard on: it covers the cutterhead except where the board is passing over it. Take light cuts, since a deep cut makes kickback more likely and opens more of the knives.',
  sources: [
    {
      source: 'osha-woodworking-etool',
      locator: 'Jointers: point of operation and kickbacks',
      url: `${ETOOL}/jointers`,
    },
  ],
} satisfies z.input<typeof SafetyNote>;

const PLANER_ROLLS = {
  text: 'Keep your hands clear of the in-feed rolls, which can pinch them against the board, and stand out of line with the board in case it kicks back.',
  sources: [
    {
      source: 'osha-woodworking-etool',
      locator: 'Planers: hazards',
      url: `${ETOOL}/planers`,
    },
  ],
} satisfies z.input<typeof SafetyNote>;

const ROUTER_BIT = {
  text: 'Seat the bit in the collet and tighten it before you start: a loose bit can be thrown out of the router. Unplug the router to change it.',
  sources: [
    {
      source: 'osha-woodworking-etool',
      locator: 'Routers: tool projection',
      url: `${ETOOL}/routers`,
    },
  ],
} satisfies z.input<typeof SafetyNote>;

const ROUTER_FEED = {
  text: 'Clamp the work and the guide, and feed the router steadily. Feeding abruptly or the wrong way can make it kick back.',
  sources: [
    {
      source: 'osha-woodworking-etool',
      locator: 'Routers: kickbacks',
      url: `${ETOOL}/routers`,
    },
  ],
} satisfies z.input<typeof SafetyNote>;

const BAND_SAW_GUARD = {
  text: 'Set the upper guide and guard close above the board, clear of it, and use a push stick when your hand would come near the blade.',
  sources: [
    {
      source: 'osha-woodworking-etool',
      locator: 'Band Saws: point of operation',
      url: `${ETOOL}/band-saws`,
    },
  ],
} satisfies z.input<typeof SafetyNote>;

/** A method flag that asks the category's own question (categories.ts). */
function categoryFlag(id: FlagCategory): z.input<typeof MethodFlag> {
  const { category, ask, why, sources } = { category: id, ...findExpertCheckCategory(id) };
  return { category, ask, why, sources: [...sources] };
}

// Tool requirements used by several methods.
const TAPE = { use: 'measuring', anyOf: [{ tool: 'tape-measure' }] } satisfies z.input<
  typeof ToolRequirement
>;
const SQUARE = {
  use: 'marking a square line',
  anyOf: [{ tool: 'combination-square' }, { tool: 'rafter-square' }],
} satisfies z.input<typeof ToolRequirement>;
const STRAIGHTEDGE = {
  use: 'joining marks with a straight line',
  anyOf: [{ tool: 'combination-square' }, { tool: 'rafter-square' }],
} satisfies z.input<typeof ToolRequirement>;
const CLAMPS = { use: 'holding the work', anyOf: [{ tool: 'clamps' }] } satisfies z.input<
  typeof ToolRequirement
>;

const MITER_SAW_THROUGH = [
  { capability: 'cutDepth', atLeast: 'thickness' },
  { capability: 'crosscutWidth', atLeast: 'width' },
];

/**
 * Every method, grouped by operation type. Within a type, the order is the preference order:
 * build steps use the first method the inventory supports. Stationary and guided power tools come
 * first because they hold the angle and the line for you; hand tools come last.
 */
/** The plan gives the housed part's thickness; the part as made is what the dado must fit. */
const DADO_FROM_THE_PART =
  "Measure the thickness of the part the dado holds, and cut the dado to that, not to the plan's {width}: a flattened panel can come out a little thinner.";

export const METHODS = [
  // Crosscut (square)
  {
    id: 'crosscut-miter-saw',
    operation: 'crosscut',
    name: 'With a miter saw',
    tools: [{ use: 'cutting', anyOf: [{ tool: 'miter-saw', needs: MITER_SAW_THROUGH }] }, TAPE],
    skills: ['measure-and-mark', 'cut-to-a-line'],
    setup: [
      'Set the miter saw square, with no miter and no bevel.',
      'Support the board level with the saw table on both sides of the blade.',
    ],
    technique: [
      'Mark the length on the board.',
      'Hold the board against the fence, with the blade on the waste side of the mark.',
      'Let the blade reach full speed, then lower it through the board.',
      'Let the blade stop before you raise it.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Cutting on the mark makes the part short by the width of the blade. Put the blade on the waste side of the mark.',
    ],
    safety: [GUARDS_STAY_ON, UNPLUG_TO_CHANGE],
    flags: [],
    easierThan: ['crosscut-circular-saw', 'crosscut-circular-saw-two-faces', 'crosscut-hand-saw'],
    moreAccurateThan: [
      'crosscut-circular-saw',
      'crosscut-circular-saw-two-faces',
      'crosscut-hand-saw',
    ],
  },
  {
    id: 'crosscut-circular-saw',
    operation: 'crosscut',
    name: 'With a circular saw',
    tools: [
      {
        use: 'cutting',
        anyOf: [
          { tool: 'circular-saw', needs: [{ capability: 'depthOfCut', atLeast: 'thickness' }] },
        ],
      },
      TAPE,
      {
        use: 'guiding the saw',
        anyOf: [{ tool: 'rafter-square' }, { tool: 'combination-square' }],
      },
      CLAMPS,
    ],
    skills: ['measure-and-mark', 'square-a-line', 'guide-a-circular-saw', 'cut-to-a-line'],
    setup: [
      'Set the blade a little deeper than the board is thick, {thickness}.',
      'Support the board on sawhorses or blocks on both sides of the cut, and clamp it.',
    ],
    technique: [
      'Mark the length and square a line across the face.',
      'Hold the square tight to the edge, with the saw base against it and the blade on the waste side of the line.',
      'Start the saw clear of the board and feed it through at an even speed.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Letting the saw drift away from the square bends the cut and can bind the blade. Keep the base tight to the square for the whole cut.',
    ],
    safety: [CIRCULAR_SAW_KICKBACK, CIRCULAR_SAW_GUARD, CLAMP_THE_WORK, UNPLUG_TO_CHANGE],
    flags: [],
    easierThan: ['crosscut-circular-saw-two-faces', 'crosscut-hand-saw'],
    moreAccurateThan: ['crosscut-circular-saw-two-faces', 'crosscut-hand-saw'],
  },
  {
    id: 'crosscut-circular-saw-two-faces',
    operation: 'crosscut',
    name: 'With a circular saw, from two faces',
    tools: [
      {
        use: 'cutting',
        anyOf: [
          {
            tool: 'circular-saw',
            needs: [{ capability: 'depthOfCut', atLeast: 'thickness', passes: 2 }],
          },
        ],
      },
      TAPE,
      {
        use: 'guiding the saw',
        anyOf: [{ tool: 'rafter-square' }, { tool: 'combination-square' }],
      },
      CLAMPS,
    ],
    skills: [
      'measure-and-mark',
      'square-a-line',
      'guide-a-circular-saw',
      'cut-from-two-faces',
      'cut-to-a-line',
    ],
    setup: [
      'Set the blade as deep as it goes.',
      'Support the board on sawhorses or blocks on both sides of the cut, and clamp it.',
    ],
    technique: [
      'Mark the length and square the line around all four faces.',
      'Cut along the line on one face, with the blade on the waste side.',
      'Turn the board over and cut along the line on the opposite face, so the two kerfs meet.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Lines that do not meet at the corners leave a step where the two cuts meet. Square every line from the same edge and face, and check that the last line meets the first.',
    ],
    safety: [CIRCULAR_SAW_KICKBACK, CIRCULAR_SAW_GUARD, CLAMP_THE_WORK, UNPLUG_TO_CHANGE],
    flags: [],
    easierThan: ['crosscut-hand-saw'],
    moreAccurateThan: [],
  },
  {
    id: 'crosscut-hand-saw',
    operation: 'crosscut',
    name: 'With a hand saw',
    tools: [{ use: 'cutting', anyOf: [{ tool: 'hand-saw' }] }, TAPE, SQUARE, CLAMPS],
    skills: ['measure-and-mark', 'square-a-line', 'saw-by-hand', 'cut-to-a-line'],
    setup: ['Clamp the board to sawhorses with the cut a little past their ends.'],
    technique: [
      'Mark the length and square the line across the face and down both edges.',
      'Start the cut at the far corner on the waste side of the line.',
      'Saw with long, light strokes, watching the line on the face and the near edge.',
      'Support the offcut with your free hand for the last strokes, so it does not break off.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Watching only the face lets the saw lean, so the cut is out of square through the thickness. Check the line on the edge every few strokes.',
    ],
    safety: [CLAMP_THE_WORK],
    flags: [],
    easierThan: [],
    moreAccurateThan: [],
  },

  // Miter (an angled crosscut, laid out from the reference edge)
  {
    id: 'miter-miter-saw',
    operation: 'miter',
    name: 'With a miter saw',
    tools: [
      {
        use: 'cutting',
        anyOf: [
          {
            tool: 'miter-saw',
            needs: [...MITER_SAW_THROUGH, { capability: 'maxMiter', atLeast: 'setting' }],
          },
        ],
      },
      TAPE,
    ],
    skills: ['measure-and-mark', 'cut-to-a-line'],
    setup: [
      'Set the miter saw to {setting}, turned the way the cut detail shows.',
      'Make a test cut in scrap at this setting and check that it crosses the full {width} width.',
      'Support the board level with the saw table on both sides of the blade.',
    ],
    technique: [
      'Mark the length on the edge the cut detail measures from.',
      'Hold the board against the fence, with the blade on the waste side of the mark.',
      'Let the blade reach full speed, then lower it through the board.',
      'Let the blade stop before you raise it.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Setting the saw to the angle between the cut and the edge cuts the wrong angle. Set it to {setting}, the setting the cut detail gives.',
      'Turning the saw the wrong way cuts the mirror image of the end in the cut detail. Check the direction against the cut detail before each cut.',
      'A saw turned to an angle cuts across less than it does square, so the cut can stop short of the far edge. Make the test cut first.',
    ],
    safety: [GUARDS_STAY_ON, UNPLUG_TO_CHANGE],
    flags: [],
    easierThan: ['miter-circular-saw', 'miter-circular-saw-two-faces', 'miter-hand-saw'],
    moreAccurateThan: ['miter-circular-saw', 'miter-circular-saw-two-faces', 'miter-hand-saw'],
  },
  {
    id: 'miter-circular-saw',
    operation: 'miter',
    name: 'With a circular saw',
    tools: [
      {
        use: 'cutting',
        anyOf: [
          { tool: 'circular-saw', needs: [{ capability: 'depthOfCut', atLeast: 'thickness' }] },
        ],
      },
      TAPE,
      SQUARE,
      STRAIGHTEDGE,
      {
        use: 'guiding the saw along the line',
        anyOf: [{ tool: 'rafter-square' }, { tool: 'clamps' }],
      },
    ],
    skills: [
      'measure-and-mark',
      'square-a-line',
      'lay-out-an-angle',
      'guide-a-circular-saw',
      'cut-to-a-line',
    ],
    setup: [
      'Set the blade a little deeper than the board is thick, {thickness}.',
      'Support the board on sawhorses or blocks on both sides of the cut, and clamp it.',
    ],
    technique: [
      'Mark the long point on the edge the cut detail measures from.',
      'Square a line across the face from the long point.',
      'On the opposite edge, measure {offset} from that square line toward the rest of the part and mark the short point.',
      'Join the long point and the short point with a straightedge. This is the cut line.',
      'Hold a rafter square on the line, or clamp a straight board beside it, as a guide for the saw base, with the blade on the waste side.',
      'Start the saw clear of the board and feed it through at an even speed.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Measuring {offset} away from the rest of the part makes the line lean the wrong way. Measure toward the rest of the part, so the long point is the end of the board.',
      'Setting a guide by eye from an angle scale gives an angle you cannot check. Lay the line out from the two points, and check the first cut against the cut detail.',
    ],
    safety: [CIRCULAR_SAW_KICKBACK, CIRCULAR_SAW_GUARD, CLAMP_THE_WORK, UNPLUG_TO_CHANGE],
    flags: [],
    easierThan: ['miter-circular-saw-two-faces', 'miter-hand-saw'],
    moreAccurateThan: ['miter-circular-saw-two-faces', 'miter-hand-saw'],
  },
  {
    id: 'miter-circular-saw-two-faces',
    operation: 'miter',
    name: 'With a circular saw, from two faces',
    tools: [
      {
        use: 'cutting',
        anyOf: [
          {
            tool: 'circular-saw',
            needs: [{ capability: 'depthOfCut', atLeast: 'thickness', passes: 2 }],
          },
        ],
      },
      TAPE,
      SQUARE,
      STRAIGHTEDGE,
      {
        use: 'guiding the saw along the line',
        anyOf: [{ tool: 'rafter-square' }, { tool: 'clamps' }],
      },
    ],
    skills: [
      'measure-and-mark',
      'square-a-line',
      'lay-out-an-angle',
      'guide-a-circular-saw',
      'cut-from-two-faces',
      'cut-to-a-line',
    ],
    setup: [
      'Set the blade as deep as it goes.',
      'Support the board on sawhorses or blocks on both sides of the cut, and clamp it.',
    ],
    technique: [
      'Mark the long point on the edge the cut detail measures from.',
      'Square a line across the face from the long point.',
      'On the opposite edge, measure {offset} from that square line toward the rest of the part and mark the short point.',
      'Join the two points with a straightedge, then square the line from each point down both edges and join them across the other face.',
      'Cut along the line on one face, guided by a rafter square on the line or a straight board clamped beside it, with the blade on the waste side.',
      'Turn the board over and cut along the line on the other face, so the two kerfs meet.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Joining the points on the second face from the wrong ends makes a line that crosses the first one. Carry each point down its own edge and join those two marks.',
    ],
    safety: [CIRCULAR_SAW_KICKBACK, CIRCULAR_SAW_GUARD, CLAMP_THE_WORK, UNPLUG_TO_CHANGE],
    flags: [],
    easierThan: ['miter-hand-saw'],
    moreAccurateThan: [],
  },
  {
    id: 'miter-hand-saw',
    operation: 'miter',
    name: 'With a hand saw',
    tools: [{ use: 'cutting', anyOf: [{ tool: 'hand-saw' }] }, TAPE, SQUARE, STRAIGHTEDGE, CLAMPS],
    skills: [
      'measure-and-mark',
      'square-a-line',
      'lay-out-an-angle',
      'saw-by-hand',
      'cut-to-a-line',
    ],
    setup: ['Clamp the board to sawhorses with the cut a little past their ends.'],
    technique: [
      'Mark the long point on the edge the cut detail measures from.',
      'Square a line across the face from the long point.',
      'On the opposite edge, measure {offset} from that square line toward the rest of the part and mark the short point.',
      'Join the two points with a straightedge, and square the line down both edges.',
      'Start the cut at the long point on the waste side of the line.',
      'Saw with long, light strokes, watching the line on the face and both edges.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Watching only the face lets the saw lean, so the cut is out of square through the thickness. Check the lines on the edges every few strokes.',
    ],
    safety: [CLAMP_THE_WORK],
    flags: [],
    easierThan: [],
    moreAccurateThan: [],
  },

  // Taper (a straight cut along the part, from the reference edge to an end cut)
  {
    id: 'taper-jigsaw',
    operation: 'taper',
    name: 'With a jigsaw',
    tools: [
      {
        use: 'cutting',
        anyOf: [{ tool: 'jigsaw', needs: [{ capability: 'depthOfCut', atLeast: 'thickness' }] }],
      },
      TAPE,
      SQUARE,
      STRAIGHTEDGE,
      CLAMPS,
      { use: 'cleaning up the cut', anyOf: [{ tool: 'block-plane' }, { tool: 'chisel' }] },
    ],
    skills: [
      'measure-and-mark',
      'square-a-line',
      'lay-out-an-angle',
      'cut-to-a-line',
      'pare-to-a-line',
    ],
    setup: [
      'Fit the longest blade you have, and set the blade square to the base.',
      'Clamp the part with the taper past the edge of the bench or sawhorse.',
    ],
    technique: [
      "Mark the taper's two points from its note in the cut list, and join them with a straightedge. The line is {length} long, at {angleToEdge} to the edge.",
      'Square each point across to the other face and join them there too.',
      'Cut on the waste side of the line, from the end of the part, slowly enough that the blade does not bend.',
      'Plane or pare the cut down to the line on both faces.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'A jigsaw blade bends in stock {thickness} thick, so the cut wanders off the line on the far face. Feed slowly, check the far face as you go, and leave the cut proud of the line to plane down.',
    ],
    safety: [CLAMP_THE_WORK, UNPLUG_TO_CHANGE],
    flags: [],
    easierThan: ['taper-circular-saw', 'taper-hand-saw'],
    moreAccurateThan: ['taper-hand-saw'],
  },
  {
    id: 'taper-circular-saw',
    operation: 'taper',
    name: 'With a circular saw, from two faces',
    tools: [
      {
        use: 'cutting most of the way',
        anyOf: [
          {
            tool: 'circular-saw',
            needs: [{ capability: 'depthOfCut', atLeast: 'thickness', passes: 2 }],
          },
        ],
      },
      { use: 'finishing the cut where the round blade stops short', anyOf: [{ tool: 'hand-saw' }] },
      TAPE,
      SQUARE,
      STRAIGHTEDGE,
      CLAMPS,
      { use: 'cleaning up the cut', anyOf: [{ tool: 'block-plane' }, { tool: 'chisel' }] },
    ],
    skills: [
      'measure-and-mark',
      'square-a-line',
      'lay-out-an-angle',
      'guide-a-circular-saw',
      'cut-from-two-faces',
      'saw-by-hand',
      'pare-to-a-line',
    ],
    setup: [
      'Set the blade as deep as it goes.',
      'Clamp the part flat, with the taper clear of the bench or sawhorse.',
    ],
    technique: [
      "Mark the taper's two points from its note in the cut list, and join them with a straightedge. The line is {length} long, at {angleToEdge} to the edge.",
      'Square each point across to the other face and join them there too.',
      'Clamp a straight board beside the line as a guide, and cut from the end of the part along the waste side of the line until the blade reaches the far point.',
      'Turn the part over and cut along the line on the other face.',
      'Finish the cut with a hand saw where the round blade stopped short of the point.',
      'Plane or pare the cut down to the line on both faces.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Running the saw past the far point cuts into the part beyond the taper. Mark where the blade must stop on the guide, and stop the saw there.',
    ],
    safety: [CIRCULAR_SAW_KICKBACK, CIRCULAR_SAW_GUARD, CLAMP_THE_WORK, UNPLUG_TO_CHANGE],
    flags: [],
    easierThan: ['taper-hand-saw'],
    moreAccurateThan: ['taper-hand-saw'],
  },
  {
    id: 'taper-hand-saw',
    operation: 'taper',
    name: 'With a hand saw',
    tools: [
      { use: 'cutting', anyOf: [{ tool: 'hand-saw' }] },
      TAPE,
      SQUARE,
      STRAIGHTEDGE,
      CLAMPS,
      { use: 'cleaning up the cut', anyOf: [{ tool: 'block-plane' }, { tool: 'chisel' }] },
    ],
    skills: [
      'measure-and-mark',
      'square-a-line',
      'lay-out-an-angle',
      'saw-by-hand',
      'pare-to-a-line',
    ],
    setup: ['Clamp the part upright, or flat with the taper past the edge of the bench.'],
    technique: [
      "Mark the taper's two points from its note in the cut list, and join them with a straightedge. The line is {length} long, at {angleToEdge} to the edge.",
      'Square each point across to the other face and join them there too.',
      'Saw from the end of the part along the waste side of the line, watching the lines on both faces.',
      'Plane or pare the cut down to the line on both faces.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Watching only one face lets the saw lean, so the cut leaves wood on the far face. Check the far face every few strokes.',
    ],
    safety: [CLAMP_THE_WORK],
    flags: [],
    easierThan: [],
    moreAccurateThan: [],
  },

  // Joint edges (a panel's glued edges). Wood Handbook ch. 10 (pp. 10-3, 10-14): a knife-cut
  // surface from a jointer bonds best, a well-kept saw makes one good enough, and feeding a jointer
  // too fast crushes the surface; surface the edges shortly before gluing.
  {
    id: 'joint-edges-jointer',
    operation: 'joint-edges',
    name: 'With a jointer',
    tools: [
      { use: 'jointing the edges', anyOf: [{ tool: 'jointer' }] },
      {
        use: 'checking the edge square',
        anyOf: [{ tool: 'combination-square' }, { tool: 'rafter-square' }],
      },
    ],
    skills: ['joint-an-edge'],
    setup: [
      'Set the fence square to the table and check it with the square.',
      'Set a light cut.',
      'Lay the boards out in the order they go in the panel and mark a line across all of them, so they go back the same way.',
    ],
    technique: [
      'Hold each board with its face against the fence and feed its edge over the cutterhead at a slow, even speed.',
      'Keep jointing until the edge is straight along its length, {length}, and square to the face.',
      'Joint the edges on the day you glue up, so they are still clean and straight.',
      'Joint {count} edges this way.',
    ],
    mistakes: [
      'Feeding fast crushes the wood and leaves a shiny edge that glue does not soak into. Feed slowly enough that the knives cut cleanly.',
      'A slight hollow or hump in an edge leaves a gap in the glue line. Hold each pair of mating edges together against a light and look for gaps before you glue.',
    ],
    safety: [JOINTER_GUARD, UNPLUG_TO_CHANGE],
    flags: [categoryFlag('jointer-planer-lathe')],
    easierThan: [],
    moreAccurateThan: ['joint-edges-table-saw', 'joint-edges-track-saw'],
  },
  {
    id: 'joint-edges-table-saw',
    operation: 'joint-edges',
    name: 'With a table saw',
    tools: [{ use: 'trimming the edges', anyOf: [{ tool: 'table-saw' }] }],
    skills: ['rip-along-a-fence'],
    setup: [
      'Lay the boards out in the order they go in the panel and mark a line across all of them, so they go back the same way.',
      'Set the fence to trim a thin strip off the edge.',
    ],
    technique: [
      'Rip each glued edge with the opposite edge against the fence, feeding at an even speed for the whole {length}.',
      'Joint the edges on the day you glue up, so they are still clean and straight.',
      'Trim {count} edges this way.',
    ],
    mistakes: [
      'An edge sawn with its other edge against the fence is only as straight as that edge. Rip with the straighter edge against the fence first.',
    ],
    safety: [TABLE_SAW_KICKBACK, RIP_BLADE, GUARDS_STAY_ON],
    flags: [categoryFlag('table-saw')],
    easierThan: [],
    moreAccurateThan: ['joint-edges-track-saw'],
  },
  {
    id: 'joint-edges-track-saw',
    operation: 'joint-edges',
    name: 'With a track saw',
    tools: [
      {
        use: 'trimming the edges',
        anyOf: [{ tool: 'track-saw' }],
      },
      CLAMPS,
    ],
    skills: ['rip-along-a-fence'],
    setup: [
      'Lay the boards out in the order they go in the panel and mark a line across all of them, so they go back the same way.',
      'Support each board flat on a sacrificial surface and clamp it.',
    ],
    technique: [
      'Lay the rail along the edge so the blade trims a thin strip off its full length, {length}.',
      'Joint the edges on the day you glue up, so they are still clean and straight.',
      'Trim {count} edges this way.',
    ],
    mistakes: [
      'A rail that shifts during the cut leaves a curve in the edge. Clamp the board and keep the saw against the rail for the whole cut.',
    ],
    safety: [CIRCULAR_SAW_KICKBACK, CLAMP_THE_WORK, UNPLUG_TO_CHANGE],
    flags: [],
    easierThan: ['joint-edges-jointer', 'joint-edges-table-saw'],
    moreAccurateThan: [],
  },

  // Glue up (a panel). Wood Handbook ch. 10 (pp. 10-14 to 10-16): pressure brings the surfaces into
  // contact and squeezes the glue into a thin film, too much starves the joint, poorly mated
  // surfaces leave thick, weak glue lines, and the work stays clamped until the glue holds.
  {
    id: 'glue-up-clamps-and-cauls',
    operation: 'glue-up',
    name: 'With clamps and cauls',
    tools: [
      {
        use: 'clamping the panel',
        anyOf: [{ tool: 'clamps', needs: [{ capability: 'maxOpening', atLeast: 'width' }] }],
      },
    ],
    skills: ['glue-up-a-panel'],
    setup: [
      'Lay the {boards} boards out in order with your marks lined up, and clamp them dry to check that every joint closes along its length with light pressure.',
      'Open the clamps past {width}, and cut straight scrap boards for cauls, as long as the panel is wide.',
    ],
    technique: [
      'Spread glue evenly along every glued edge.',
      'Bring the boards together and put clamps across the panel, alternating above and below it.',
      'Clamp a caul across each end of the panel, on both faces, to hold the boards level with each other.',
      'Tighten the clamps evenly until a small bead of glue squeezes out along each joint.',
      'Leave the panel clamped for as long as the glue maker says.',
      'Glue up {count} this way.',
    ],
    mistakes: [
      'Clamping as hard as you can squeezes out the glue the joint needs. Tighten only until a small, even bead appears.',
      'Using clamp pressure to close a gap leaves a thick, weak glue line. Joint the edges again until they meet along their length.',
      'Glue left to skin over before the boards go together does not wet the other edge. Have everything ready before you spread the glue.',
    ],
    safety: [],
    flags: [],
    easierThan: [],
    moreAccurateThan: ['glue-up-clamps'],
  },
  {
    id: 'glue-up-clamps',
    operation: 'glue-up',
    name: 'With clamps alone',
    tools: [
      {
        use: 'clamping the panel',
        anyOf: [{ tool: 'clamps', needs: [{ capability: 'maxOpening', atLeast: 'width' }] }],
      },
    ],
    skills: ['glue-up-a-panel'],
    setup: [
      'Lay the {boards} boards out in order with your marks lined up, and clamp them dry to check that every joint closes along its length with light pressure.',
      'Open the clamps past {width}.',
    ],
    technique: [
      'Spread glue evenly along every glued edge.',
      'Bring the boards together and put clamps across the panel, alternating above and below it.',
      'Tighten the clamps evenly, pressing the faces level at each joint as you go, until a small bead of glue squeezes out along each joint.',
      'Leave the panel clamped for as long as the glue maker says.',
      'Glue up {count} this way.',
    ],
    mistakes: [
      'Clamping as hard as you can squeezes out the glue the joint needs. Tighten only until a small, even bead appears.',
      'Boards that slip out of level as the clamps tighten leave a step to plane or sand away. Check each joint with your fingers before the final tightening.',
    ],
    safety: [],
    flags: [],
    easierThan: ['glue-up-clamps-and-cauls'],
    moreAccurateThan: [],
  },

  // Flatten (a glued-up panel). Wood Handbook ch. 10 (p. 10-16): water from the glue swells the
  // wood along each joint, so a panel surfaced too soon ends up with sunken glue lines.
  {
    id: 'flatten-thickness-planer',
    operation: 'flatten',
    name: 'With a thickness planer',
    tools: [
      {
        use: 'planing the faces',
        anyOf: [
          { tool: 'thickness-planer', needs: [{ capability: 'maxWidth', atLeast: 'width' }] },
        ],
      },
    ],
    skills: ['flatten-a-panel'],
    setup: [
      'Let the panel rest for several days after glue-up, so the wood along the joints dries back before you plane it.',
      'Scrape off the dried glue on both faces.',
    ],
    technique: [
      'Feed the panel with the grain, taking light cuts and turning it over each time so both faces come down evenly.',
      'Stop when a straightedge laid across the {width} panel touches everywhere, and plane both faces evenly down to {thickness}.',
      'Flatten {count} this way.',
    ],
    mistakes: [
      'Planing the day after glue-up leaves glue lines that sink below the surface as the joints dry. Wait several days.',
      'Dried glue left on the faces dulls the knives. Scrape it off first.',
    ],
    safety: [PLANER_ROLLS],
    flags: [categoryFlag('jointer-planer-lathe')],
    easierThan: ['flatten-sander'],
    moreAccurateThan: ['flatten-sander'],
  },
  {
    id: 'flatten-sander',
    operation: 'flatten',
    name: 'With a sander',
    tools: [{ use: 'sanding the faces', anyOf: [{ tool: 'sander' }] }, CLAMPS],
    skills: ['flatten-a-panel'],
    setup: [
      'Let the panel rest for several days after glue-up, so the wood along the joints dries back before you sand it.',
      'Scrape off the dried glue on both faces, and clamp the panel flat to the bench.',
    ],
    technique: [
      'Sand across each joint until the faces are level, then sand the whole face with the grain.',
      'Check with a straightedge laid across the {width} panel as you go. Stop once it touches everywhere: the panel should still be at least {thickness} thick.',
      'Flatten {count} this way.',
    ],
    mistakes: [
      'Holding the sander on a joint digs a hollow beside it. Keep the sander moving over a wide area.',
    ],
    safety: [WOOD_DUST, CLAMP_THE_WORK],
    flags: [],
    easierThan: [],
    moreAccurateThan: [],
  },

  // Rip (a panel or board to its finished width)
  {
    id: 'rip-table-saw',
    operation: 'rip',
    name: 'With a table saw',
    tools: [{ use: 'ripping', anyOf: [{ tool: 'table-saw' }] }, TAPE],
    skills: ['rip-along-a-fence'],
    setup: [
      'Set the fence {width} from the blade, measured to the side of a tooth facing the fence.',
    ],
    technique: [
      'Hold the straighter edge against the fence and feed the board at an even speed for the whole {length}.',
      'Rip {count} this way.',
    ],
    mistakes: [
      'Letting the board drift away from the fence tapers the part and can pinch the blade. Keep it tight to the fence until it is past the blade.',
    ],
    safety: [TABLE_SAW_KICKBACK, RIP_BLADE, GUARDS_STAY_ON],
    flags: [categoryFlag('table-saw')],
    easierThan: ['rip-circular-saw'],
    moreAccurateThan: ['rip-track-saw', 'rip-circular-saw'],
  },
  {
    id: 'rip-track-saw',
    operation: 'rip',
    name: 'With a track saw',
    tools: [{ use: 'ripping', anyOf: [{ tool: 'track-saw' }] }, TAPE, CLAMPS],
    skills: ['measure-and-mark', 'rip-along-a-fence'],
    setup: ['Support the board flat on a sacrificial surface and clamp it.'],
    technique: [
      'Mark {width} from the edge kept at both ends.',
      'Lay the rail on the marks, with the blade on the waste side, and cut the full {length}.',
      'Rip {count} this way.',
    ],
    mistakes: [
      'Setting the rail on the wrong side of the marks makes the part narrow by the width of the blade. Keep the blade on the waste side.',
    ],
    safety: [CIRCULAR_SAW_KICKBACK, CLAMP_THE_WORK, UNPLUG_TO_CHANGE],
    flags: [],
    easierThan: ['rip-table-saw', 'rip-circular-saw'],
    moreAccurateThan: ['rip-circular-saw'],
  },
  {
    id: 'rip-circular-saw',
    operation: 'rip',
    name: 'With a circular saw and a straight guide',
    tools: [
      {
        use: 'ripping',
        anyOf: [
          { tool: 'circular-saw', needs: [{ capability: 'depthOfCut', atLeast: 'thickness' }] },
        ],
      },
      TAPE,
      CLAMPS,
    ],
    skills: ['measure-and-mark', 'guide-a-circular-saw', 'cut-to-a-line'],
    setup: [
      'Set the blade a little deeper than the board is thick, {thickness}.',
      'Support the board on both sides of the cut and clamp it.',
    ],
    technique: [
      'Mark {width} from the edge kept at both ends, and join the marks with a line.',
      'Clamp a straight board along the line as a guide, set back by the distance from the blade to the edge of the saw base.',
      'Keep the base tight to the guide and cut the full {length}.',
      'Rip {count} this way.',
    ],
    mistakes: [
      'A guide that is not straight puts its curve in the part. Sight along the guide board, or use a factory edge.',
    ],
    safety: [CIRCULAR_SAW_KICKBACK, CIRCULAR_SAW_GUARD, CLAMP_THE_WORK, UNPLUG_TO_CHANGE],
    flags: [],
    easierThan: [],
    moreAccurateThan: [],
  },

  // Dado (through)
  {
    id: 'dado-router',
    operation: 'dado',
    name: 'With a router and a guide',
    tools: [{ use: 'cutting the dado', anyOf: [{ tool: 'router' }] }, TAPE, SQUARE, CLAMPS],
    skills: ['measure-and-mark', 'square-a-line', 'rout-along-a-guide'],
    setup: [
      DADO_FROM_THE_PART,
      'Fit a straight bit no wider than the dado, {width}, and set it to cut {depth} deep, in shallow cuts if the bit is small.',
      'Measure from the bit to the edge of the router base, to set the guide back by that much.',
    ],
    technique: [
      'Mark both walls of the dado across the face, and square them down the edges.',
      'Clamp a straight board as a guide so the bit cuts on the waste side of the first wall, along the full {length}.',
      'Rout the first wall, move the guide for the second wall, rout it, and clear the wood between.',
      'Check the fit with the part it houses before you unclamp the guide.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Feeding so the bit pulls the base away from the guide wanders the dado off its line. Feed so the bit pulls the base against the guide.',
      'A dado cut to its full width at once is often too wide for the part it houses. Cut it narrower, then move the guide over and test the fit.',
    ],
    safety: [ROUTER_BIT, ROUTER_FEED],
    flags: [categoryFlag('router')],
    easierThan: ['dado-circular-saw', 'dado-hand-saw'],
    moreAccurateThan: ['dado-circular-saw', 'dado-hand-saw'],
  },
  {
    id: 'dado-circular-saw',
    operation: 'dado',
    name: 'With a circular saw and a chisel',
    tools: [
      {
        use: 'cutting the walls and the waste',
        anyOf: [{ tool: 'circular-saw', needs: [{ capability: 'depthOfCut', atLeast: 'depth' }] }],
      },
      { use: 'clearing the bottom', anyOf: [{ tool: 'chisel' }] },
      TAPE,
      SQUARE,
      CLAMPS,
    ],
    skills: ['measure-and-mark', 'square-a-line', 'guide-a-circular-saw', 'pare-to-a-line'],
    setup: [
      DADO_FROM_THE_PART,
      'Set the blade to cut {depth} deep, and check it on scrap.',
      'Clamp the part to the bench with the dado clear of the clamps.',
    ],
    technique: [
      'Mark both walls of the dado across the face.',
      'Clamp a square or straight board as a guide and cut each wall on the waste side of its line, the full {length}.',
      'Make more cuts between the walls, close together.',
      'Break out the thin strips and pare the bottom flat with a chisel.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'A blade set deeper than the dado weakens the part and shows on the edges. Set the depth on scrap first.',
    ],
    safety: [CIRCULAR_SAW_KICKBACK, CIRCULAR_SAW_GUARD, CLAMP_THE_WORK, UNPLUG_TO_CHANGE],
    flags: [],
    easierThan: ['dado-hand-saw'],
    moreAccurateThan: ['dado-hand-saw'],
  },
  {
    id: 'dado-hand-saw',
    operation: 'dado',
    name: 'With a hand saw and a chisel',
    tools: [
      { use: 'sawing the walls', anyOf: [{ tool: 'hand-saw' }] },
      { use: 'clearing the waste', anyOf: [{ tool: 'chisel' }] },
      TAPE,
      SQUARE,
      CLAMPS,
    ],
    skills: ['measure-and-mark', 'square-a-line', 'saw-by-hand', 'pare-to-a-line'],
    setup: [DADO_FROM_THE_PART, 'Clamp the part flat to the bench.'],
    technique: [
      'Mark both walls of the dado across the face, and its depth, {depth}, on both edges.',
      'Saw each wall on the waste side of its line, down to the depth lines on both edges.',
      'Chisel out the waste from both edges toward the middle, then pare the bottom flat.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Sawing past the depth line in the middle of the face leaves a groove below the bottom. Watch both depth lines as you saw.',
    ],
    safety: [CLAMP_THE_WORK],
    flags: [],
    easierThan: [],
    moreAccurateThan: [],
  },

  // Stopped dado (reaches one edge and stops short of the other)
  {
    id: 'stopped-dado-router',
    operation: 'stopped-dado',
    name: 'With a router, a guide, and a stop',
    tools: [
      { use: 'cutting the dado', anyOf: [{ tool: 'router' }] },
      { use: 'squaring the stopped end', anyOf: [{ tool: 'chisel' }] },
      TAPE,
      SQUARE,
      CLAMPS,
    ],
    skills: ['measure-and-mark', 'square-a-line', 'rout-along-a-guide', 'pare-to-a-line'],
    setup: [
      DADO_FROM_THE_PART,
      'Fit a straight bit no wider than the dado, {width}, and set it to cut {depth} deep, in shallow cuts if the bit is small.',
      'Measure from the bit to the edge of the router base, to set the guide and the stop back by that much.',
    ],
    technique: [
      'Mark both walls of the dado and where it stops, {length} in from the open edge.',
      'Clamp a straight board as a guide, and clamp a stop across it where the router base must halt.',
      'Rout from the open edge until the base meets the stop, then clear the wood between the walls the same way.',
      'Square the rounded stopped end with a chisel.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Routing past the stop line shows at the edge the dado was meant to hide. Clamp the stop before you start, and check it with the router unplugged.',
    ],
    safety: [ROUTER_BIT, ROUTER_FEED],
    flags: [categoryFlag('router')],
    easierThan: ['stopped-dado-hand-saw'],
    moreAccurateThan: ['stopped-dado-hand-saw'],
  },
  {
    id: 'stopped-dado-hand-saw',
    operation: 'stopped-dado',
    name: 'With a chisel and a hand saw',
    tools: [
      { use: 'chopping the stopped end and clearing the waste', anyOf: [{ tool: 'chisel' }] },
      { use: 'sawing the walls', anyOf: [{ tool: 'hand-saw' }] },
      TAPE,
      SQUARE,
      CLAMPS,
    ],
    skills: ['measure-and-mark', 'square-a-line', 'saw-by-hand', 'pare-to-a-line'],
    setup: [DADO_FROM_THE_PART, 'Clamp the part flat to the bench.'],
    technique: [
      'Mark both walls, the stopped end {length} in from the open edge, and the depth, {depth}, on the open edge.',
      'Chop a small recess at the stopped end, to the full depth, so the saw has room to work.',
      'Saw each wall from the open edge to the recess, on the waste side of its line, tilting the saw to reach full depth at the stopped end.',
      'Chisel out the waste and pare the bottom flat.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Chopping the stopped end with the bevel facing the waste pushes the chisel past the line. Keep the flat of the chisel toward the end wall.',
    ],
    safety: [CLAMP_THE_WORK],
    flags: [],
    easierThan: [],
    moreAccurateThan: [],
  },

  // Stopped rabbet (a dado at the end, open there and at one edge)
  {
    id: 'stopped-rabbet-router',
    operation: 'stopped-rabbet',
    name: 'With a router, a guide, and a stop',
    tools: [
      { use: 'cutting the rabbet', anyOf: [{ tool: 'router' }] },
      { use: 'squaring the stopped end', anyOf: [{ tool: 'chisel' }] },
      TAPE,
      SQUARE,
      CLAMPS,
    ],
    skills: ['measure-and-mark', 'square-a-line', 'rout-along-a-guide', 'pare-to-a-line'],
    setup: [
      DADO_FROM_THE_PART,
      'Fit a straight bit and set it to cut {depth} deep, in shallow cuts if the bit is small.',
      'Measure from the bit to the edge of the router base, to set the guide and the stop back by that much.',
    ],
    technique: [
      "Mark the rabbet's inside wall, {width} in from the end, and where it stops, {length} in from the open edge.",
      'Clamp a straight board as a guide along the inside wall, and clamp a stop across it where the router base must halt.',
      'Rout from the open edge until the base meets the stop, then clear the wood out to the end the same way.',
      'Square the rounded stopped end with a chisel.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Routing past the stop line shows at the edge the rabbet was meant to hide. Clamp the stop before you start, and check it with the router unplugged.',
    ],
    safety: [ROUTER_BIT, ROUTER_FEED],
    flags: [categoryFlag('router')],
    easierThan: ['stopped-rabbet-hand-saw'],
    moreAccurateThan: ['stopped-rabbet-hand-saw'],
  },
  {
    id: 'stopped-rabbet-hand-saw',
    operation: 'stopped-rabbet',
    name: 'With a chisel and a hand saw',
    tools: [
      { use: 'chopping the stopped end and clearing the waste', anyOf: [{ tool: 'chisel' }] },
      { use: 'sawing the inside wall', anyOf: [{ tool: 'hand-saw' }] },
      TAPE,
      SQUARE,
      CLAMPS,
    ],
    skills: ['measure-and-mark', 'square-a-line', 'saw-by-hand', 'pare-to-a-line'],
    setup: [DADO_FROM_THE_PART, 'Clamp the part flat to the bench.'],
    technique: [
      'Mark the inside wall, {width} in from the end, the stopped end {length} in from the open edge, and the depth, {depth}, on the open edge and the end.',
      'Chop a small recess at the stopped end, to the full depth, so the saw has room to work.',
      'Saw the inside wall from the open edge to the recess, on the waste side of its line.',
      'Chisel out the waste toward the end and pare the bottom flat.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Chopping the stopped end with the bevel facing the waste pushes the chisel past the line. Keep the flat of the chisel toward the end wall.',
    ],
    safety: [CLAMP_THE_WORK],
    flags: [],
    easierThan: [],
    moreAccurateThan: [],
  },

  // Dado stopped at both ends (reaching no edge), such as a track for a sliding panel
  {
    id: 'double-stopped-dado-router',
    operation: 'double-stopped-dado',
    name: 'With a router, a guide, and two stops',
    tools: [
      { use: 'cutting the dado', anyOf: [{ tool: 'router' }] },
      { use: 'squaring the ends', anyOf: [{ tool: 'chisel' }] },
      TAPE,
      SQUARE,
      CLAMPS,
    ],
    skills: ['measure-and-mark', 'square-a-line', 'rout-along-a-guide', 'pare-to-a-line'],
    setup: [
      'Fit a straight bit no wider than the dado, {width}, and set it to cut {depth} deep, in shallow cuts if the bit is small.',
      'Measure from the bit to the edge of the router base, to set the guide and the stops back by that much.',
    ],
    technique: [
      'Mark both walls of the dado and both of its ends, {length} apart.',
      'Clamp a straight board as a guide, and clamp a stop across it at each end where the router base must halt.',
      'Start the router with the bit clear of the wood, lower it into the cut against the first stop, and rout to the second; then clear the wood between the walls the same way.',
      'Square the rounded ends with a chisel.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Routing past a stop leaves a gap beyond the part that fits there. Clamp both stops before you start, and check them with the router unplugged.',
    ],
    safety: [ROUTER_BIT, ROUTER_FEED],
    flags: [categoryFlag('router')],
    easierThan: ['double-stopped-dado-drill-and-chisel'],
    moreAccurateThan: ['double-stopped-dado-drill-and-chisel'],
  },
  {
    id: 'double-stopped-dado-drill-and-chisel',
    operation: 'double-stopped-dado',
    name: 'With a drill and a chisel',
    tools: [
      { use: 'drilling out the waste', anyOf: [{ tool: 'drill-press' }, { tool: 'drill-driver' }] },
      {
        use: 'a bit as wide as the dado',
        anyOf: [{ tool: 'spade-bits' }, { tool: 'auger-bits' }],
      },
      { use: 'paring the walls and bottom', anyOf: [{ tool: 'chisel' }] },
      TAPE,
      SQUARE,
      CLAMPS,
    ],
    skills: ['measure-and-mark', 'square-a-line', 'drill-straight', 'pare-to-a-line'],
    setup: [
      'Fit a bit {width} across, and mark it or set a stop for {depth} deep.',
      'Clamp the part flat to the bench.',
    ],
    technique: [
      'Mark both walls of the dado and both of its ends, {length} apart.',
      'Drill a row of holes inside the marks, each {depth} deep, overlapping a little.',
      'Pare the walls and ends to the marks with the chisel, its flat side toward the wall and held upright.',
      'Pare the bottom flat at {depth} all along.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Drilling at a lean makes the dado wider at the bottom or wanders off the line. Keep the bit upright, checking from two sides.',
    ],
    safety: [CLAMP_THE_WORK],
    flags: [],
    easierThan: [],
    moreAccurateThan: [],
  },

  // Notch (a corner cut out, through the thickness)
  {
    id: 'notch-band-saw',
    operation: 'notch',
    name: 'With a band saw',
    tools: [{ use: 'cutting', anyOf: [{ tool: 'band-saw' }] }, TAPE, SQUARE],
    skills: ['measure-and-mark', 'square-a-line', 'cut-to-a-line'],
    setup: ['Set the upper guide a little above the part, {thickness} thick.'],
    technique: [
      'Mark the notch: {along} along the edge from the end, and {across} across the end from the edge.',
      'Cut each line on the waste side, stopping where the two lines meet.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Backing the board out of a long cut can pull the blade off its wheels. Make the shorter cut first, then the longer one to meet it.',
    ],
    safety: [BAND_SAW_GUARD],
    flags: [],
    easierThan: ['notch-jigsaw', 'notch-hand-saw'],
    moreAccurateThan: ['notch-jigsaw', 'notch-hand-saw'],
  },
  {
    id: 'notch-jigsaw',
    operation: 'notch',
    name: 'With a jigsaw',
    tools: [
      {
        use: 'cutting',
        anyOf: [{ tool: 'jigsaw', needs: [{ capability: 'depthOfCut', atLeast: 'thickness' }] }],
      },
      TAPE,
      SQUARE,
      CLAMPS,
    ],
    skills: ['measure-and-mark', 'square-a-line', 'cut-to-a-line'],
    setup: ['Set the blade square to the base, and clamp the part with the corner past the bench.'],
    technique: [
      'Mark the notch: {along} along the edge from the end, and {across} across the end from the edge.',
      'Cut each line on the waste side, stopping where the two lines meet.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'A blade that bends in the cut leaves the notch out of square on the far face. Feed slowly and check the far face.',
    ],
    safety: [CLAMP_THE_WORK, UNPLUG_TO_CHANGE],
    flags: [],
    easierThan: ['notch-hand-saw'],
    moreAccurateThan: ['notch-hand-saw'],
  },
  {
    id: 'notch-hand-saw',
    operation: 'notch',
    name: 'With a hand saw',
    tools: [{ use: 'cutting', anyOf: [{ tool: 'hand-saw' }] }, TAPE, SQUARE, CLAMPS],
    skills: ['measure-and-mark', 'square-a-line', 'saw-by-hand', 'cut-to-a-line'],
    setup: ['Clamp the part upright in a vise or to the bench, with the corner clear.'],
    technique: [
      'Mark the notch: {along} along the edge from the end, and {across} across the end from the edge, and square the lines onto both faces.',
      'Saw each line on the waste side, watching both faces, stopping where the two lines meet.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Sawing past the corner where the lines meet leaves a kerf in the part. Stop each cut at the other line.',
    ],
    safety: [CLAMP_THE_WORK],
    flags: [],
    easierThan: [],
    moreAccurateThan: [],
  },

  // Cutout (from an end, through the thickness)
  {
    id: 'cutout-band-saw',
    operation: 'cutout',
    name: 'With a band saw',
    tools: [{ use: 'cutting', anyOf: [{ tool: 'band-saw' }] }, TAPE, SQUARE],
    skills: ['measure-and-mark', 'square-a-line', 'cut-to-a-line'],
    setup: ['Set the upper guide a little above the part, {thickness} thick.'],
    technique: [
      'Mark the cutout: {width} wide, and {depth} in from the end.',
      'Cut both sides from the end to the depth line, on the waste side.',
      'Cut the waste away in curves toward the corners, then cut along the depth line to each corner.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Turning the board too tightly for the blade twists it in the cut. Cut gentle curves to remove the waste first, then square the corners.',
    ],
    safety: [BAND_SAW_GUARD],
    flags: [],
    easierThan: ['cutout-jigsaw'],
    moreAccurateThan: ['cutout-jigsaw'],
  },
  {
    id: 'cutout-jigsaw',
    operation: 'cutout',
    name: 'With a jigsaw',
    tools: [
      {
        use: 'cutting',
        anyOf: [{ tool: 'jigsaw', needs: [{ capability: 'depthOfCut', atLeast: 'thickness' }] }],
      },
      TAPE,
      SQUARE,
      CLAMPS,
      { use: 'squaring the corners', anyOf: [{ tool: 'chisel' }] },
    ],
    skills: ['measure-and-mark', 'square-a-line', 'cut-to-a-line', 'pare-to-a-line'],
    setup: ['Set the blade square to the base, and clamp the part with the cutout past the bench.'],
    technique: [
      'Mark the cutout: {width} wide, and {depth} in from the end.',
      'Cut both sides from the end to the depth line, on the waste side.',
      'Cut along the depth line from one side toward the other, curving in to the second corner, then come back to cut that corner square.',
      'Pare the corners and the depth line square with a chisel.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'A blade that bends in the cut leaves the far face out of line. Feed slowly and check the far face.',
    ],
    safety: [CLAMP_THE_WORK, UNPLUG_TO_CHANGE],
    flags: [],
    easierThan: [],
    moreAccurateThan: [],
  },

  // Mortise (a pocket for a tenon)
  {
    id: 'mortise-drill-and-chisel',
    operation: 'mortise',
    name: 'With a drill and a chisel',
    tools: [
      { use: 'drilling out the waste', anyOf: [{ tool: 'drill-press' }, { tool: 'drill-driver' }] },
      {
        use: 'a bit as wide as the mortise',
        anyOf: [{ tool: 'spade-bits' }, { tool: 'auger-bits' }],
      },
      { use: 'squaring the walls', anyOf: [{ tool: 'chisel' }] },
      TAPE,
      SQUARE,
      CLAMPS,
    ],
    skills: ['measure-and-mark', 'drill-straight', 'pare-to-a-line', 'cut-a-mortise'],
    setup: [
      'Mark the mortise on the part: {length} long and {width} wide, where the cut detail shows it.',
      'Fit a bit {width} across, and mark it or set a stop for {depth} deep.',
      'Clamp the part flat, with the marked side up.',
    ],
    technique: [
      'Drill a row of holes inside the marks, each {depth} deep, overlapping a little.',
      'Pare the walls to the marks with the chisel, its flat side toward the wall and held upright.',
      'Clean the bottom with the chisel until it is flat at {depth} all along.',
      'Check the fit with the tenon it holds, and pare where it binds.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Drilling at a lean makes the mortise wider at the bottom or out of line. Keep the bit upright, checking from two sides.',
      'Prying with the chisel against a wall crushes the edge. Pare a little at a time, and lever only on the waste.',
    ],
    safety: [CLAMP_THE_WORK],
    flags: [],
    easierThan: [],
    moreAccurateThan: [],
  },
  {
    id: 'mortise-router',
    operation: 'mortise',
    name: 'With a router and a guide',
    tools: [
      { use: 'cutting the mortise', anyOf: [{ tool: 'router' }] },
      { use: 'squaring the ends', anyOf: [{ tool: 'chisel' }] },
      TAPE,
      SQUARE,
      CLAMPS,
    ],
    skills: ['measure-and-mark', 'rout-along-a-guide', 'pare-to-a-line', 'cut-a-mortise'],
    setup: [
      'Mark the mortise on the part: {length} long and {width} wide, where the cut detail shows it.',
      'Fit a straight bit {width} across, and set the router to cut {depth} deep, a little deeper each time.',
      'Clamp a straight board as a guide so the bit runs between the marks, and clamp stop blocks at each end of the mortise.',
    ],
    technique: [
      'Lower the spinning bit into the wood at one end, and rout to the other end against the guide.',
      'Lower the bit and repeat until the mortise is {depth} deep.',
      'Square the rounded ends with a chisel, or round the tenon to match.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Routing the full depth at once makes the bit wander and burn. Go a little deeper each time.',
      'Feeding so the bit pulls the router off the guide makes the mortise crooked. Feed so it pulls the router against the guide.',
    ],
    safety: [ROUTER_BIT, ROUTER_FEED],
    flags: [categoryFlag('router')],
    easierThan: ['mortise-drill-and-chisel'],
    moreAccurateThan: ['mortise-drill-and-chisel'],
  },

  // Tenon (on a square end)
  {
    id: 'tenon-hand-saw',
    operation: 'tenon',
    name: 'With a hand saw',
    tools: [
      { use: 'cutting the cheeks and shoulders', anyOf: [{ tool: 'hand-saw' }] },
      { use: 'trimming to fit', anyOf: [{ tool: 'chisel' }, { tool: 'block-plane' }] },
      TAPE,
      SQUARE,
      CLAMPS,
    ],
    skills: ['measure-and-mark', 'square-a-line', 'saw-by-hand', 'cut-a-tenon'],
    setup: [
      'Mark the shoulder {length} from the end, squared around all four sides.',
      'Mark the cheeks on the end and both edges: {cheekBack} in from the back face and {cheekFront} in from the front, leaving {tenonThickness}.',
    ],
    technique: [
      'Clamp the part upright and saw each cheek down to the shoulder line, on the waste side of the mark.',
      'Clamp the part flat and saw across at the shoulder line, down to the cheek, to free the waste.',
      'Saw the shoulders at the edges the same way, if the tenon is narrower than the part, leaving it {width} wide.',
      'Check the fit in its mortise, and pare the cheeks until it slides in with hand pressure.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Sawing on the line, or the keep side of it, leaves the tenon too thin to hold. Saw on the waste side and trim to fit.',
      'Sawing past the shoulder line weakens the tenon where it meets the part. Stop at the line.',
    ],
    safety: [CLAMP_THE_WORK],
    flags: [],
    easierThan: [],
    moreAccurateThan: [],
  },
  {
    id: 'tenon-router',
    operation: 'tenon',
    name: 'With a router and a guide',
    tools: [
      { use: 'cutting the cheeks', anyOf: [{ tool: 'router' }] },
      { use: 'trimming to fit', anyOf: [{ tool: 'chisel' }, { tool: 'block-plane' }] },
      TAPE,
      SQUARE,
      CLAMPS,
    ],
    skills: ['measure-and-mark', 'square-a-line', 'rout-along-a-guide', 'cut-a-tenon'],
    setup: [
      'Mark the shoulder {length} from the end, squared around all four sides.',
      'Clamp the part flat, with a scrap of the same thickness beside it for the router to ride on, and clamp a straight board across both as a guide so the bit stops at the shoulder line.',
    ],
    technique: [
      'Set a straight bit {cheekBack} deep and rout the back cheek, working out from the shoulder to the end, each cut overlapping the last.',
      'Turn the part over, set the bit {cheekFront} deep, and rout the front cheek the same way, leaving {tenonThickness}.',
      'Cut the shoulders at the edges with a saw and chisel, if the tenon is narrower than the part, leaving it {width} wide.',
      'Check the fit in its mortise, and trim the cheeks until it slides in with hand pressure.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Routing without support beside the part tips the router and gouges the cheek. Clamp a scrap of the same thickness beside it.',
      'Setting the bit for both cheeks at once leaves the tenon off center. Set it for each cheek in turn.',
    ],
    safety: [ROUTER_BIT, ROUTER_FEED],
    flags: [categoryFlag('router')],
    easierThan: [],
    moreAccurateThan: ['tenon-hand-saw'],
  },

  // Screw holes, round or slotted (DOMAIN.md, Joints that let wood move)
  {
    id: 'screw-holes-drill',
    operation: 'screw-holes',
    name: 'With a drill',
    tools: [
      { use: 'drilling the holes', anyOf: [{ tool: 'drill-driver' }, { tool: 'drill-press' }] },
      { use: 'smoothing the slots', anyOf: [{ tool: 'chisel' }] },
      TAPE,
      SQUARE,
      CLAMPS,
    ],
    skills: ['measure-and-mark', 'drill-straight', 'cut-a-screw-slot'],
    setup: [
      'Mark each hole where the cut detail shows it, and which ones are slots.',
      'Fit a bit the screw slides through without threading into the wood: its clearance hole, as the screw maker gives it.',
      'Clamp the part flat on scrap, so the bit comes out clean.',
    ],
    technique: [
      'Drill {round} round holes straight through the {thickness} part.',
      'For each of the {slotted} slots, drill the first hole, then a second {slot} beyond it the way the slot runs, and holes between them so they overlap.',
      'Pare the sides of each slot straight with the chisel, so the screw slides from one end to the other.',
      'Drill {count} this way.',
    ],
    mistakes: [
      'A slot run the wrong way stops the part from moving, which can split it. Check which way each slot runs before you drill.',
      'Driving a screw in a slot tight pins the part. Turn it until it is snug, so its head can still slide.',
    ],
    safety: [CLAMP_THE_WORK],
    flags: [],
    easierThan: [],
    moreAccurateThan: [],
  },
  {
    id: 'screw-holes-router',
    operation: 'screw-holes',
    name: 'With a drill and a router',
    tools: [
      {
        use: 'drilling the round holes',
        anyOf: [{ tool: 'drill-driver' }, { tool: 'drill-press' }],
      },
      { use: 'routing the slots', anyOf: [{ tool: 'router' }] },
      TAPE,
      SQUARE,
      CLAMPS,
    ],
    skills: ['measure-and-mark', 'rout-along-a-guide', 'cut-a-screw-slot'],
    setup: [
      'Mark each hole where the cut detail shows it, and which ones are slots.',
      'Fit a drill bit the screw slides through without threading into the wood, and a straight router bit of the same width.',
      'Clamp the part on scrap, with a straight board as a guide alongside each slot.',
    ],
    technique: [
      'Drill {round} round holes straight through the {thickness} part.',
      'Rout each of the {slotted} slots through the part against the guide, {slot} longer than its round hole, a little deeper each time.',
      'Drill {count} this way.',
    ],
    mistakes: [
      'A slot run the wrong way stops the part from moving, which can split it. Check which way each slot runs before you rout.',
      'Driving a screw in a slot tight pins the part. Turn it until it is snug, so its head can still slide.',
    ],
    safety: [ROUTER_BIT, ROUTER_FEED],
    flags: [categoryFlag('router')],
    easierThan: [],
    moreAccurateThan: ['screw-holes-drill'],
  },

  // Groove (along an edge)
  {
    id: 'groove-router',
    operation: 'groove',
    name: 'With a router and an edge guide',
    tools: [{ use: 'cutting the groove', anyOf: [{ tool: 'router' }] }, TAPE, CLAMPS],
    skills: ['measure-and-mark', 'rout-along-a-guide'],
    setup: [
      'Fit a straight bit {width} across, and set it to cut {depth} deep, a little deeper each time.',
      'Clamp the part on edge between two scraps flush with it, so the router base has room to sit, and set the edge guide so the bit runs where the groove is marked.',
    ],
    technique: [
      'Rout the groove along the edge, {length} long, with the guide against the face.',
      'Lower the bit and repeat until the groove is {depth} deep.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'A router tipping on a narrow edge cuts the groove crooked. Clamp scraps flush on both sides so the base sits flat.',
    ],
    safety: [ROUTER_BIT, ROUTER_FEED],
    flags: [categoryFlag('router')],
    easierThan: ['groove-table-saw'],
    moreAccurateThan: [],
  },
  {
    id: 'groove-table-saw',
    operation: 'groove',
    name: 'With a table saw, a cut at a time',
    tools: [{ use: 'cutting the groove', anyOf: [{ tool: 'table-saw' }] }, TAPE],
    skills: ['rip-along-a-fence'],
    setup: [
      'Raise the blade {depth} above the table, and set the fence so the blade cuts where the groove is marked.',
    ],
    technique: [
      'Run the part on edge along the fence, pushing it past the blade with a push stick.',
      'Move the fence a blade’s width and repeat until the groove is {width} wide.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Letting the part drift from the fence widens the groove unevenly. Keep it pressed against the fence the whole length.',
    ],
    safety: [TABLE_SAW_KICKBACK, RIP_BLADE],
    flags: [categoryFlag('table-saw')],
    easierThan: [],
    moreAccurateThan: ['groove-router'],
  },

  // Rabbet (along an edge or end, into one face)
  {
    id: 'rabbet-router',
    operation: 'rabbet',
    name: 'With a router and a guide',
    tools: [{ use: 'cutting the rabbet', anyOf: [{ tool: 'router' }] }, TAPE, CLAMPS],
    skills: ['measure-and-mark', 'rout-along-a-guide'],
    setup: [
      'Fit a straight bit, set to cut {depth} deep, a little deeper each time.',
      'Clamp the part flat, with a straight board as a guide so the bit cuts {width} in from the edge.',
    ],
    technique: [
      'Rout along the edge, {length} long, then repeat until the rabbet is {depth} deep.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Routing across the grain at an end tears out the far corner. Rout the ends first, then the long edges.',
    ],
    safety: [ROUTER_BIT, ROUTER_FEED],
    flags: [categoryFlag('router')],
    easierThan: ['rabbet-table-saw'],
    moreAccurateThan: [],
  },
  {
    id: 'rabbet-table-saw',
    operation: 'rabbet',
    name: 'With a table saw, in two cuts',
    tools: [{ use: 'cutting the rabbet', anyOf: [{ tool: 'table-saw' }] }, TAPE],
    skills: ['rip-along-a-fence'],
    setup: [
      'For the first cut, raise the blade {depth} and set the fence {width} from the blade’s far side.',
    ],
    technique: [
      'Run the part flat along the fence, pushing it past the blade with a push stick.',
      'For the second cut, raise the blade {width}, stand the part on edge against the fence, and cut away the strip.',
      'Cut {count} this way.',
    ],
    mistakes: [
      'Letting the cut-off strip sit between the blade and the fence can throw it back. Set the fence so the strip falls away from the fence side.',
    ],
    safety: [TABLE_SAW_KICKBACK, RIP_BLADE],
    flags: [categoryFlag('table-saw')],
    easierThan: [],
    moreAccurateThan: ['rabbet-router'],
  },

  // Finger recess (a scoop in a face)
  {
    id: 'finger-recess-router',
    operation: 'finger-recess',
    name: 'With a router and stops',
    tools: [{ use: 'cutting the recess', anyOf: [{ tool: 'router' }] }, TAPE, SQUARE, CLAMPS],
    skills: ['measure-and-mark', 'rout-along-a-guide'],
    setup: [
      'Fit a round-bottomed bit about {width} across, and set it to cut {depth} deep, a little deeper each time.',
      'Clamp the part flat, with a straight board as a guide and stops at each end so the bit runs {height} along the marked line.',
    ],
    technique: [
      'Lower the spinning bit at one stop and rout to the other, then sand the edges smooth.',
      'Cut {count} this way.',
    ],
    mistakes: ['Routing past a stop leaves a slot that shows. Clamp the stops before you start.'],
    safety: [ROUTER_BIT, ROUTER_FEED],
    flags: [categoryFlag('router')],
    easierThan: ['finger-recess-chisel'],
    moreAccurateThan: ['finger-recess-chisel'],
  },
  {
    id: 'finger-recess-chisel',
    operation: 'finger-recess',
    name: 'With a chisel',
    tools: [{ use: 'carving the recess', anyOf: [{ tool: 'chisel' }] }, TAPE, SQUARE, CLAMPS],
    skills: ['measure-and-mark', 'pare-to-a-line'],
    setup: ['Mark the recess, {width} wide and {height} long, and clamp the part flat.'],
    technique: [
      'Pare toward the middle from each end, a little at a time, until it is {depth} deep, then sand it smooth.',
      'Cut {count} this way.',
    ],
    mistakes: ['Paring toward an edge splits it out. Work from the edges toward the middle.'],
    safety: [CLAMP_THE_WORK],
    flags: [],
    easierThan: [],
    moreAccurateThan: [],
  },

  // Bolt holes
  {
    id: 'bolt-holes-auger-one-side',
    operation: 'bolt-holes',
    name: 'With an auger bit, from one side',
    tools: [
      { use: 'drilling', anyOf: [{ tool: 'drill-driver' }] },
      {
        use: 'boring the hole',
        anyOf: [{ tool: 'auger-bits', needs: [{ capability: 'reach', atLeast: 'depth' }] }],
      },
      {
        use: 'holding the parts in place',
        anyOf: [{ tool: 'clamps', needs: [{ capability: 'maxOpening', atLeast: 'depth' }] }],
      },
      TAPE,
      SQUARE,
    ],
    skills: ['clamp-parts-in-place', 'measure-and-mark', 'drill-straight'],
    setup: [
      'Clamp the parts together in their positions from the plan.',
      'Chuck a {holeDiameter} bit, for the {boltDiameter} bolts.',
    ],
    technique: [
      'Mark each hole center from the cut detail on the face you drill from.',
      'Drill square to the face, {depth} through every part, checking the drill from the side and from above.',
      'Back the bit out every few inches to clear the chips.',
      'Drill {count} holes this way.',
    ],
    mistakes: [
      'Unclamping the parts before every hole is drilled lets them shift, so later holes do not line up. Drill all the holes in a joint before you unclamp it.',
      'Letting the drill tilt puts the exit hole off its mark on the far face. Check square from two directions as the bit starts.',
    ],
    safety: [CLAMP_THE_WORK, UNPLUG_TO_CHANGE, BOLT_HOLE_SIZE],
    flags: [],
    easierThan: [
      'bolt-holes-spade-one-side',
      'bolt-holes-auger-both-sides',
      'bolt-holes-spade-both-sides',
    ],
    moreAccurateThan: [
      'bolt-holes-spade-one-side',
      'bolt-holes-auger-both-sides',
      'bolt-holes-spade-both-sides',
    ],
  },
  {
    id: 'bolt-holes-spade-one-side',
    operation: 'bolt-holes',
    name: 'With a spade bit, from one side',
    tools: [
      { use: 'drilling', anyOf: [{ tool: 'drill-driver' }] },
      {
        use: 'boring the hole',
        anyOf: [{ tool: 'spade-bits', needs: [{ capability: 'reach', atLeast: 'depth' }] }],
      },
      {
        use: 'holding the parts in place',
        anyOf: [{ tool: 'clamps', needs: [{ capability: 'maxOpening', atLeast: 'depth' }] }],
      },
      TAPE,
      SQUARE,
    ],
    skills: ['clamp-parts-in-place', 'measure-and-mark', 'drill-straight'],
    setup: [
      'Clamp the parts together in their positions from the plan.',
      'Chuck a {holeDiameter} bit, for the {boltDiameter} bolts, with an extension if the bit alone does not reach {depth}.',
    ],
    technique: [
      'Mark each hole center from the cut detail on the face you drill from.',
      'Start the bit at low speed so its point does not wander, then drill square to the face, {depth} through every part.',
      'Back the bit out often to clear the chips. A spade bit does not pull them out on its own.',
      'Drill {count} holes this way.',
    ],
    mistakes: [
      'Unclamping the parts before every hole is drilled lets them shift, so later holes do not line up. Drill all the holes in a joint before you unclamp it.',
      'Pushing the bit out through the far face tears out the wood around the hole. Slow down as the point comes through, and finish from the far side if it splinters.',
    ],
    safety: [CLAMP_THE_WORK, UNPLUG_TO_CHANGE, BOLT_HOLE_SIZE],
    flags: [],
    easierThan: ['bolt-holes-auger-both-sides', 'bolt-holes-spade-both-sides'],
    moreAccurateThan: ['bolt-holes-auger-both-sides', 'bolt-holes-spade-both-sides'],
  },
  {
    id: 'bolt-holes-auger-both-sides',
    operation: 'bolt-holes',
    name: 'With an auger bit, from both sides',
    tools: [
      { use: 'drilling', anyOf: [{ tool: 'drill-driver' }] },
      {
        use: 'boring the hole',
        anyOf: [
          { tool: 'auger-bits', needs: [{ capability: 'reach', atLeast: 'depth', passes: 2 }] },
        ],
      },
      {
        use: 'holding the parts in place',
        anyOf: [{ tool: 'clamps', needs: [{ capability: 'maxOpening', atLeast: 'depth' }] }],
      },
      TAPE,
      SQUARE,
    ],
    skills: ['clamp-parts-in-place', 'measure-and-mark', 'drill-straight', 'drill-from-both-sides'],
    setup: [
      'Clamp the parts together in their positions from the plan.',
      'Chuck a {holeDiameter} bit, for the {boltDiameter} bolts.',
    ],
    technique: [
      'Mark each hole center from the cut detail on both outer faces, measured from the same end and edge.',
      'Drill square to the face, past halfway through the {depth} of wood.',
      'Drill from the other face at its mark until the holes meet.',
      'Push the bolt through to check that it goes through without being driven.',
      'Drill {count} holes this way.',
    ],
    mistakes: [
      'Marking the two faces from different references makes the holes miss in the middle. Measure both marks from the same end and the same edge, and square across from one to find the other where you can.',
    ],
    safety: [CLAMP_THE_WORK, UNPLUG_TO_CHANGE, BOLT_HOLE_SIZE],
    flags: [],
    easierThan: ['bolt-holes-spade-both-sides'],
    moreAccurateThan: ['bolt-holes-spade-both-sides'],
  },
  {
    id: 'bolt-holes-spade-both-sides',
    operation: 'bolt-holes',
    name: 'With a spade bit, from both sides',
    tools: [
      { use: 'drilling', anyOf: [{ tool: 'drill-driver' }] },
      {
        use: 'boring the hole',
        anyOf: [
          { tool: 'spade-bits', needs: [{ capability: 'reach', atLeast: 'depth', passes: 2 }] },
        ],
      },
      {
        use: 'holding the parts in place',
        anyOf: [{ tool: 'clamps', needs: [{ capability: 'maxOpening', atLeast: 'depth' }] }],
      },
      TAPE,
      SQUARE,
    ],
    skills: ['clamp-parts-in-place', 'measure-and-mark', 'drill-straight', 'drill-from-both-sides'],
    setup: [
      'Clamp the parts together in their positions from the plan.',
      'Chuck a {holeDiameter} bit, for the {boltDiameter} bolts, with an extension if you have one.',
    ],
    technique: [
      'Mark each hole center from the cut detail on both outer faces, measured from the same end and edge.',
      'Start the bit at low speed so its point does not wander, then drill square to the face, past halfway through the {depth} of wood.',
      'Drill from the other face at its mark until the holes meet.',
      'Push the bolt through to check that it goes through without being driven.',
      'Drill {count} holes this way.',
    ],
    mistakes: [
      'Marking the two faces from different references makes the holes miss in the middle. Measure both marks from the same end and the same edge, and square across from one to find the other where you can.',
    ],
    safety: [CLAMP_THE_WORK, UNPLUG_TO_CHANGE, BOLT_HOLE_SIZE],
    flags: [],
    easierThan: [],
    moreAccurateThan: [],
  },

  // Ease edges
  {
    id: 'ease-edges-sander',
    operation: 'ease-edges',
    name: 'With a sander',
    tools: [{ use: 'rounding edges and sanding faces', anyOf: [{ tool: 'sander' }] }, CLAMPS],
    skills: ['ease-an-edge'],
    setup: ['Clamp the part flat, or hold it on a bench against a stop.'],
    technique: [
      'Sand each long edge with the sander tilted, rolling it over the corner until the corner is round.',
      'Round the corners at each end the same way.',
      'Sand every face a hand can touch until no splinter catches on a rag drawn across it.',
      'Ease {count} this way.',
    ],
    mistakes: [
      'Holding the sander in one place on an edge cuts a flat or a dip. Keep it moving along the whole edge.',
    ],
    safety: [WOOD_DUST, UNPLUG_TO_CHANGE],
    flags: [DUST_FLAG],
    easierThan: ['ease-edges-block-plane'],
    moreAccurateThan: [],
  },
  {
    id: 'ease-edges-block-plane',
    operation: 'ease-edges',
    name: 'With a block plane and sandpaper',
    tools: [{ use: 'chamfering edges', anyOf: [{ tool: 'block-plane' }] }, CLAMPS],
    skills: ['ease-an-edge'],
    setup: ['Clamp the part flat, or hold it on a bench against a stop.'],
    technique: [
      'Plane a small chamfer along each long edge, holding the plane at an even tilt.',
      'Chamfer the corners at each end from the corner inward, so the end grain does not split off.',
      'Sand every face a hand can touch by hand with sandpaper until no splinter catches on a rag drawn across it.',
      'Ease {count} this way.',
    ],
    mistakes: [
      'Planing end grain toward the corner splits off the edge. Plane end grain from each corner toward the middle.',
    ],
    safety: [WOOD_DUST],
    flags: [DUST_FLAG],
    easierThan: [],
    moreAccurateThan: [],
  },

  // Dry-fit (an assembly)
  {
    id: 'dry-fit-clamps',
    operation: 'dry-fit',
    name: 'With clamps',
    tools: [
      {
        use: 'pulling the joints closed',
        anyOf: [{ tool: 'clamps', needs: [{ capability: 'maxOpening', atLeast: 'reach' }] }],
      },
      TAPE,
    ],
    skills: ['fit-an-assembly'],
    setup: [
      'Clear a flat surface big enough for the whole assembly, and open the clamps past {reach}.',
      'Lay the parts out in the order they go together, each with its marks facing the way the plan shows.',
    ],
    technique: [
      'Put the parts together without glue, sliding each one into its dadoes.',
      'Clamp lightly across the assembly, so every joint pulls closed.',
      'Check every joint: a part should slide in with firm hand pressure and close with no gap.',
      'Measure both diagonals of the front. When they match, the assembly is square.',
      'Mark where each part meets its neighbors, so it goes back the same way, then take it apart.',
    ],
    mistakes: [
      'Forcing a tight joint together dry can split a part or leave it stuck. Stop, take it apart, and widen the dado a little.',
      'Skipping the dry fit means finding a problem after the glue is spread. Fit every joint dry first, the same day you glue.',
    ],
    safety: [],
    flags: [],
    easierThan: [],
    moreAccurateThan: ['dry-fit-by-hand'],
  },
  {
    id: 'dry-fit-by-hand',
    operation: 'dry-fit',
    name: 'Without clamps',
    tools: [TAPE],
    skills: ['fit-an-assembly'],
    setup: [
      'Clear a flat surface big enough for the whole assembly, and have someone help hold the parts.',
      'Lay the parts out in the order they go together, each with its marks facing the way the plan shows.',
    ],
    technique: [
      'Put the parts together without glue, sliding each one into its dadoes.',
      'Push each joint closed by hand and look for a gap.',
      'Measure both diagonals of the front. When they match, the assembly is square.',
      'Mark where each part meets its neighbors, so it goes back the same way, then take it apart.',
    ],
    mistakes: [
      'Forcing a tight joint together dry can split a part or leave it stuck. Stop, take it apart, and widen the dado a little.',
      'A joint held closed by hand can hide a gap that clamps would show. Check each one while it is pushed fully home.',
    ],
    safety: [],
    flags: [],
    easierThan: [],
    moreAccurateThan: [],
  },

  // Glue and clamp (an assembly). Wood Handbook ch. 10 (p. 10-15): glue left open before the
  // parts go together dries and makes thick, weak glue lines; too much pressure starves the joint;
  // and the work stays under pressure until the glue is strong enough to hold the parts.
  {
    id: 'glue-assembly-clamps',
    operation: 'glue-assembly',
    name: 'With clamps',
    tools: [
      {
        use: 'clamping the assembly',
        anyOf: [{ tool: 'clamps', needs: [{ capability: 'maxOpening', atLeast: 'reach' }] }],
      },
      TAPE,
    ],
    skills: ['glue-up-an-assembly'],
    setup: [
      'Dry-fit the assembly first, and have every part and clamp within reach: the glue starts to dry as soon as it is spread.',
      'Open the clamps past {reach}, and cut scrap pads to go under the jaws so they do not dent the faces.',
    ],
    technique: [
      'Spread a thin, even coat of glue in each dado and on the part that goes into it.',
      'Slide each part into its dadoes, and clamp across the assembly over each joint.',
      'Tighten the clamps evenly until a small bead of glue squeezes out at each joint.',
      'Measure both diagonals. If they differ, angle a clamp along the longer one and tighten it until they match.',
      'Scrape off the squeezed-out glue once it turns rubbery, so it does not keep the finish out.',
      'Leave the assembly clamped for as long as the glue maker says.',
    ],
    mistakes: [
      'Glue spread long before the parts go together dries on the wood and makes a thick, weak joint. Spread it on one joint group at a time and close it right away.',
      'Clamping as hard as you can squeezes out the glue the joint needs. Tighten only until a small, even bead appears.',
      'Taking the clamps off early lets the joints shift or open. Leave them on for as long as the glue maker says.',
    ],
    safety: [],
    flags: [],
    easierThan: [],
    moreAccurateThan: [],
  },
  {
    id: 'glue-assembly-clamps-and-cauls',
    operation: 'glue-assembly',
    name: 'With clamps and cauls',
    tools: [
      {
        use: 'clamping the assembly',
        anyOf: [{ tool: 'clamps', needs: [{ capability: 'maxOpening', atLeast: 'reach' }] }],
      },
      TAPE,
    ],
    skills: ['glue-up-an-assembly'],
    setup: [
      'Dry-fit the assembly first, and have every part and clamp within reach: the glue starts to dry as soon as it is spread.',
      'Open the clamps past {reach}, and cut straight scrap boards for cauls, as long as each joint, to go under the jaws.',
    ],
    technique: [
      'Spread a thin, even coat of glue in each dado and on the part that goes into it.',
      'Slide each part into its dadoes.',
      'Lay a caul along each joint on the outside face, and clamp across the assembly at each end of the caul, so the pressure spreads along the whole joint.',
      'Tighten the clamps evenly until a small bead of glue squeezes out along each joint.',
      'Measure both diagonals. If they differ, angle a clamp along the longer one and tighten it until they match.',
      'Scrape off the squeezed-out glue once it turns rubbery, so it does not keep the finish out.',
      'Leave the assembly clamped for as long as the glue maker says.',
    ],
    mistakes: [
      'Glue spread long before the parts go together dries on the wood and makes a thick, weak joint. Spread it on one joint group at a time and close it right away.',
      'Clamping as hard as you can squeezes out the glue the joint needs. Tighten only until a small, even bead appears.',
      'Taking the clamps off early lets the joints shift or open. Leave them on for as long as the glue maker says.',
    ],
    safety: [],
    flags: [],
    easierThan: [],
    moreAccurateThan: ['glue-assembly-clamps'],
  },

  // Let the lumber settle. Wood Handbook ch. 13: common softwood boards are not dried to indoor
  // levels, and "dry" lumber can be up to 19% (p. 13-5); lumber for furniture is best kept where
  // the humidity is controlled, and stacking it on stickers brings it toward its service moisture
  // content, while stock wetter at its ends splits or opens its glue joints after edge gluing
  // (p. 13-15). A meter used properly reads within 1% of the true average (p. 13-3).
  {
    id: 'acclimate-moisture-meter',
    operation: 'acclimate',
    name: 'With a moisture meter',
    tools: [{ use: 'checking the moisture content', anyOf: [{ tool: 'moisture-meter' }] }],
    skills: ['settle-lumber'],
    setup: [
      'Bring the boards into the room where the piece will stand, or a heated room like it, as soon as you buy them.',
    ],
    technique: [
      'Stack the boards flat with thin, dry strips of wood across them every foot or two, so air reaches every face.',
      'Read a few boards with the meter in the middle of a face, as its instructions say, and write the readings down.',
      'Read the same boards again every few days. When the readings stop dropping, the boards are ready to cut.',
    ],
    mistakes: [
      'Gluing up boards that are still drying leaves them to shrink in the panel, which can open the joints or crack it. Wait until the readings stop dropping.',
      'Reading only the ends gives a wrong number, since ends dry faster than the middle. Read the middle of a face.',
    ],
    safety: [],
    flags: [],
    easierThan: [],
    moreAccurateThan: ['acclimate-wait'],
  },
  {
    id: 'acclimate-wait',
    operation: 'acclimate',
    name: 'Stacked and left to settle',
    tools: [],
    skills: ['settle-lumber'],
    setup: [
      'Bring the boards into the room where the piece will stand, or a heated room like it, as soon as you buy them.',
    ],
    technique: [
      'Stack the boards flat with thin, dry strips of wood across them every foot or two, so air reaches every face.',
      'Leave them for a couple of weeks before cutting, longer for boards that felt cool or damp at the store or that were stored outside.',
    ],
    mistakes: [
      'Gluing up boards that are still drying leaves them to shrink in the panel, which can open the joints or crack it. Give them time indoors first.',
      'Stacking boards flat on each other traps moisture between them. Put strips between every layer.',
    ],
    safety: [],
    flags: [],
    easierThan: ['acclimate-moisture-meter'],
    moreAccurateThan: [],
  },

  // Screw together, through holes already drilled
  {
    id: 'fasten-drill-driver',
    operation: 'fasten',
    name: 'With a drill/driver',
    tools: [{ use: 'driving the screws', anyOf: [{ tool: 'drill-driver' }] }, CLAMPS],
    skills: ['drive-a-screw'],
    setup: [
      'Set the parts in place and clamp them so they cannot shift while you drive the screws.',
      'Set the driver’s clutch low, so it slips before a screw goes in too far.',
    ],
    technique: [
      'Drive each of the {count} screws through its hole until the head is snug against the wood.',
      'Leave the screws in slots snug, not tight, so the part they hold can still slide.',
    ],
    mistakes: [
      'Driving a screw in a slot tight pins the part, which can split it as it moves. Stop when the head is snug.',
      'A screw driven at full speed strips its hole. Drive the last turns slowly.',
    ],
    safety: [CLAMP_THE_WORK],
    flags: [],
    easierThan: [],
    moreAccurateThan: ['fasten-impact-driver'],
  },
  {
    id: 'fasten-impact-driver',
    operation: 'fasten',
    name: 'With an impact driver',
    tools: [{ use: 'driving the screws', anyOf: [{ tool: 'impact-driver' }] }, CLAMPS],
    skills: ['drive-a-screw'],
    setup: [
      'Set the parts in place and clamp them so they cannot shift while you drive the screws.',
    ],
    technique: [
      'Drive each of the {count} screws through its hole, slowing down as the head reaches the wood.',
      'Leave the screws in slots snug, not tight, so the part they hold can still slide.',
    ],
    mistakes: [
      'An impact driver drives a screw too far before you can stop it. Finish each one by hand, or in short bursts.',
    ],
    safety: [CLAMP_THE_WORK],
    flags: [],
    easierThan: ['fasten-drill-driver'],
    moreAccurateThan: [],
  },

  // Finish
  {
    id: 'finish-wipe-on',
    operation: 'finish',
    name: 'Sanded, then wiped on',
    tools: [{ use: 'sanding the faces', anyOf: [{ tool: 'sander' }] }],
    skills: ['apply-a-finish'],
    setup: [
      'Choose the finish with an experienced builder, and read its instructions for coats, drying time, and ventilation.',
      'Work where fresh air moves through, away from flames and heat.',
    ],
    technique: [
      'Sand every face a person can see or touch, with the grain, ending with finer paper than you started with.',
      'Vacuum the dust, then wipe the faces with a clean cloth.',
      'Wipe on a thin coat with a clean rag, then wipe off what has not soaked in, as the instructions say.',
      'Let it dry as long as the instructions say, sand lightly with fine paper, and add as many coats as they call for.',
    ],
    mistakes: [
      'Sanding across the grain leaves scratches that the finish makes stand out. Sand with the grain.',
      'A thick coat dries soft and sticky. Wipe on thin coats and wipe off the excess.',
    ],
    safety: [OILY_RAGS, WOOD_DUST],
    flags: [categoryFlag('finishes')],
    easierThan: ['finish-hand-sanded'],
    moreAccurateThan: [],
  },
  {
    id: 'finish-hand-sanded',
    operation: 'finish',
    name: 'Sanded by hand, then wiped on',
    tools: [CLAMPS],
    skills: ['apply-a-finish'],
    setup: [
      'Choose the finish with an experienced builder, and read its instructions for coats, drying time, and ventilation.',
      'Work where fresh air moves through, away from flames and heat.',
      'Wrap sandpaper around a flat wooden block, so it sands the faces flat instead of rounding them.',
    ],
    technique: [
      'Sand every face a person can see or touch, with the grain, ending with finer paper than you started with.',
      'Vacuum the dust, then wipe the faces with a clean cloth.',
      'Wipe on a thin coat with a clean rag, then wipe off what has not soaked in, as the instructions say.',
      'Let it dry as long as the instructions say, sand lightly with fine paper, and add as many coats as they call for.',
    ],
    mistakes: [
      'Sanding across the grain leaves scratches that the finish makes stand out. Sand with the grain.',
      'A thick coat dries soft and sticky. Wipe on thin coats and wipe off the excess.',
    ],
    safety: [OILY_RAGS, WOOD_DUST],
    flags: [categoryFlag('finishes')],
    easierThan: [],
    moreAccurateThan: [],
  },

  // Dig holes
  {
    id: 'dig-holes-post-hole-digger',
    operation: 'dig-holes',
    name: 'With a post-hole digger',
    tools: [
      { use: 'digging', anyOf: [{ tool: 'post-hole-digger' }] },
      { use: 'cutting through sod', anyOf: [{ tool: 'shovel' }] },
      { use: 'firming the bottom', anyOf: [{ tool: 'tamper' }] },
      TAPE,
      { use: 'laying out the hole centers', anyOf: [{ tool: 'string-line' }] },
    ],
    skills: ['measure-and-mark', 'dig-a-post-hole'],
    setup: [
      'Lay out the footprint with string lines, and mark each hole center where the plan places it.',
      'Cut and lift the sod over each mark with the shovel.',
    ],
    technique: [
      'Dig straight down at each mark to {depth} below grade, measured from the ground beside the hole.',
      'Tamp the bottom of each hole firm.',
      'Check the depth again after tamping.',
      'Dig {count} holes this way.',
    ],
    mistakes: [
      'Measuring depth from the top of the loose soil piled beside the hole makes it shallow. Lay a straight board across the hole on undisturbed ground and measure down from it.',
    ],
    safety: [BURIED_LINES],
    flags: [],
    easierThan: ['dig-holes-shovel'],
    moreAccurateThan: ['dig-holes-shovel'],
  },
  {
    id: 'dig-holes-shovel',
    operation: 'dig-holes',
    name: 'With a shovel',
    tools: [
      { use: 'digging', anyOf: [{ tool: 'shovel' }] },
      { use: 'firming the bottom', anyOf: [{ tool: 'tamper' }] },
      TAPE,
      { use: 'laying out the hole centers', anyOf: [{ tool: 'string-line' }] },
    ],
    skills: ['measure-and-mark', 'dig-a-post-hole'],
    setup: [
      'Lay out the footprint with string lines, and mark each hole center where the plan places it.',
    ],
    technique: [
      'Dig at each mark to {depth} below grade, measured from the ground beside the hole, keeping the hole as narrow as the shovel allows.',
      'Tamp the bottom of each hole firm.',
      'Check the depth again after tamping.',
      'Dig {count} holes this way.',
    ],
    mistakes: [
      'A hole dug wide at the top leaves loose soil around the part after backfilling. Dig the sides as straight as you can, and tamp the backfill in layers.',
      'Measuring depth from the top of the loose soil piled beside the hole makes it shallow. Lay a straight board across the hole on undisturbed ground and measure down from it.',
    ],
    safety: [BURIED_LINES],
    flags: [],
    easierThan: [],
    moreAccurateThan: [],
  },

  // Level pads
  {
    id: 'level-pads-string-line',
    operation: 'level-pads',
    name: 'With a string line and line level',
    tools: [
      { use: 'cutting out the sod and leveling the soil', anyOf: [{ tool: 'shovel' }] },
      { use: 'firming the base', anyOf: [{ tool: 'tamper' }] },
      { use: 'setting a level reference', anyOf: [{ tool: 'string-line' }] },
      { use: 'leveling the string', anyOf: [{ tool: 'line-level' }] },
      { use: 'checking each pad', anyOf: [{ tool: 'level' }] },
      TAPE,
    ],
    skills: ['measure-and-mark', 'level-a-base'],
    setup: [
      'Lay out the footprint and mark where each pad goes from the plan.',
      'Drive a stake beyond each pad and stretch a string between them, leveled with the line level, above the highest pad.',
    ],
    technique: [
      'Cut out the sod and loose soil where each pad goes.',
      'Tamp the base firm.',
      'Set each pad and measure down from the string to its top. Add or remove soil until every pad measures the same.',
      'Check each pad level in two directions.',
      'Set {count} pads this way.',
    ],
    mistakes: [
      'Leveling each pad on its own leaves them at different heights, so the structure leans. Measure every pad from the same level string.',
    ],
    safety: [BURIED_LINES],
    flags: [],
    easierThan: [],
    moreAccurateThan: ['level-pads-straight-board'],
  },
  {
    id: 'level-pads-straight-board',
    operation: 'level-pads',
    name: 'With a level on a straight board',
    tools: [
      { use: 'cutting out the sod and leveling the soil', anyOf: [{ tool: 'shovel' }] },
      { use: 'firming the base', anyOf: [{ tool: 'tamper' }] },
      { use: 'checking each pad and the pads against each other', anyOf: [{ tool: 'level' }] },
      TAPE,
    ],
    skills: ['measure-and-mark', 'level-a-base'],
    setup: ['Lay out the footprint and mark where each pad goes from the plan.'],
    technique: [
      'Cut out the sod and loose soil where each pad goes.',
      'Tamp the base firm.',
      'Set the first pad level in two directions.',
      'Lay a long, straight board from the first pad to the next, set the level on it, and raise or lower the next pad until the board is level.',
      'Set {count} pads this way, working from each set pad to the next.',
    ],
    mistakes: [
      'A board with a bow in it gives a false level between pads. Sight along its edge first, and flip it end for end to check the reading.',
    ],
    safety: [BURIED_LINES],
    flags: [],
    easierThan: ['level-pads-string-line'],
    moreAccurateThan: [],
  },
] as const satisfies readonly z.input<typeof Method>[];

export type MethodId = (typeof METHODS)[number]['id'];

/** The methods for an operation type, in preference order. */
export function methodsFor(type: OperationType): Method[] {
  return METHODS.filter((m) => m.operation === type).map((m) => Method.parse(m));
}

/** The method entry for an ID, or undefined for an ID not in the list. */
export function findMethod(id: string): Method | undefined {
  const found = METHODS.find((m) => m.id === id);
  return found ? Method.parse(found) : undefined;
}

/** A method that can use a tool type, and what the tool does in it ("marking the line"). */
export interface ToolUse {
  method: Method;
  use: string;
}

/** Every method that can use a tool type, in the methods' order, for that tool's page. */
export function methodsUsing(toolTypeId: string): ToolUse[] {
  return METHODS.flatMap((m) => {
    const req = m.tools.find((r) => r.anyOf.some((c) => c.tool === toolTypeId));
    return req ? [{ method: Method.parse(m), use: req.use }] : [];
  });
}
