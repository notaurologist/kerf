export { BOARD_SCALE_NOTE, boardDrawings } from './boards.ts';
export { cutDetail } from './cutDetail.ts';
export { crosses, type LetterRoom, letterColumn, letterRoom } from './letters.ts';
export { blankOutline, edgeLengths, partOutline } from './outline.ts';
export { type PlanArea, type PlanLine, planView } from './planView.ts';
export {
  boundsOf,
  Drawing,
  LineRole,
  PartRef,
  Point2,
  Primitive,
  Stage,
  TextRole,
  Tone,
} from './primitives.ts';
export {
  CORNERS,
  type Corner,
  depth,
  depthOnPlane,
  fromCorner,
  type Isometric,
  isometric,
  orthographic,
  project,
} from './projection.ts';
export {
  type Action,
  actionView,
  type DimensionChain,
  type Explode,
  elevationView,
  explodedView,
  isometricView,
  type Scene,
  type SectionPlane,
  sectionCuts,
  sectionView,
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
   * Elevations and sections (#302), in the order to show them: views straight at one side, some
   * cut by a plane. Left out by a template that draws none.
   */
  elevations: z.array(Drawing).optional(),
  /**
   * Each board to buy with the pieces it becomes (#59), from the board plan by `boardDrawings`.
   * Generic, so the API adds them to every template's drawings.
   */
  boards: z.array(Drawing).optional(),
});
export type Drawings = z.infer<typeof Drawings>;
