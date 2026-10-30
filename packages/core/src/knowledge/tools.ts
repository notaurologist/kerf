import { z } from 'zod';

// The tool-type library (decision 0009; DOMAIN.md, Tool): generic tool types, grouped as a shop
// would group them, each with the capabilities that change which method fits. The owner's
// inventory picks from this list (inventory/tools.ts), and methods (#104) name these IDs.
//
// Names are generic (hard rule 11). A capability holds a value the owner reads off their own tool,
// so the library states no numbers about tools; each capability says where its value is read, and
// none has a default (hard rule 3). A capability is listed only if a method uses it (#171).

export const TOOL_GROUPS = [
  'measuring-and-marking',
  'cutting',
  'drilling-and-driving',
  'clamping-and-holding',
  'shaping',
  'digging-and-setting',
] as const;
export const ToolGroup = z.enum(TOOL_GROUPS);
export type ToolGroup = z.infer<typeof ToolGroup>;

export const TOOL_GROUP_LABELS: Record<ToolGroup, string> = {
  'measuring-and-marking': 'Measuring and marking',
  cutting: 'Cutting',
  'drilling-and-driving': 'Drilling and driving',
  'clamping-and-holding': 'Clamping and holding',
  shaping: 'Shaping',
  'digging-and-setting': 'Digging and setting',
};

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * A capability's kind sets its type and unit, as in a template's form (templates/form.ts):
 * `length` is decimal inches, `angle` is degrees, `integer` is a count in `unit`, and `yes-no` is
 * a boolean chosen explicitly.
 */
export const CapabilityKind = z.enum(['length', 'angle', 'integer', 'yes-no']);
export type CapabilityKind = z.infer<typeof CapabilityKind>;

export const CapabilityField = z
  .object({
    id: z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'must be a camelCase ID'),
    /** A plain label, in sentence case. */
    label: z.string().min(1),
    kind: CapabilityKind,
    /** For `integer`, such as 'clamps'. Lengths are inches and angles degrees. */
    unit: z.string().min(1).optional(),
    /** What the value decides, in the content guide's voice. */
    help: z.string().min(1),
    /** Where the owner reads the value: the source of every value entered. */
    readFrom: z.string().min(1),
    /** Inclusive limits on the entered value. */
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .refine((f) => f.min === undefined || f.max === undefined || f.min < f.max, {
    message: 'min must be less than max',
  })
  .refine((f) => (f.unit !== undefined) === (f.kind === 'integer'), {
    message: 'a unit goes with an integer, and only an integer',
  });
export type CapabilityField = z.infer<typeof CapabilityField>;

export const ToolType = z
  .object({
    id: z.string().regex(ID, 'must be a lowercase ID like miter-saw'),
    /** The generic name, in sentence case. */
    name: z.string().min(1),
    group: ToolGroup,
    capabilities: z.array(CapabilityField),
  })
  .refine((t) => new Set(t.capabilities.map((c) => c.id)).size === t.capabilities.length, {
    message: 'lists a capability more than once',
  });
export type ToolType = z.infer<typeof ToolType>;

/** Lengths are entered to the sixteenth (DOMAIN.md, Units), so the smallest is one. */
const SIXTEENTH = 1 / 16;

const READ_MANUAL = "The tool's manual, or its specifications.";

/**
 * Every tool the templates' work could use, and the common alternatives, checked against the work
 * each template lists in its spec (docs/templates/, Tools for the work). In group order, then in
 * the order a shop would reach for them.
 */
export const TOOL_TYPES = [
  // Measuring and marking
  { id: 'tape-measure', name: 'Tape measure', group: 'measuring-and-marking', capabilities: [] },
  {
    id: 'combination-square',
    name: 'Combination square',
    group: 'measuring-and-marking',
    capabilities: [],
  },
  {
    // "Speed square" is a trademark (hard rule 11); rafter square is the generic name.
    id: 'rafter-square',
    name: 'Rafter square',
    group: 'measuring-and-marking',
    capabilities: [],
  },
  { id: 'sliding-bevel', name: 'Sliding bevel', group: 'measuring-and-marking', capabilities: [] },
  { id: 'chalk-line', name: 'Chalk line', group: 'measuring-and-marking', capabilities: [] },
  { id: 'level', name: 'Level', group: 'measuring-and-marking', capabilities: [] },
  { id: 'string-line', name: 'String line', group: 'measuring-and-marking', capabilities: [] },
  { id: 'line-level', name: 'Line level', group: 'measuring-and-marking', capabilities: [] },

  // Cutting
  {
    id: 'circular-saw',
    name: 'Circular saw',
    group: 'cutting',
    capabilities: [
      {
        id: 'depthOfCut',
        label: 'Depth of cut with the blade square',
        kind: 'length',
        help: 'Decides whether a cut through thick stock takes one pass or two.',
        readFrom: READ_MANUAL,
        min: SIXTEENTH,
        max: 12,
      },
    ],
  },
  {
    id: 'miter-saw',
    name: 'Miter saw',
    group: 'cutting',
    capabilities: [
      {
        id: 'crosscutWidth',
        label: 'Widest crosscut with the saw square',
        kind: 'length',
        help: 'Decides which boards it cuts across in one pass.',
        readFrom: READ_MANUAL,
        min: SIXTEENTH,
        max: 24,
      },
      {
        id: 'cutDepth',
        label: 'Thickest board it cuts through',
        kind: 'length',
        help: 'Decides whether it cuts thick stock, such as a 4x4, in one pass.',
        readFrom: READ_MANUAL,
        min: SIXTEENTH,
        max: 12,
      },
      {
        id: 'maxMiter',
        label: 'Largest miter',
        kind: 'angle',
        help: 'Decides which angled crosscuts it can make.',
        readFrom: 'The miter scale on the saw.',
        min: 0,
        max: 90,
      },
    ],
  },
  { id: 'hand-saw', name: 'Hand saw', group: 'cutting', capabilities: [] },
  {
    id: 'jigsaw',
    name: 'Jigsaw',
    group: 'cutting',
    capabilities: [
      {
        id: 'depthOfCut',
        label: 'Deepest cut in wood',
        kind: 'length',
        help: 'Decides whether it cuts through the stock in one pass.',
        readFrom: "The tool's manual, and the length of the blades you have.",
        min: SIXTEENTH,
        max: 12,
      },
    ],
  },

  // Drilling and driving
  {
    id: 'drill-driver',
    name: 'Drill/driver',
    group: 'drilling-and-driving',
    capabilities: [],
  },
  { id: 'impact-driver', name: 'Impact driver', group: 'drilling-and-driving', capabilities: [] },
  {
    id: 'spade-bits',
    name: 'Spade bits',
    group: 'drilling-and-driving',
    capabilities: [
      {
        id: 'reach',
        label: 'Deepest hole from one side',
        kind: 'length',
        help: 'Decides whether a hole through thick stock is drilled from one side or from both. Include any extension you use.',
        readFrom: 'Measure the longest bit, with its extension, from the chuck to the tip.',
        min: SIXTEENTH,
        max: 36,
      },
    ],
  },
  {
    id: 'auger-bits',
    name: 'Auger bits',
    group: 'drilling-and-driving',
    capabilities: [
      {
        id: 'reach',
        label: 'Deepest hole from one side',
        kind: 'length',
        help: 'Decides whether a hole through thick stock is drilled from one side or from both. Include any extension you use.',
        readFrom: 'Measure the longest bit, with its extension, from the chuck to the tip.',
        min: SIXTEENTH,
        max: 36,
      },
    ],
  },
  { id: 'socket-wrench', name: 'Socket wrench', group: 'drilling-and-driving', capabilities: [] },

  // Clamping and holding
  {
    id: 'clamps',
    name: 'Clamps',
    group: 'clamping-and-holding',
    capabilities: [
      {
        id: 'count',
        label: 'How many',
        kind: 'integer',
        unit: 'clamps',
        help: 'Decides whether parts can be held in place while you drill and bolt them.',
        readFrom: 'Count the clamps you have.',
        min: 1,
        max: 50,
      },
      {
        id: 'maxOpening',
        label: 'Widest opening',
        kind: 'length',
        help: 'Decides whether a clamp reaches across an assembly, such as three boards bolted together.',
        readFrom: 'Measure your largest clamp, opened fully.',
        min: SIXTEENTH,
        max: 72,
      },
    ],
  },

  // Shaping
  { id: 'chisel', name: 'Chisel', group: 'shaping', capabilities: [] },
  { id: 'block-plane', name: 'Block plane', group: 'shaping', capabilities: [] },
  { id: 'sander', name: 'Sander', group: 'shaping', capabilities: [] },

  // Digging and setting
  {
    id: 'post-hole-digger',
    name: 'Post-hole digger',
    group: 'digging-and-setting',
    capabilities: [],
  },
  { id: 'shovel', name: 'Shovel', group: 'digging-and-setting', capabilities: [] },
  { id: 'tamper', name: 'Tamper', group: 'digging-and-setting', capabilities: [] },
] as const satisfies readonly z.input<typeof ToolType>[];

export type ToolTypeId = (typeof TOOL_TYPES)[number]['id'];

/**
 * Capabilities the library asked for and no longer does, by tool type (#171): no method used
 * them. A stored value for one is dropped when read, not moved to other tools, since it was a
 * library detail and not a tool of its own.
 */
export const RETIRED_CAPABILITIES: Readonly<Partial<Record<ToolTypeId, readonly string[]>>> = {
  'circular-saw': ['maxBevel'],
  'miter-saw': ['maxBevel'],
  jigsaw: ['maxBevel'],
  'drill-driver': ['chuckSize'],
};

const BY_ID: ReadonlyMap<string, ToolType> = new Map(TOOL_TYPES.map((t) => [t.id, t as ToolType]));

/** The library entry for an ID, or undefined for an ID not in the library. */
export function findToolType(id: string): ToolType | undefined {
  return BY_ID.get(id);
}
