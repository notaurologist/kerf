import { boardCuts, type OperationType } from '../../model/operations.ts';
import type { StepOutline } from '../../steps/build.ts';
import type { CabinetDesign } from './template.ts';

// The order of the build steps (spec, Build steps): let the lumber settle before the boards are
// cut, then after cutting them make the panels, cut
// them to size, cut the joinery, fit the case dry, glue it up and then the top, ease the edges
// once the joints are closed, and finish.

const STEPS: {
  id: string;
  title: string;
  types: readonly OperationType[];
  ids?: string[];
  beforeCutting?: true;
}[] = [
  {
    id: 'settle',
    title: 'Let the lumber settle indoors',
    types: ['acclimate'],
    beforeCutting: true,
  },
  { id: 'panels', title: 'Glue up the panels', types: ['joint-edges', 'glue-up', 'flatten'] },
  { id: 'size', title: 'Cut the panels to size', types: ['rip', 'crosscut'] },
  { id: 'dadoes', title: 'Cut the dadoes', types: ['dado', 'stopped-dado'] },
  { id: 'feet', title: 'Cut the notches and the feet', types: ['notch', 'cutout'] },
  { id: 'dry-fit', title: 'Fit the case together dry', types: ['dry-fit'] },
  { id: 'case', title: 'Glue up the case', types: ['glue-assembly'], ids: ['case/glue'] },
  { id: 'top', title: 'Glue on the top', types: ['glue-assembly'], ids: ['top/glue'] },
  { id: 'ease', title: 'Ease the edges', types: ['ease-edges'] },
  { id: 'finish', title: 'Finish', types: ['finish'] },
];

export function stepOutline(design: Pick<CabinetDesign, 'operations'>): StepOutline[] {
  const cuts = new Set(boardCuts(design.operations).map((op) => op.id));
  const rest = design.operations.filter((op) => !cuts.has(op.id));
  return STEPS.map((s) => ({
    id: s.id,
    title: s.title,
    operationIds: rest
      .filter((op) => s.types.includes(op.type) && (!s.ids || s.ids.includes(op.id)))
      .map((op) => op.id),
    categories: [],
    ...(s.beforeCutting ? { beforeCutting: true as const } : {}),
  })).filter((s) => s.operationIds.length > 0);
}
