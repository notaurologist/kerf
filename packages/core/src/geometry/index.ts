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
  type SubAssembly,
  sectionCuts,
  sectionView,
  subAssemblyViews,
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

/**
 * A sub-assembly as the plan's drawings list it (#647): which group, its title, how many alike,
 * and the build step that puts it together. Its drawings come in a request of their own.
 */
export const SubAssemblySummary = z.object({
  id: z.string(),
  title: z.string(),
  alike: z.number().int().positive(),
  stepId: z.string().optional(),
});
export type SubAssemblySummary = z.infer<typeof SubAssemblySummary>;

/** One sub-assembly's assembled and exploded views. */
export const SubAssemblyDrawings = z.object({ isometric: Drawing, exploded: Drawing });
export type SubAssemblyDrawings = z.infer<typeof SubAssemblyDrawings>;
