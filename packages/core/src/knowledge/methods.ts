import { z } from 'zod';
import { Citation } from '../design-values/sources.ts';
import type { Operation, OperationType } from '../model/operations.ts';
import { formatAngle } from '../units/angle.ts';
import { formatLength } from '../units/length.ts';
import { FlagCategory } from './categories.ts';
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
    'bolt-holes',
    'ease-edges',
    'dig-holes',
    'level-pads',
  ] satisfies OperationType[]),
  /** A short name, in sentence case: "With a miter saw". */
  name: z.string().min(1),
  tools: z.array(ToolRequirement).min(1),
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
  'bolt-holes': {
    count,
    boltDiameter: { kind: 'length', of: (op) => op.boltDiameter },
    holeDiameter: { kind: 'length', of: (op) => op.holeDiameter },
    depth: { kind: 'length', of: (op) => op.depth },
  },
  'ease-edges': { count },
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
