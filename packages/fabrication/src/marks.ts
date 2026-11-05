import { formatLength, type Part } from '@kerf/core';
import type { Shape } from './sheet.ts';

// What a template transfers to the board besides its outline, on the face the drawings show
// (the far face, n = the stock's thickness, as in the cut details): each hole that runs square
// through a face, at its center, and the outline of each dado and mortise in a face. Positions
// are core's, in the part's frame; this file only places and labels them.

interface UV {
  u: number;
  v: number;
}

/** A hole square to the faces: its center on the face shown, and where the bit goes in. */
export interface FaceHole {
  at: UV;
  diameter: number;
  /** What it is for: a bolt's hardware or a bored hole's use. */
  use: string;
  /** Whether the bit enters on the face shown or the other face. */
  from: 'shown' | 'other';
  /** Whether it comes out on the face shown, so the circle there is solid. */
  showsHere: boolean;
}

/** A rectangle in a face: a dado or a mortise, solid on the face shown and dashed on the other. */
export interface FaceRect {
  kind: 'dado' | 'mortise';
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  depth: number;
  onShown: boolean;
}

const squareToFaces = (d: { u: number; v: number; n: number }) =>
  Math.abs(d.u) < 1e-9 && Math.abs(d.v) < 1e-9 && Math.abs(Math.abs(d.n) - 1) < 1e-9;

/** Every hole and bored hole square to the faces. */
export function faceHoles(part: Part): FaceHole[] {
  const T = part.stock.thickness;
  const fromShown = (n: number) => Math.abs(n - T) < 1e-9;
  return [
    ...part.holes
      .filter((h) => squareToFaces(h.direction))
      .map((h) => ({
        at: { u: h.entry.u, v: h.entry.v },
        diameter: h.diameter,
        use: `for a ${formatLength(h.boltDiameter)} bolt`,
        from: fromShown(h.entry.n) ? ('shown' as const) : ('other' as const),
        showsHere: true,
      })),
    ...part.boredHoles
      .filter((h) => squareToFaces(h.direction))
      .map((h) => {
        const from = fromShown(h.entry.n) ? ('shown' as const) : ('other' as const);
        return {
          at: { u: h.entry.u, v: h.entry.v },
          diameter: h.diameter,
          use: h.use,
          from,
          showsHere: h.through || from === 'shown',
        };
      }),
  ];
}

/** How many holes and bored holes go into an edge or end, which a face template cannot mark. */
function otherHoleCount(part: Part): number {
  return (
    part.holes.filter((h) => !squareToFaces(h.direction)).length +
    part.boredHoles.filter((h) => !squareToFaces(h.direction)).length
  );
}

/** Dadoes and face mortises. Mortises in an edge are counted by `unmarkedNote`. */
export function faceRects(part: Part): FaceRect[] {
  return [
    ...part.dadoes.map((d) => ({
      kind: 'dado' as const,
      u0: d.u0,
      u1: d.u1,
      v0: d.v0,
      v1: d.v1,
      depth: d.depth,
      onShown: d.face === 'far',
    })),
    ...part.mortises
      .filter((m) => m.side === 'near' || m.side === 'far')
      .map((m) => ({
        kind: 'mortise' as const,
        u0: m.u0,
        u1: m.u1,
        v0: m.a0,
        v1: m.a1,
        depth: m.depth,
        onShown: m.side === 'far',
      })),
  ];
}

function edgeMortiseCount(part: Part): number {
  return part.mortises.filter((m) => m.side !== 'near' && m.side !== 'far').length;
}

/** Half the length of a hole's cross past its circle, so the center can be pricked through. */
const CROSS_PAST = 0.1;
const LABEL_SIZE = 0.13;

/**
 * The marks between `uMin` and `uMax` along the part, drawn by `at`: each hole labeled with its
 * diameter, each dado and mortise numbered, and notes for them. Holes alike share one note.
 */
export function markShapes(
  part: Part,
  at: (p: UV) => { x: number; y: number },
  uMin: number,
  uMax: number,
): { shapes: Shape[]; notes: string[] } {
  const shapes: Shape[] = [];
  const inside = (u: number) => u >= uMin - 1e-9 && u <= uMax + 1e-9;
  const groups = new Map<string, number>();
  for (const hole of faceHoles(part).filter((h) => inside(h.at.u))) {
    const c = at(hole.at);
    const r = hole.diameter / 2;
    const size = formatLength(hole.diameter);
    shapes.push({ kind: 'circle', at: c, radius: r, dashed: !hole.showsHere });
    shapes.push({ kind: 'cross', at: c, arm: r + CROSS_PAST });
    shapes.push({
      kind: 'text',
      at: { x: c.x + r + 0.06, y: c.y - r - 0.04 },
      text: size,
      size: LABEL_SIZE,
    });
    const from = hole.from === 'shown' ? 'from this face' : 'from the other face';
    const stops = hole.showsHere ? '' : ', stopping short of this face (dashed)';
    const key = `${size} ${hole.use}, drilled ${from}${stops}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const notes = [...groups].map(
    ([key, count]) =>
      `${count === 1 ? 'Hole' : `${count} holes`}, ${key}; prick the ${count === 1 ? 'center' : 'centers'}.`,
  );
  let label = 0;
  for (const rect of faceRects(part)) {
    const u0 = Math.max(rect.u0, uMin);
    const u1 = Math.min(rect.u1, uMax);
    if (u1 - u0 < 1e-9) continue;
    label++;
    const corners = [
      { u: u0, v: rect.v0 },
      { u: u1, v: rect.v0 },
      { u: u1, v: rect.v1 },
      { u: u0, v: rect.v1 },
    ].map(at);
    shapes.push({ kind: 'rect', points: corners, dashed: !rect.onShown });
    const corner = corners.reduce((a, b) => (b.y < a.y || (b.y === a.y && b.x < a.x) ? b : a));
    shapes.push({
      kind: 'text',
      at: { x: corner.x + 0.05, y: corner.y - 0.05 },
      text: `${rect.kind === 'dado' ? 'D' : 'M'}${label}`,
      size: LABEL_SIZE,
    });
    const size =
      rect.kind === 'dado'
        ? `${formatLength(Math.min(rect.u1 - rect.u0, rect.v1 - rect.v0))} wide`
        : `${formatLength(rect.u1 - rect.u0)} by ${formatLength(rect.v1 - rect.v0)}`;
    notes.push(
      `${rect.kind === 'dado' ? 'D' : 'M'}${label}: ${rect.kind}, ${size}, ${formatLength(rect.depth)} deep, ${rect.onShown ? 'in this face' : 'in the other face (dashed)'}.`,
    );
  }
  return { shapes, notes };
}

/** A note for what a face template cannot show, or none. */
export function unmarkedNote(part: Part): string[] {
  const holes = otherHoleCount(part);
  const mortises = edgeMortiseCount(part);
  const items = [
    ...(holes ? [`${holes} ${holes === 1 ? 'hole' : 'holes'}`] : []),
    ...(mortises ? [`${mortises} ${mortises === 1 ? 'mortise' : 'mortises'}`] : []),
  ];
  if (items.length === 0) return [];
  return [`Not marked here: ${items.join(' and ')} in an edge or end; see the cut detail.`];
}
