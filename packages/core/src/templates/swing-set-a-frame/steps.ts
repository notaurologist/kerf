import type { Operation } from '../../model/operations.ts';
import type { StepOutline } from '../../steps/build.ts';
import { HANGER_BOLTS } from './hardware.ts';
import type { StoredSwingSetOutputs } from './outputs.ts';

type BoltHoles = Extract<Operation, { type: 'bolt-holes' }>;

// The swing set's build order after cutting, which generic code does board by board (spec, Build
// steps): ease the parts' edges, treat every cut, prepare the site, bolt the crossbars and gussets
// across each pair of legs, drill the swing hanger holes, stand the A-frames up, bolt the beam
// between the leg tops, set the legs, tighten every bolt, and hang the swings. Each bolt's holes
// are treated right after they are drilled, before the bolt goes in. Generic code fills in
// methods; this only groups and orders the operations, with the CPSC rules for the work as notes.

/** CPSC Pub. 324 (2005), read November 2026: the rules for each step that puts the frame up. */
const ANCHOR_NOTES = [
  'Follow the anchor maker’s instructions, and bury the anchors or cover them with the surfacing, so no one trips on them (CPSC Pub. 324, p. 4).',
];
const TIGHTEN_NOTES = [
  'Tighten all connections, with a locking nut on every bolt (CPSC Pub. 324, pp. 3 and 4).',
  'Cap every exposed bolt end. A bolt should stand no more than its own diameter past the nut (CPSC Pub. 324, p. 3).',
  'Check the nuts and bolts twice a month, tighten them as needed, and check that the caps are in place (CPSC Pub. 324, p. 5).',
];
const HANG_NOTES = [
  'Close S-hooks and all other hooks to a gap less than the thickness of a dime. An open hook is acceptable only at the uppermost attachment (CPSC Pub. 324, p. 3).',
  'Use lightweight seats, not heavy metal or wood ones (CPSC Pub. 324, p. 4).',
  'Leave at least 8 inches between the surfacing and the underside of each seat (CPSC Pub. 324, p. 5).',
  'Do not hang a seat on rope that can untwist or separate (CPSC Pub. 324, p. 8).',
  'Check the seats and chains monthly, and replace them as they wear (CPSC Pub. 324, p. 5).',
];

export function stepOutline(design: StoredSwingSetOutputs['design']): StepOutline[] {
  const ops = design.operations ?? [];
  if (ops.length === 0) return [];
  const role = new Map(design.parts.map((p) => [p.id, p.role]));
  const ids = (keep: (op: Operation) => boolean) => ops.filter(keep).map((op) => op.id);
  const treatHoles = new Map(
    ops.flatMap((op) => (op.type === 'treat-holes' ? [[op.hardwareId, op.id] as const] : [])),
  );
  const forHangers = (op: BoltHoles) => op.hardwareId === HANGER_BOLTS;
  const drilled = (keep: (op: BoltHoles) => boolean) =>
    ops.flatMap((op) => {
      if (op.type !== 'bolt-holes' || !keep(op)) return [];
      const treat = treatHoles.get(op.hardwareId);
      return treat ? [op.id, treat] : [op.id];
    });
  const boltsThrough = (board: string) =>
    drilled((op) => !forHangers(op) && op.partIds.some((id) => role.get(id) === board));
  // Plans made before version 26 have no field treatment, and so no step for it.
  const treatCuts = ids((op) => op.type === 'treat-cuts');
  const buried = ops.some((op) => op.type === 'dig-holes');
  const hangerHoles = drilled(forHangers);
  // Plans made before version 31 stop once the beam is bolted, and so have none of the steps that
  // follow it.
  const step = (outline: StepOutline): StepOutline[] =>
    outline.operationIds.length > 0 ? [outline] : [];
  const set = ids((op) => op.type === 'backfill' || op.type === 'anchor');
  return [
    {
      id: 'ease-edges',
      title: 'Ease the edges of every part',
      operationIds: ids((op) => op.type === 'ease-edges'),
      categories: [],
    },
    ...(treatCuts.length > 0
      ? [
          {
            id: 'treat-cuts',
            title: 'Treat every cut with preservative',
            operationIds: treatCuts,
            categories: [],
          },
        ]
      : []),
    {
      id: 'site',
      title: buried ? 'Dig the leg holes' : 'Level the pads',
      operationIds: ids((op) => op.type === 'dig-holes' || op.type === 'level-pads'),
      categories: ['load-bearing'],
    },
    {
      id: 'frames',
      title: 'Bolt the crossbars and gussets across the legs',
      // The beam's bolts also pass through the legs; they are in the beam's step.
      operationIds: [...boltsThrough('crossbar'), ...boltsThrough('gusset')],
      categories: ['load-bearing'],
    },
    // Drilled while the beam is still on the ground.
    ...(hangerHoles.length > 0
      ? [
          {
            id: 'hanger-holes',
            title: 'Drill the swing hanger holes in the beam',
            operationIds: hangerHoles,
            categories: ['load-bearing' as const, 'dynamic-loads' as const],
          },
        ]
      : []),
    ...step({
      id: 'raise',
      title: 'Stand the frames up and brace them',
      operationIds: ids((op) => op.type === 'raise'),
      categories: ['load-bearing'],
    }),
    {
      id: 'beam',
      title: 'Bolt the beam between the leg tops',
      operationIds: boltsThrough('beam'),
      categories: ['load-bearing', 'dynamic-loads'],
    },
    ...step({
      id: 'set',
      title: buried
        ? 'Plumb the frames and backfill the leg holes'
        : 'Plumb the frames and anchor the feet',
      operationIds: set,
      categories: ['load-bearing'],
      ...(buried ? {} : { notes: ANCHOR_NOTES }),
    }),
    ...step({
      id: 'tighten',
      title: 'Tighten every bolt and cap its end',
      operationIds: ids((op) => op.type === 'tighten-bolts'),
      categories: ['load-bearing'],
      notes: TIGHTEN_NOTES,
    }),
    ...step({
      id: 'hang',
      title: 'Hang the swings',
      operationIds: ids((op) => op.type === 'hang'),
      categories: ['dynamic-loads'],
      notes: HANG_NOTES,
    }),
  ];
}
