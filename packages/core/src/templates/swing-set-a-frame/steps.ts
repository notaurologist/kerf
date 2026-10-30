import type { StepOutline } from '../../steps/build.ts';
import type { Operation } from '../operations.ts';
import type { SwingSetOutput } from './template.ts';

// The swing set's build order (spec, Build steps): cut the parts, ease their edges, prepare the
// site, bolt the crossbars and gussets across each pair of legs, then bolt the beam between the
// leg tops. Generic code fills in methods; this only groups and orders the operations.

const CUTS: readonly Operation['type'][] = ['crosscut', 'miter', 'taper'];

export function stepOutline(design: SwingSetOutput): StepOutline[] {
  const ops = design.operations ?? [];
  if (ops.length === 0) return [];
  const role = new Map(design.parts.map((p) => [p.id, p.role]));
  const ids = (keep: (op: Operation) => boolean) => ops.filter(keep).map((op) => op.id);
  const cutsOf = (...roles: string[]) =>
    ids(
      (op) => CUTS.includes(op.type) && 'partId' in op && roles.includes(role.get(op.partId) ?? ''),
    );
  const boltsThrough = (board: string) =>
    ids((op) => op.type === 'bolt-holes' && op.partIds.some((id) => role.get(id) === board));
  const buried = ops.some((op) => op.type === 'dig-holes');
  return [
    { id: 'cut-beam', title: 'Cut the beam', operationIds: cutsOf('beam'), categories: [] },
    { id: 'cut-legs', title: 'Cut the legs', operationIds: cutsOf('leg'), categories: [] },
    {
      id: 'cut-boards',
      title: 'Cut the crossbars and gussets',
      operationIds: cutsOf('crossbar', 'gusset'),
      categories: [],
    },
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
    {
      id: 'beam',
      title: 'Bolt the beam between the leg tops',
      operationIds: boltsThrough('beam'),
      categories: ['load-bearing', 'dynamic-loads'],
    },
  ];
}
