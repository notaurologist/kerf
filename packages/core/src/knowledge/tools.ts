import { z } from 'zod';

// The tool-type library (decision 0009; DOMAIN.md, Tool): generic tool types, grouped as a shop
// would group them, each with the capabilities that change which method fits. The owner's
// inventory picks from this list (inventory/tools.ts), and methods (#104) name these IDs.
//
// Names are generic (hard rule 11). A capability holds a value the owner reads off their own tool,
// so the library states no numbers about tools; each capability says where its value is read, and
// none has a default (hard rule 3). A capability is listed only if a method uses it.

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
    /** What the tool is, and what Kerf's methods use it for, for the tool's page. */
    description: z.string().min(1),
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
 * each template lists in its spec (docs/templates/, Tools for the work). Also the power tools that
 * home-shop tool lists name, so they need not go under other tools: Fine Woodworking, "Choosing
 * Tools: How to Do More with Less", and Highland Woodworking, "Woodworking Tool List", both read
 * October 2026. In group order, then in the order a shop would reach for them.
 */
export const TOOL_TYPES = [
  // Measuring and marking
  {
    id: 'tape-measure',
    name: 'Tape measure',
    description:
      "A steel tape that pulls out of its case and locks, for measuring lengths. Kerf's methods use it to measure and mark parts.",
    group: 'measuring-and-marking',
    capabilities: [],
  },
  {
    id: 'combination-square',
    name: 'Combination square',
    description:
      "A ruler with a sliding head that holds it square to a board's edge, for marking square lines and checking cuts.",
    group: 'measuring-and-marking',
    capabilities: [],
  },
  {
    // "Speed square" is a trademark (hard rule 11); rafter square is the generic name.
    id: 'rafter-square',
    name: 'Rafter square',
    description:
      'A thick triangular square with a lip along one edge that hooks over a board, for marking square and angled lines and guiding a circular saw.',
    group: 'measuring-and-marking',
    capabilities: [],
  },
  {
    id: 'sliding-bevel',
    name: 'Sliding bevel',
    description:
      'A blade on a handle that locks at any angle, for copying an angle or laying it out on a board.',
    group: 'measuring-and-marking',
    capabilities: [],
  },
  {
    id: 'chalk-line',
    name: 'Chalk line',
    description:
      'A string coated in chalk on a reel. Pulled tight and snapped, it marks a long straight line.',
    group: 'measuring-and-marking',
    capabilities: [],
  },
  {
    id: 'level',
    name: 'Level',
    description: 'A straight bar with bubble vials that shows whether a surface is level or plumb.',
    group: 'measuring-and-marking',
    capabilities: [],
  },
  {
    id: 'string-line',
    name: 'String line',
    description:
      'String stretched tight between stakes, for laying out straight lines and points on the site, such as where holes go.',
    group: 'measuring-and-marking',
    capabilities: [],
  },
  {
    id: 'line-level',
    name: 'Line level',
    description:
      'A small bubble vial that hangs on a string line to show when the string is level, for checking heights across the site.',
    group: 'measuring-and-marking',
    capabilities: [],
  },

  // Cutting
  {
    id: 'circular-saw',
    name: 'Circular saw',
    description:
      "A handheld power saw with a round blade, guided along a line or a straight board. Kerf's methods use it for crosscuts and angled cuts.",
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
    description:
      'A round blade on a pivoting arm over a table with a fence, set to an angle by its scales. It cuts boards to length, square or angled.',
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
  {
    id: 'table-saw',
    name: 'Table saw',
    description:
      'A round blade that rises through a table, with the board pushed across it, mostly for ripping.',
    group: 'cutting',
    capabilities: [],
  },
  {
    id: 'track-saw',
    name: 'Track saw',
    description:
      'A circular saw that runs along a guide rail laid on the board, for long straight cuts.',
    group: 'cutting',
    capabilities: [],
  },
  {
    id: 'band-saw',
    name: 'Band saw',
    description:
      'A thin blade in a loop that runs down through a table, for curves and cuts through thick stock.',
    group: 'cutting',
    capabilities: [],
  },
  {
    id: 'hand-saw',
    name: 'Hand saw',
    description:
      "A saw pushed and pulled by hand. Kerf's methods use it where a power saw cannot reach and to finish a cut made from two faces.",
    group: 'cutting',
    capabilities: [],
  },
  {
    id: 'jigsaw',
    name: 'Jigsaw',
    description:
      'A handheld power saw with a short blade that moves up and down, for curves and cuts other saws cannot reach.',
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
    description:
      "A drill with a clutch, for drilling holes and driving screws. Kerf's methods use it with spade and auger bits for bolt holes.",
    group: 'drilling-and-driving',
    capabilities: [],
  },
  {
    id: 'impact-driver',
    name: 'Impact driver',
    description:
      'A driver that adds rapid blows to its turning, for driving long screws and lag screws.',
    group: 'drilling-and-driving',
    capabilities: [],
  },
  {
    id: 'drill-press',
    name: 'Drill press',
    description: 'A drill mounted on a column over a table, so holes go straight into the work.',
    group: 'drilling-and-driving',
    capabilities: [],
  },
  {
    id: 'spade-bits',
    name: 'Spade bits',
    description:
      'Flat drill bits with a center point and two cutting edges, for fast, rough holes in wood.',
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
    description:
      'Drill bits with a screw tip and a spiral that pulls them through deep wood and clears the chips, for long bolt holes.',
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
    id: 'socket-wrench',
    name: 'Socket wrench',
    description: 'A handle with sockets that fit over nuts and bolt heads, for tightening bolts.',
    group: 'drilling-and-driving',
    capabilities: [],
  },

  // Clamping and holding
  {
    id: 'clamps',
    name: 'Clamps',
    description:
      'Tools that hold a board to a bench, or parts to each other, while you cut, drill, or fasten.',
    group: 'clamping-and-holding',
    capabilities: [
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
  {
    id: 'router',
    name: 'Router',
    description:
      'A motor that spins a shaped bit, for rounding edges, cutting grooves, and trimming.',
    group: 'shaping',
    capabilities: [],
  },
  {
    id: 'thickness-planer',
    name: 'Thickness planer',
    description: 'A machine that planes a board to an even thickness, a thin layer at a time.',
    group: 'shaping',
    capabilities: [],
  },
  {
    id: 'chisel',
    name: 'Chisel',
    description:
      "A steel blade sharpened at its end, pushed or tapped to pare wood. Kerf's methods use it to bring a cut down to its line.",
    group: 'shaping',
    capabilities: [],
  },
  {
    id: 'block-plane',
    name: 'Block plane',
    description: 'A small hand plane held in one hand, for trimming end grain and easing edges.',
    group: 'shaping',
    capabilities: [],
  },
  {
    id: 'sander',
    name: 'Sander',
    description: 'A power tool that moves sandpaper fast, for smoothing faces and rounding edges.',
    group: 'shaping',
    capabilities: [],
  },

  // Digging and setting
  {
    id: 'post-hole-digger',
    name: 'Post-hole digger',
    description:
      'Two hinged blades on long handles that dig and lift soil out of a narrow, deep hole.',
    group: 'digging-and-setting',
    capabilities: [],
  },
  {
    id: 'shovel',
    name: 'Shovel',
    description: 'A blade on a long handle, for digging and moving soil.',
    group: 'digging-and-setting',
    capabilities: [],
  },
  {
    id: 'tamper',
    name: 'Tamper',
    description: 'A heavy flat plate on a handle, for tamping soil and gravel firm.',
    group: 'digging-and-setting',
    capabilities: [],
  },
] as const satisfies readonly z.input<typeof ToolType>[];

export type ToolTypeId = (typeof TOOL_TYPES)[number]['id'];

const BY_ID: ReadonlyMap<string, ToolType> = new Map(TOOL_TYPES.map((t) => [t.id, t as ToolType]));

/** The library entry for an ID, or undefined for an ID not in the library. */
export function findToolType(id: string): ToolType | undefined {
  return BY_ID.get(id);
}
