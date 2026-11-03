import type { CutListRow } from '../outputs/cutList.ts';
import type { LumberPlan } from '../outputs/shoppingList.ts';
import { formatLength } from '../units/length.ts';
import type { Drawing, PartRef, Primitive } from './primitives.ts';
import { boundsOf } from './primitives.ts';

// Board cards (#59; wireframes S-B): each board to buy, drawn with the pieces it becomes, in the
// order they come off it. The length is to scale; the width is not, since a 12' board is forty
// times longer than it is wide. The trimmed ends and the offcut are waste, drawn as zones. An
// angled end is drawn at its saw setting on the page, its first end on the left and its long
// points where the cut detail has them, so the ends read as parallel or mirrored (#455).

/**
 * The board's drawn width: not to scale. About a fourteenth of a 12' board, so the strip reads
 * as a board on a phone and has room for a part letter.
 */
const WIDTH = 10;
/** Below the board: the pieces' dimension line, then its text. */
const DIM_GAP = 3;
const TEXT_GAP = 7.5;
/** Above the board's far end: the offcut's label, clear of the pieces' dimensions. */
const NOTE_GAP = 3;

/** A part's two end settings, in degrees from square, in end order. */
export type EndSettings = ReadonlyMap<string, readonly [number, number]>;

/** Under each board's drawing; a screen that lists several boards can say it once instead. */
export const BOARD_SCALE_NOTE = 'To scale along the length, not across the width.';

/** One drawing per board in the plan's order, its pieces lettered as in the cut list. */
export function boardDrawings(
  lumber: Pick<LumberPlan, 'boards' | 'kerf' | 'trimPerEnd'>,
  rows: readonly Pick<CutListRow, 'partId' | 'letter' | 'name' | 'endsParallel'>[],
  settings: EndSettings = new Map(),
): Drawing[] {
  const letterOf = new Map(rows.map((r) => [r.partId, r.letter]));
  const parallel = new Map(rows.map((r) => [r.partId, r.endsParallel]));
  const counted = new Map<string, number>();
  return lumber.boards.map((board, b) => {
    const length = board.feet * 12;
    const prims: Primitive[] = [];
    const rect = (x0: number, x1: number) => [
      { x: x0, y: 0 },
      { x: x1, y: 0 },
      { x: x1, y: WIDTH },
      { x: x0, y: WIDTH },
    ];
    const waste = (x0: number, x1: number) => {
      if (x1 > x0)
        prims.push({ kind: 'polygon', role: 'zone', fill: 'zone', points: rect(x0, x1) });
    };

    // Factory ends trimmed off, then each piece and the saw cut after it.
    waste(0, lumber.trimPerEnd);
    waste(length - lumber.trimPerEnd, length);
    let x = lumber.trimPerEnd;
    for (const piece of board.pieces) {
      const instance = counted.get(piece.partId) ?? 0;
      counted.set(piece.partId, instance + 1);
      const part: PartRef = {
        partId: piece.partId,
        instance,
        letter: letterOf.get(piece.partId) ?? '',
      };
      const x1 = x + piece.length;
      const middle = (x + x1) / 2;
      const outline = pieceOutline(
        x,
        x1,
        settings.get(piece.partId) ?? [0, 0],
        parallel.get(piece.partId) ?? true,
      );
      // The wood an angled end leaves, beside the piece.
      for (const corner of outline.waste) {
        prims.push({ kind: 'polygon', role: 'zone', fill: 'zone', points: corner });
      }
      prims.push(
        { kind: 'polygon', role: 'visible', fill: 1, points: outline.piece, part },
        {
          kind: 'letter',
          at: { x: middle, y: WIDTH / 2 },
          target: { x: middle, y: WIDTH / 2 },
          letter: part.letter,
          part,
        },
        {
          kind: 'line',
          role: 'dimension',
          points: [
            { x, y: WIDTH + DIM_GAP },
            { x: x1, y: WIDTH + DIM_GAP },
          ],
          arrows: true,
          part,
        },
        {
          kind: 'text',
          role: 'dimension',
          at: { x: middle, y: WIDTH + TEXT_GAP },
          text: formatLength(piece.length),
          anchor: 'middle',
          part,
        },
      );
      x = x1 + lumber.kerf;
    }
    // What is left after the last saw cut, up to the trimmed end.
    const offcutEnd = length - lumber.trimPerEnd;
    waste(x, offcutEnd);
    if (board.offcut > 0) {
      prims.push({
        kind: 'text',
        role: 'note',
        at: { x: length, y: -NOTE_GAP },
        text: `Offcut ${formatLength(board.offcut)}`,
        anchor: 'end',
      });
    }
    prims.push({ kind: 'polygon', role: 'visible', fill: 'none', points: rect(0, length) });

    const feet = formatLength(length, 'feet-inches');
    const pieces = board.pieces
      .map((p) => `${letterOf.get(p.partId) ?? ''} ${formatLength(p.length)}`.trim())
      .join(', ');
    return {
      title: `Board ${b + 1}: ${board.nominal}, ${feet}`,
      description: `A ${board.nominal} board ${feet} long, cut into ${pieces}, leaving an offcut of ${formatLength(board.offcut)} after trimming ${formatLength(lumber.trimPerEnd)} off each end.`,
      bounds: boundsOf(prims, 2),
      primitives: prims,
      notes: [BOARD_SCALE_NOTE],
    };
  });
}

/**
 * A piece between x0 and x1 with its ends at their settings on the page. The reference edge is at
 * the bottom (y = WIDTH). The first end's long point is on it; the second end's is on it too when
 * the ends mirror each other, and on the far edge when they are parallel, as in the cut detail.
 * Two steep ends on a short piece are drawn less steep, so they never cross.
 */
function pieceOutline(
  x0: number,
  x1: number,
  [first, second]: readonly [number, number],
  parallel: boolean,
) {
  const run = (setting: number) => WIDTH * Math.tan((setting * Math.PI) / 180);
  const fit = Math.min(1, (0.8 * (x1 - x0)) / Math.max(1e-9, run(first) + run(second)));
  const d0 = run(first) * fit;
  const d1 = run(second) * fit;
  const top = { x0: x0 + d0, x1: parallel ? x1 : x1 - d1 };
  const bottom = { x0, x1: parallel ? x1 - d1 : x1 };
  const piece = [
    { x: top.x0, y: 0 },
    { x: top.x1, y: 0 },
    { x: bottom.x1, y: WIDTH },
    { x: bottom.x0, y: WIDTH },
  ];
  const triangle = (a: number, b: number, c: number, y: number) => [
    { x: a, y },
    { x: b, y },
    { x: c, y: WIDTH - y },
  ];
  const waste = [
    ...(d0 > 0 ? [triangle(x0, top.x0, x0, 0)] : []),
    ...(d1 > 0
      ? parallel
        ? [triangle(bottom.x1, x1, x1, WIDTH)]
        : [triangle(top.x1, x1, x1, 0)]
      : []),
  ];
  return { piece, waste };
}
