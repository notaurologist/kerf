import type { Point2 } from './primitives.ts';
import { cross, dot, scale, sub, unit, type Vec3 } from './vec.ts';

// True isometric projection (#90): the three template axes are foreshortened equally and drawn
// 120° apart. The viewer looks down at 35.26° from one of the four corners above the model,
// chosen by the template. z is up.
//
// Drawing coordinates are inches at the model's scale, x right and y down (primitives.ts). In
// true isometric every axis is foreshortened by √(2/3); nothing here rescales it.

export interface Isometric {
  /** Unit vector from the model toward the viewer. */
  toViewer: Vec3;
  /** Unit vectors of the page's right and up directions, in template coordinates. */
  right: Vec3;
  up: Vec3;
}

/**
 * The viewer above the corner where x has sign `sx` and y sign `sy`: for example (−1, −1) looks
 * from the front left.
 */
export function isometric(sx: 1 | -1, sy: 1 | -1): Isometric {
  const toViewer = unit({ x: sx, y: sy, z: 1 });
  const right = unit(cross({ x: 0, y: 0, z: 1 }, toViewer));
  const up = cross(toViewer, right);
  return { toViewer, right, up };
}

export function project(view: Isometric, p: Vec3): Point2 {
  return { x: dot(p, view.right), y: -dot(p, view.up) };
}

/** Distance toward the viewer: larger is nearer. */
export function depth(view: Isometric, p: Vec3): number {
  return dot(p, view.toViewer);
}

/**
 * Depth, at a point on the page, of the plane through `on` with normal `normal`. The point on
 * the page stands for the line of sight through it; the plane cuts that line at one depth.
 */
export function depthOnPlane(view: Isometric, page: Point2, on: Vec3, normal: Vec3): number {
  // The line of sight: page.x·right − page.y·up + t·toViewer, whose depth is t.
  const base = sub(scale(view.right, page.x), scale(view.up, page.y));
  return dot(normal, sub(on, base)) / dot(normal, view.toViewer);
}
