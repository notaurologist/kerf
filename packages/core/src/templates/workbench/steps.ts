import { boardCuts, type OperationType } from '../../model/operations.ts';
import type { StepOutline } from '../../steps/build.ts';
import type { WorkbenchDesign } from './template.ts';

// The order of the build steps (spec, Build steps): let the lumber settle, glue up and flatten the
// top, legs, feet, and rails from strips and the panels from boards, cut everything to size, cut
// the joinery, fit the bench together dry, glue up the end frames and join them with the low rails
// and the top, build the case, the drawers, and the doors, mount the vises and bore the dog holes,
// ease the edges, and finish.

const STEPS: {
  id: string;
  title: string;
  types: readonly OperationType[];
  ids?: string[];
  /** Only these parts' operations, by a test on the part's ID. */
  parts?: (id: string) => boolean;
  beforeCutting?: true;
}[] = [
  {
    id: 'settle',
    title: 'Let the lumber settle indoors',
    types: ['acclimate'],
    beforeCutting: true,
  },
  {
    id: 'strips',
    title: 'Glue up the top, legs, and rails from strips',
    types: ['rip-strips', 'glue-up-strips', 'flatten-strips'],
  },
  { id: 'panels', title: 'Glue up the panels', types: ['joint-edges', 'glue-up', 'flatten'] },
  { id: 'plane', title: 'Plane to thickness', types: ['plane-to-thickness'] },
  { id: 'size', title: 'Cut the parts to size', types: ['rip', 'crosscut'] },
  { id: 'mortises', title: 'Cut the mortises', types: ['mortise'] },
  {
    id: 'tenons',
    title: 'Cut the tenons on the legs and rails',
    types: ['tenon'],
    parts: (id) => !id.startsWith('door-'),
  },
  {
    id: 'dadoes',
    title: 'Cut the case’s dadoes, grooves, and notches',
    types: [
      'dado',
      'stopped-dado',
      'stopped-rabbet',
      'end-rabbet',
      'double-stopped-dado',
      'face-groove',
      'notch',
      'rabbet',
    ],
    parts: (id) => !id.includes('-drawer-') && !id.startsWith('door-'),
  },
  {
    id: 'dovetails',
    title: 'Cut the drawers’ dovetails and grooves',
    types: ['dovetail-tails', 'dovetail-pins', 'face-groove', 'dado', 'stopped-dado', 'rabbet'],
    parts: (id) => id.includes('-drawer-'),
  },
  {
    id: 'door-joints',
    title: 'Cut the doors’ grooves, tenons, and rabbets',
    types: ['groove', 'tenon', 'rabbet'],
    parts: (id) => id.startsWith('door-'),
  },
  {
    id: 'holes',
    title: 'Bore the hinge cups and drill the screw holes',
    types: ['hinge-cups', 'hinge-plates', 'screw-holes'],
  },
  { id: 'dry-fit', title: 'Fit the bench together dry', types: ['dry-fit'] },
  {
    id: 'end-frames',
    title: 'Glue up the end frames',
    types: ['glue-assembly'],
    ids: ['end-frames/glue'],
  },
  {
    id: 'frame',
    title: 'Join the end frames with the low rails and the top',
    types: ['glue-assembly'],
    ids: ['frame/glue'],
  },
  { id: 'case', title: 'Glue up the case', types: ['glue-assembly'], ids: ['case/glue'] },
  { id: 'drawers', title: 'Glue up the drawers', types: ['glue-assembly'], ids: ['drawers/glue'] },
  { id: 'drawer-screws', title: 'Fit the drawer bottoms and fronts', types: ['fasten'] },
  { id: 'doors', title: 'Glue up the doors', types: ['glue-assembly'], ids: ['doors/glue'] },
  { id: 'vises', title: 'Bore for the vises and the dog holes', types: ['bore', 'stopped-bore'] },
  { id: 'ease', title: 'Ease the edges', types: ['ease-edges'] },
  { id: 'finish', title: 'Finish', types: ['finish'] },
];

export function stepOutline(design: Pick<WorkbenchDesign, 'operations'>): StepOutline[] {
  const cuts = new Set(boardCuts(design.operations).map((op) => op.id));
  const rest = design.operations.filter((op) => !cuts.has(op.id));
  const placed = new Set<string>();
  return STEPS.map((s) => {
    const operationIds = rest
      .filter(
        (op) =>
          !placed.has(op.id) &&
          s.types.includes(op.type) &&
          (!s.ids || s.ids.includes(op.id)) &&
          (!s.parts || ('partId' in op && s.parts(op.partId))),
      )
      .map((op) => op.id);
    for (const id of operationIds) placed.add(id);
    return {
      id: s.id,
      title: s.title,
      operationIds,
      categories: [],
      ...(s.beforeCutting ? { beforeCutting: true as const } : {}),
    };
  }).filter((s) => s.operationIds.length > 0);
}
