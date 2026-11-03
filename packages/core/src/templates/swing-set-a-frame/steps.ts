import type { Operation } from '../../model/operations.ts';
import type { StepOutline } from '../../steps/build.ts';
import type { StoredSwingSetOutputs } from './outputs.ts';

// The swing set's build order after cutting, which generic code does board by board (spec, Build
// steps): ease the parts' edges, treat every cut, prepare the site, bolt the crossbars and gussets
// across each pair of legs, then bolt the beam between the leg tops. Each bolt's holes are treated
// right after they are drilled, before the bolt goes in. Generic code fills in methods; this only
// groups and orders the operations.

export function stepOutline(design: StoredSwingSetOutputs['design']): StepOutline[] {
  const ops = design.operations ?? [];
  if (ops.length === 0) return [];
  const role = new Map(design.parts.map((p) => [p.id, p.role]));
  const ids = (keep: (op: Operation) => boolean) => ops.filter(keep).map((op) => op.id);
  const treatHoles = new Map(
    ops.flatMap((op) => (op.type === 'treat-holes' ? [[op.hardwareId, op.id] as const] : [])),
  );
  const boltsThrough = (board: string) =>
    ops.flatMap((op) => {
      if (op.type !== 'bolt-holes' || !op.partIds.some((id) => role.get(id) === board)) return [];
      const treat = treatHoles.get(op.hardwareId);
      return treat ? [op.id, treat] : [op.id];
    });
  // Plans made before version 26 have no field treatment, and so no step for it.
  const treatCuts = ids((op) => op.type === 'treat-cuts');
  const buried = ops.some((op) => op.type === 'dig-holes');
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
      // The beam's bolts also pass through the legs; they are in the last step.
      operationIds: [...boltsThrough('crossbar'), ...boltsThrough('gusset')],
      categories: ['load-bearing'],
    },
    {
      id: 'beam',
      title: 'Bolt the beam between the leg tops',
      operationIds: boltsThrough('beam'),
      categories: ['load-bearing', 'dynamic-loads'],
    },
  ];
}
