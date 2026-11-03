import { boundsOf, type Point2, type Primitive } from './primitives.ts';

// Part letters (D2) sit in columns beside a drawing, tied to their parts by leaders
// (docs/design/diagrams.html, Part letters). A column keeps to the sides and heights no dimension
// chain takes, so letters never cover a dimension's figure and leaders never cross a dimension
// line, and each letter takes the place in its column that keeps its leader from crossing another.

type Letter = Extract<Primitive, { kind: 'letter' }>;

/** Where a drawing has room for a column of letters: the sides free of dimensions, and the heights between them. */
export interface LetterRoom {
  sides: ('left' | 'right')[];
  top: number;
  bottom: number;
}

const DRAWN = new Set(['polygon', 'line', 'arc', 'circle']);
const NOT_THE_MODEL = new Set(['dimension', 'extension', 'leader']);

/**
 * The room a drawing leaves for letters: a side is taken when a dimension line runs along it, and
 * a column stays level with the drawn model on any side above or below it that is taken. When
 * both sides are taken, a column goes on either, outside the dimensions.
 */
export function letterRoom(primitives: readonly Primitive[]): LetterRoom {
  const model = boundsOf(
    primitives.filter((p) => DRAWN.has(p.kind) && !('role' in p && NOT_THE_MODEL.has(p.role))),
  );
  const lines = primitives.flatMap((p) =>
    p.kind === 'line' && p.role === 'dimension' ? [boundsOf([p])] : [],
  );
  const right = model.x + model.width;
  const bottom = model.y + model.height;
  const sides = (['left', 'right'] as const).filter((side) =>
    lines.every((l) => (side === 'left' ? l.x + l.width > model.x : l.x < right)),
  );
  return {
    sides: sides.length > 0 ? sides : ['left', 'right'],
    top: lines.some((l) => l.y + l.height <= model.y) ? model.y : -Infinity,
    bottom: lines.some((l) => l.y >= bottom) ? bottom : Infinity,
  };
}

/**
 * Letters in one column at `x`, `gap` apart: each as near its part's height as the letters above
 * it allow, the column then moved up by half of what it runs past the lowest part, and as far
 * as it must to keep within `room`, or centered on it when it is too tall; and then letters swapped
 * between places while any two leaders cross. Each swap shortens the leaders in total, so the
 * swaps end, and they end with no two crossing.
 */
export function letterColumn(
  letters: readonly Letter[],
  x: number,
  gap: number,
  room: Pick<LetterRoom, 'top' | 'bottom'>,
): Letter[] {
  const sorted = [...letters].sort((a, b) => a.target.y - b.target.y);
  let y = room.top - gap;
  const ys = sorted.map((l) => {
    y = Math.max(l.target.y, y + gap);
    return y;
  });
  const first = ys[0] ?? 0;
  const last = ys[ys.length - 1] ?? 0;
  const lowest = sorted[sorted.length - 1]?.target.y ?? last;
  const [up, down] = [room.top - first, room.bottom - last];
  const shift =
    up > down
      ? (room.top + room.bottom) / 2 - (first + last) / 2
      : Math.min(Math.max(-(last - lowest) / 2, up), down);
  const places = ys.map((y) => ({ x, y: y + shift }));
  const order = [...sorted];
  const leader = (i: number) => [places[i] as Point2, (order[i] as Letter).target] as const;
  for (let swapped = true, rounds = 0; swapped && rounds < order.length ** 2; rounds++) {
    swapped = false;
    for (let i = 0; i < order.length; i++) {
      for (let j = i + 1; j < order.length; j++) {
        if (!crosses(...leader(i), ...leader(j))) continue;
        [order[i], order[j]] = [order[j] as Letter, order[i] as Letter];
        swapped = true;
      }
    }
  }
  return order.map((l, i) => ({ ...l, at: places[i] as Point2 }));
}

const turn = (a: Point2, b: Point2, c: Point2) =>
  Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));

/** Whether two segments cross at a point inside both. */
export function crosses(a: Point2, b: Point2, c: Point2, d: Point2): boolean {
  return turn(a, b, c) * turn(a, b, d) < 0 && turn(c, d, a) * turn(c, d, b) < 0;
}
