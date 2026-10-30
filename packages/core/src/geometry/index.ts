export { boardDrawings } from './boards.ts';
export { cutDetail } from './cutDetail.ts';
export { blankOutline, edgeLengths, partOutline } from './outline.ts';
export { type PlanArea, type PlanLine, planView } from './planView.ts';
export {
  boundsOf,
  Drawing,
  LineRole,
  PartRef,
  Point2,
  Primitive,
  TextRole,
  Tone,
} from './primitives.ts';
export { depth, depthOnPlane, type Isometric, isometric, project } from './projection.ts';
export {
  type Action,
  actionView,
  type Explode,
  explodedView,
  isometricView,
  type Scene,
} from './views.ts';

import { z } from 'zod';
import { Drawing } from './primitives.ts';

/** Every drawing in a plan (#90). The 3D views need placements, which plans before them lack. */
export const Drawings = z.object({
  isometric: Drawing.nullable(),
  exploded: Drawing.nullable(),
  cutDetails: z.array(Drawing),
  siteLayout: Drawing.nullable(),
  /**
   * Each board to buy with the pieces it becomes (#59), from the board plan by `boardDrawings`.
   * Generic, so the API adds them to every template's drawings.
   */
  boards: z.array(Drawing).optional(),
  /**
   * An action drawing for each assembly step, by step ID (#118), from `stepDrawings`. Generic, so
   * the API adds them like the boards.
   */
  steps: z.array(z.object({ stepId: z.string(), drawing: Drawing })).optional(),
});
export type Drawings = z.infer<typeof Drawings>;
