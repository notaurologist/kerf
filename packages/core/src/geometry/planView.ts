import { formatLength } from '../units/length.ts';
import type { Drawing, Point2, Primitive } from './primitives.ts';
import { boundsOf } from './primitives.ts';

// A site plan (#90; docs/design/diagrams.html, Site layout): plan view, x across the page, the
// front (negative y) at the bottom. Distances over 6 feet in feet and inches. Areas to keep clear
// are zones (tinted on screen, hatched on paper), each with its source under the drawing.

export interface PlanArea {
  label: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** A zone to keep clear, or an outline such as the frame's footprint. */
  kind: 'zone' | 'outline';
  source?: string;
  /** Dimension its width and depth. */
  dimensioned?: boolean;
}

/** Template-space lines to add, such as the beam (visible) or seats (phantom). */
export interface PlanLine {
  role: 'visible' | 'phantom';
  points: { x: number; y: number }[];
}

const SIX_FEET = 72;

const distance = (inches: number) =>
  formatLength(inches, inches > SIX_FEET ? 'feet-inches' : 'inches');

export function planView(
  areas: readonly PlanArea[],
  lines: readonly PlanLine[],
  title = 'Site layout',
): Drawing {
  const page = (x: number, y: number): Point2 => ({ x, y: -y });
  const prims: Primitive[] = [];
  // Zones first, so outlines and labels sit on top.
  const ordered = [...areas].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'zone' ? -1 : 1));
  for (const a of ordered) {
    prims.push({
      kind: 'polygon',
      role: a.kind === 'zone' ? 'zone' : 'visible',
      fill: a.kind === 'zone' ? 'zone' : 'none',
      points: [
        page(a.xMin, a.yMin),
        page(a.xMax, a.yMin),
        page(a.xMax, a.yMax),
        page(a.xMin, a.yMax),
      ],
    });
  }
  for (const l of lines) {
    prims.push({ kind: 'line', role: l.role, points: l.points.map((p) => page(p.x, p.y)) });
  }
  // Labels at each area's top left, inside it.
  const span = Math.max(...areas.map((a) => a.xMax - a.xMin), 1);
  const inset = span * 0.015;
  // An area much taller than wide, such as a swing zone, is labeled along its length, reading
  // upward from its bottom, so neighbors' labels do not run into each other.
  for (const a of areas) {
    const tall = a.yMax - a.yMin > 4 * (a.xMax - a.xMin);
    prims.push(
      tall
        ? {
            kind: 'text',
            role: 'label',
            at: { x: (a.xMin + a.xMax) / 2, y: -a.yMin - 3 * inset },
            text: a.label,
            anchor: 'start',
            rotate: -90,
          }
        : {
            kind: 'text',
            role: 'label',
            at: { x: a.xMin + inset, y: -a.yMax + 3 * inset },
            text: a.label,
            anchor: 'start',
          },
    );
  }
  // Width below and depth to the right of each dimensioned area, stepping outward.
  let below = Math.max(...areas.map((a) => -a.yMin));
  let right = Math.max(...areas.map((a) => a.xMax));
  for (const a of areas.filter((x) => x.dimensioned)) {
    below += 6 * inset;
    right += 6 * inset;
    for (const x of [a.xMin, a.xMax]) {
      prims.push({
        kind: 'line',
        role: 'extension',
        points: [
          { x, y: -a.yMin + inset },
          { x, y: below + inset },
        ],
      });
    }
    prims.push({
      kind: 'line',
      role: 'dimension',
      points: [
        { x: a.xMin, y: below },
        { x: a.xMax, y: below },
      ],
      arrows: true,
    });
    prims.push({
      kind: 'text',
      role: 'dimension',
      at: { x: (a.xMin + a.xMax) / 2, y: below + 2.5 * inset },
      text: distance(a.xMax - a.xMin),
      anchor: 'middle',
    });
    for (const y of [a.yMin, a.yMax]) {
      prims.push({
        kind: 'line',
        role: 'extension',
        points: [
          { x: a.xMax + inset, y: -y },
          { x: right + inset, y: -y },
        ],
      });
    }
    prims.push({
      kind: 'line',
      role: 'dimension',
      points: [
        { x: right, y: -a.yMax },
        { x: right, y: -a.yMin },
      ],
      arrows: true,
    });
    prims.push({
      kind: 'text',
      role: 'dimension',
      at: { x: right + 1.5 * inset, y: -(a.yMin + a.yMax) / 2 },
      text: distance(a.yMax - a.yMin),
      anchor: 'middle',
      rotate: -90,
    });
  }
  const box = boundsOf(prims, 4 * inset);
  // The front, at the bottom.
  prims.push({
    kind: 'text',
    role: 'note',
    at: { x: box.x + box.width / 2, y: box.y + box.height },
    text: 'Front',
    anchor: 'middle',
  });
  const sources = [
    ...new Set(areas.flatMap((a) => (a.source ? [`${a.label}: ${a.source}.`] : []))),
  ];
  return { title, bounds: boundsOf(prims, 6 * inset), primitives: prims, notes: sources };
}
