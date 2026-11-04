import { z } from 'zod';

// Skills the methods use (decision 0009; DOMAIN.md, Knowledge base): what a step asks of the
// person doing it, so build steps can say what to practice first. Methods name these IDs.

export const Skill = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be a lowercase ID like cut-to-a-line'),
  /** A plain name, in sentence case. */
  name: z.string().min(1),
  /** What doing it well looks like, in a sentence or two. */
  description: z.string().min(1),
});
export type Skill = z.infer<typeof Skill>;

/** In the order a build first needs them. */
export const SKILLS = [
  {
    id: 'measure-and-mark',
    name: 'Measuring and marking a length',
    description:
      'Hook the tape on the end or the line you measure from, and mark the length with a V whose point is on the measurement.',
  },
  {
    id: 'square-a-line',
    name: 'Squaring a line around a board',
    description:
      'Draw a line square across the face with a square held tight to the edge, then carry it around the edges and the other face so the lines meet.',
  },
  {
    id: 'lay-out-an-angle',
    name: 'Laying out an angled line from marks',
    description:
      'Mark a point on each edge, or on an edge and an end, and join them with a straightedge. Measuring two points avoids reading an angle off a scale.',
  },
  {
    id: 'cut-to-a-line',
    name: 'Cutting to a line',
    description:
      'Cut with the kerf on the waste side, so the line is still there on the part after the cut.',
  },
  {
    id: 'guide-a-circular-saw',
    name: 'Guiding a circular saw',
    description:
      'Hold the saw base flat and tight against a square or straightedge clamped or held to the board, and feed at the speed the blade cuts without slowing.',
  },
  {
    id: 'saw-by-hand',
    name: 'Sawing by hand',
    description:
      'Start the cut with short pulls at the far corner, then saw with long, light strokes, watching the line on the face and the edge together.',
  },
  {
    id: 'rip-along-a-fence',
    name: 'Ripping along a fence or guide',
    description:
      'Keep the board tight against the fence or the guide rail for the whole cut, feeding at an even speed, so the cut runs straight and parallel to the edge kept.',
  },
  {
    id: 'cut-from-two-faces',
    name: 'Cutting thick stock from two faces',
    description:
      'Square the line around the board, cut from one face, turn the board over, and cut from the other face so the two kerfs meet.',
  },
  {
    id: 'pare-to-a-line',
    name: 'Paring or planing to a line',
    description:
      'Take thin shavings with a sharp chisel or block plane until the surface meets the line on both faces.',
  },
  {
    id: 'rout-along-a-guide',
    name: 'Routing along a guide',
    description:
      'Clamp a straight guide where the router base must run, set the depth, and feed so the spinning bit pulls the base against the guide, in shallow cuts until the full depth.',
  },
  {
    id: 'joint-an-edge',
    name: 'Jointing an edge',
    description:
      'Plane or saw an edge straight along its length and square to the face, checking it against a straightedge and a square.',
  },
  {
    id: 'glue-up-a-panel',
    name: 'Gluing up a panel',
    description:
      'Spread glue evenly on every joint, bring the boards together in order, and tighten the clamps evenly until a small bead of glue squeezes out along each joint, with the faces level.',
  },
  {
    id: 'flatten-a-panel',
    name: 'Flattening a panel',
    description:
      'Take the faces down evenly until a straightedge laid across and along the panel touches everywhere, with no step at any joint.',
  },
  {
    id: 'glue-up-strips',
    name: 'Gluing strips face to face',
    description:
      'Spread glue on every face that meets another, bring the strips together in order before the glue dries, and clamp them along their length until a small bead squeezes out of every glue line, with their edges level.',
  },
  {
    id: 'flatten-a-glue-up',
    name: 'Flattening a thick glue-up',
    description:
      "Take both faces that show the strips' edges down evenly until a straightedge laid across, along, and corner to corner touches everywhere, with no step at any glue line and no twist.",
  },
  {
    id: 'settle-lumber',
    name: 'Letting lumber settle',
    description:
      'Stack boards indoors on strips so air reaches every face, and leave them until they stop drying before you cut and glue them.',
  },
  {
    id: 'cut-a-mortise',
    name: 'Cutting a mortise',
    description:
      'Mark the pocket, remove the waste to a steady depth, and pare the walls straight and square to the marks, testing the fit with its tenon.',
  },
  {
    id: 'drive-a-screw',
    name: 'Driving a screw',
    description:
      'Keep the driver in line with the screw, slow down for the last turns, and stop when the head is snug, so it neither strips nor pins what it holds.',
  },
  {
    id: 'cut-a-screw-slot',
    name: 'Cutting a screw slot',
    description:
      'Drill and clean out a slot the screw slides along, running the way the part it holds will move, and drive the screw snug rather than tight.',
  },
  {
    id: 'cut-a-tenon',
    name: 'Cutting a tenon',
    description:
      'Mark the shoulder around the part, cut the cheeks on the waste side to a steady thickness, and trim until it slides into its mortise with hand pressure.',
  },
  {
    id: 'cut-dovetails',
    name: 'Cutting dovetails',
    description:
      'Scribe the baseline at the other board’s thickness, saw each wall on the waste side square across the end, chop the waste halfway from each face, and mark the pins from the finished tails so the two fit as a pair.',
  },
  {
    id: 'fit-an-assembly',
    name: 'Fitting an assembly dry',
    description:
      'Put the parts together without glue, check that every joint closes and the assembly is square, and mark how each part goes back.',
  },
  {
    id: 'glue-up-an-assembly',
    name: 'Gluing up an assembly',
    description:
      'Glue and close one joint group at a time, clamp evenly until a small bead squeezes out, and pull the assembly square by its diagonals before the glue sets.',
  },
  {
    id: 'apply-a-finish',
    name: 'Applying a finish',
    description:
      'Sand with the grain, clear the dust, and wipe on thin coats as the finish’s instructions say, storing used rags safely.',
  },
  {
    id: 'clamp-parts-in-place',
    name: 'Clamping parts in place',
    description:
      'Set the parts in their positions from the plan and clamp them so they cannot shift while you drill.',
  },
  {
    id: 'drill-straight',
    name: 'Drilling straight through thick stock',
    description:
      'Keep the bit square to the face, checking from two directions, and back it out often to clear the chips.',
  },
  {
    id: 'drill-from-both-sides',
    name: 'Drilling to meet from both sides',
    description:
      'Mark the hole center on both outer faces from the same reference, drill each side past halfway, and check that the holes meet.',
  },
  {
    id: 'bore-to-a-depth',
    name: 'Boring holes to a depth',
    description:
      'Set a stop or mark on the bit so every hole ends at the same depth, with its center on the mark and the bit square to the face.',
  },
  {
    id: 'ease-an-edge',
    name: 'Easing edges',
    description:
      'Round over or chamfer every corner a hand can touch, and sand the faces until no splinter catches.',
  },
  {
    id: 'treat-a-cut',
    name: 'Field-treating cuts and holes',
    description:
      'Coat every face a saw or bit opened in treated lumber with preservative, as its label says, and wipe off what does not soak in.',
  },
  {
    id: 'dig-a-post-hole',
    name: 'Digging a post hole',
    description:
      'Dig straight down at the marked center to the depth the plan gives, keeping the sides plumb and the bottom flat.',
  },
  {
    id: 'level-a-base',
    name: 'Leveling and tamping a base',
    description:
      'Remove sod and loose soil, tamp the base firm, and check it level in two directions and against the other bases.',
  },
  {
    id: 'raise-and-brace',
    name: 'Raising and bracing an assembly',
    description:
      'Stand a heavy assembly up with enough helpers, each knowing their part, and hold it plumb with temporary braces until it is fixed in place.',
  },
  {
    id: 'backfill-a-hole',
    name: 'Backfilling a post hole',
    description:
      'Fill around a part in its hole in shallow layers, tamping each one firm, checking the part stays plumb, and leaving the top mounded to shed water.',
  },
  {
    id: 'set-an-anchor',
    name: 'Setting a ground anchor',
    description:
      'Set an anchor as its maker’s instructions say, fasten it to the part it holds, and cover it so no one trips on it.',
  },
  {
    id: 'tighten-a-bolt',
    name: 'Tightening a bolt',
    description:
      'Hold the head and turn the nut until the washers bear firmly on the wood without crushing it, then check it again as the wood dries.',
  },
  {
    id: 'hang-a-seat',
    name: 'Hanging a seat',
    description:
      'Hang a seat from fittings already on the structure, at the height the plan gives, level, with every link and hook closed.',
  },
] as const satisfies readonly z.input<typeof Skill>[];

export type SkillId = (typeof SKILLS)[number]['id'];

const SKILL_IDS = SKILLS.map((s) => s.id) as [SkillId, ...SkillId[]];
export const SkillIdSchema = z.enum(SKILL_IDS);

/** The skill entry for an ID, or undefined for an ID not in the list. */
export function findSkill(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}
