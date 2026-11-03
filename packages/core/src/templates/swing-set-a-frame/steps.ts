import type { Operation } from '../../model/operations.ts';
import type { StepOutline } from '../../steps/build.ts';
import { HANGER_BOLTS } from './hardware.ts';
import type { StoredSwingSetOutputs } from './outputs.ts';

// The swing set's build order after cutting, which generic code does board by board (spec, Build
// steps): ease the parts' edges, prepare the site, bolt the crossbars and gussets across each pair
// of legs, drill the swing hanger holes, then bolt the beam between the leg tops. Generic code fills in methods; this only
// groups and orders the operations.

export function stepOutline(design: StoredSwingSetOutputs['design']): StepOutline[] {
  const ops = design.operations ?? [];
  if (ops.length === 0) return [];
  const role = new Map(design.parts.map((p) => [p.id, p.role]));
  const ids = (keep: (op: Operation) => boolean) => ops.filter(keep).map((op) => op.id);
  const forHangers = (op: Operation) => op.type === 'bolt-holes' && op.hardwareId === HANGER_BOLTS;
  const boltsThrough = (board: string) =>
    ids(
      (op) =>
        op.type === 'bolt-holes' &&
        !forHangers(op) &&
        op.partIds.some((id) => role.get(id) === board),
    );
  const buried = ops.some((op) => op.type === 'dig-holes');
  const hangerHoles = ids(forHangers);
  return [
    {
      id: 'ease-edges',
      title: 'Ease the edges of every part',
      operationIds: ids((op) => op.type === 'ease-edges'),
      categories: [],
    },
    {
      id: 'site',
      title: buried ? 'Dig the leg holes' : 'Level the pads',
      operationIds: ids((op) => op.type === 'dig-holes' || op.type === 'level-pads'),
      categories: ['load-bearing'],
    },
    {
      id: 'frames',
      title: 'Bolt the crossbars and gussets across the legs',
      // The beam's bolts also pass through the legs; they are in the last step.
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
    {
      id: 'beam',
      title: 'Bolt the beam between the leg tops',
      operationIds: boltsThrough('beam'),
      categories: ['load-bearing', 'dynamic-loads'],
    },
  ];
}
