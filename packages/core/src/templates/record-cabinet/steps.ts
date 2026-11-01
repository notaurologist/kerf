import { boardCuts, type OperationType } from '../../model/operations.ts';
import type { StepOutline } from '../../steps/build.ts';
import type { CabinetDesign } from './template.ts';

// The order of the build steps after the boards are cut (spec, Build steps): make the panels, cut
// them to size, cut the joinery, and ease the edges. Assembling the case and finishing have no
// operation types yet.

const STEPS: { id: string; title: string; types: readonly OperationType[] }[] = [
  { id: 'panels', title: 'Glue up the panels', types: ['joint-edges', 'glue-up', 'flatten'] },
  { id: 'size', title: 'Cut the panels to size', types: ['rip', 'crosscut'] },
  { id: 'dadoes', title: 'Cut the dadoes', types: ['dado', 'stopped-dado'] },
  { id: 'feet', title: 'Cut the notches and the feet', types: ['notch', 'cutout'] },
  { id: 'ease', title: 'Ease the edges', types: ['ease-edges'] },
];

export function stepOutline(design: Pick<CabinetDesign, 'operations'>): StepOutline[] {
  const cuts = new Set(boardCuts(design.operations).map((op) => op.id));
  const rest = design.operations.filter((op) => !cuts.has(op.id));
  return STEPS.map((s) => ({
    id: s.id,
    title: s.title,
    operationIds: rest.filter((op) => s.types.includes(op.type)).map((op) => op.id),
    categories: [],
  })).filter((s) => s.operationIds.length > 0);
}
