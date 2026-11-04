import { boardCuts, type OperationType } from '../../model/operations.ts';
import type { StepOutline } from '../../steps/build.ts';
import type { CabinetDesign } from './template.ts';

// The order of the build steps (spec, Build steps): let the lumber settle before the boards are
// cut, then after cutting them make the panels, plane what is thinner than they leave it, cut them
// to size, cut the joinery, fit everything dry, glue up the base, the cleats, the case, and the top, screw the case to the base, glue up the
// doors, ease the edges once the joints are closed, and finish.

const STEPS: {
  id: string;
  title: string;
  types: readonly OperationType[];
  ids?: string[];
  /** Only these parts' operations. */
  parts?: string[];
  beforeCutting?: true;
}[] = [
  {
    id: 'settle',
    title: 'Let the lumber settle indoors',
    types: ['acclimate'],
    beforeCutting: true,
  },
  { id: 'panels', title: 'Glue up the panels', types: ['joint-edges', 'glue-up', 'flatten'] },
  { id: 'plane', title: 'Plane to thickness', types: ['plane-to-thickness'] },
  { id: 'size', title: 'Cut the panels to size', types: ['rip', 'crosscut'] },
  {
    id: 'dadoes',
    title: 'Cut the dadoes and rabbets',
    types: ['dado', 'stopped-dado', 'stopped-rabbet', 'double-stopped-dado'],
  },
  // Plans from before the leg base also have the cutout between each side's feet.
  { id: 'notches', title: 'Cut the notches', types: ['notch', 'cutout'] },
  { id: 'mortises', title: 'Cut the mortises in the legs', types: ['mortise'] },
  {
    id: 'tenons',
    title: 'Cut the tenons on the aprons',
    types: ['tenon'],
    parts: ['apron-long', 'apron-short'],
  },
  { id: 'screw-holes', title: 'Drill the cleats’ screw holes', types: ['screw-holes'] },
  {
    id: 'door-joints',
    title: 'Cut the doors’ grooves, tenons, and rabbets',
    types: ['groove', 'tenon', 'rabbet', 'finger-recess'],
    parts: ['door-stile-outer', 'door-stile-inner', 'door-rail', 'door-panel'],
  },
  { id: 'dry-fit', title: 'Fit the cabinet together dry', types: ['dry-fit'] },
  { id: 'base', title: 'Glue up the base', types: ['glue-assembly'], ids: ['base/glue'] },
  { id: 'cleats', title: 'Glue the cleats in', types: ['glue-assembly'], ids: ['cleats/glue'] },
  { id: 'case', title: 'Glue up the case', types: ['glue-assembly'], ids: ['case/glue'] },
  { id: 'top', title: 'Glue on the top', types: ['glue-assembly'], ids: ['top/glue'] },
  { id: 'fasten', title: 'Screw the case to the base', types: ['fasten'] },
  { id: 'doors', title: 'Glue up the doors', types: ['glue-assembly'], ids: ['doors/glue'] },
  { id: 'ease', title: 'Ease the edges', types: ['ease-edges'] },
  { id: 'finish', title: 'Finish', types: ['finish'] },
];

export function stepOutline(design: Pick<CabinetDesign, 'operations'>): StepOutline[] {
  const cuts = new Set(boardCuts(design.operations).map((op) => op.id));
  const rest = design.operations.filter((op) => !cuts.has(op.id));
  return STEPS.map((s) => ({
    id: s.id,
    title:
      s.id === 'notches' && rest.some((op) => op.type === 'cutout')
        ? 'Cut the notches and the feet'
        : s.title,
    operationIds: rest
      .filter(
        (op) =>
          s.types.includes(op.type) &&
          (!s.ids || s.ids.includes(op.id)) &&
          (!s.parts || ('partId' in op && s.parts.includes(op.partId))),
      )
      .map((op) => op.id),
    categories: [],
    ...(s.beforeCutting ? { beforeCutting: true as const } : {}),
  })).filter((s) => s.operationIds.length > 0);
}
