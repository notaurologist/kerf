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
export { type Explode, explodedView, isometricView, type Scene } from './views.ts';

import { z } from 'zod';
import { Drawing } from './primitives.ts';

/** Every drawing in a plan (#90). The 3D views need placements, which plans before them lack. */
export const Drawings = z.object({
  isometric: Drawing.nullable(),
  exploded: Drawing.nullable(),
  cutDetails: z.array(Drawing),
  siteLayout: Drawing.nullable(),
});
export type Drawings = z.infer<typeof Drawings>;
