import { z } from 'zod';

// 2D drawing primitives (decision 0004; docs/design/diagrams.html, the drawing standard). Core
// produces them; each surface (screen, print) styles them. A primitive carries a role, never a
// color or width, and the part it belongs to, so a drawing links to the cut list.
//
// Drawing coordinates: inches at the drawing's scale, x to the right, y down (as SVG), so a
// renderer can use them directly as a viewBox.

/** ASME Y14.2 line types as the drawing standard uses them, plus grade and zone edges. */
export const LineRole = z.enum([
  'visible',
  'hidden',
  'center',
  'phantom',
  'dimension',
  'extension',
  'leader',
  'guideline',
  'break',
  'grade',
  'zone',
]);
export type LineRole = z.infer<typeof LineRole>;

export const TextRole = z.enum(['dimension', 'label', 'note']);
export type TextRole = z.infer<typeof TextRole>;

/** Face tones (D2): 1 for faces pointing up (lightest), 2 front and back, 3 ends (darkest). */
export const Tone = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Tone = z.infer<typeof Tone>;

export const Point2 = z.object({ x: z.number(), y: z.number() });
export type Point2 = z.infer<typeof Point2>;

/** The part a primitive belongs to (#39, Q3): which part, which instance, and its letter (#66). */
export const PartRef = z.object({
  partId: z.string(),
  instance: z.number().int().nonnegative(),
  letter: z.string(),
});
export type PartRef = z.infer<typeof PartRef>;

const part = { part: PartRef.optional() };

export const Primitive = z.discriminatedUnion('kind', [
  /** An open polyline. Dimension lines carry arrowheads at both ends. */
  z.object({
    kind: z.literal('line'),
    role: LineRole,
    points: z.array(Point2).min(2),
    arrows: z.boolean().optional(),
    ...part,
  }),
  /**
   * A closed outline, filled with a face tone or a zone, or unfilled. `outline: false` fills it
   * without stroking: a piece of a face whose real edges follow as separate lines.
   */
  z.object({
    kind: z.literal('polygon'),
    role: LineRole,
    points: z.array(Point2).min(3),
    fill: z.union([Tone, z.literal('zone'), z.literal('none')]),
    outline: z.boolean().optional(),
    ...part,
  }),
  /** An arc from `start` to `end` degrees, counterclockwise on the page (y down). */
  z.object({
    kind: z.literal('arc'),
    role: LineRole,
    center: Point2,
    radius: z.number().positive(),
    start: z.number(),
    end: z.number(),
    ...part,
  }),
  z.object({
    kind: z.literal('circle'),
    role: LineRole,
    center: Point2,
    radius: z.number().positive(),
    ...part,
  }),
  /** Text from core's formatters. `rotate` in degrees, for text written along a line. */
  z.object({
    kind: z.literal('text'),
    role: TextRole,
    at: Point2,
    text: z.string(),
    anchor: z.enum(['start', 'middle', 'end']),
    rotate: z.number().optional(),
    ...part,
  }),
  /** A part letter in its rounded square, tied to `target` on the part by a leader. */
  z.object({
    kind: z.literal('letter'),
    at: Point2,
    target: Point2,
    letter: z.string(),
    part: PartRef,
  }),
]);
export type Primitive = z.infer<typeof Primitive>;

export const Drawing = z.object({
  /** Such as "Isometric view". */
  title: z.string(),
  /**
   * What the drawing shows, in a sentence, for assistive technology (W3C, complex images). The
   * template words it for its own views; a display may add the part letters or dimensions.
   */
  description: z.string(),
  /** Bounds of every primitive, for a viewBox. */
  bounds: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  primitives: z.array(Primitive),
  /** Shown under the drawing, such as the clearance sources. */
  notes: z.array(z.string()),
});
export type Drawing = z.infer<typeof Drawing>;

/** The bounds of a set of primitives, with a margin. */
export function boundsOf(primitives: readonly Primitive[], margin = 0): Drawing['bounds'] {
  const points = primitives.flatMap(pointsOf);
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs) - margin;
  const y = Math.min(...ys) - margin;
  return { x, y, width: Math.max(...xs) + margin - x, height: Math.max(...ys) + margin - y };
}

/** The points that bound a primitive. Text is counted at its anchor point. */
function pointsOf(p: Primitive): Point2[] {
  if (p.kind === 'line' || p.kind === 'polygon') return p.points;
  if (p.kind === 'arc' || p.kind === 'circle') {
    return [
      { x: p.center.x - p.radius, y: p.center.y - p.radius },
      { x: p.center.x + p.radius, y: p.center.y + p.radius },
    ];
  }
  if (p.kind === 'text') return [p.at];
  return [p.at, p.target];
}
