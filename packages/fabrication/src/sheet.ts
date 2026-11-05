import { cutList, formatLength, geometry, type Part } from '@kerf/core';
import type { Size } from './tile.ts';

// A part drawn full size, in inches, before it is laid out on pages: its face outline as core
// gives it, the first end on the left and the reference edge at the bottom as in its cut detail,
// with the end cuts and edge lengths written below it. y runs down the page, as in SVG.

interface Point {
  x: number;
  y: number;
}

export type Shape =
  /** The line to cut to: closed around a whole part, open where a template breaks off. */
  | { kind: 'outline'; points: Point[]; closed: boolean }
  /** A zigzag where a template stops short of the rest of the part. */
  | { kind: 'break'; points: Point[] }
  /** Wood a taper removes, between its line and the blank's corner, dashed. */
  | { kind: 'waste'; points: Point[] }
  /** A layout line square across the part from an end's long point, dashed. */
  | { kind: 'square'; points: [Point, Point] }
  | { kind: 'dot'; at: Point; radius: number }
  | { kind: 'text'; at: Point; text: string; size: number };

export interface Sheet {
  /** The part's letter, name, stock, and quantity, for each page's footer. */
  title: string;
  size: Size;
  shapes: Shape[];
}

/** Clear space around the outline, so the cut line never runs along a trim line or the margin. */
export const PAD = 0.25;
/** Height of the notes' text, and the distance between their lines. */
const NOTE_SIZE = 0.16;
export const NOTE_LINE = 0.24;
/**
 * A wide estimate of a character's width as a fraction of the text's height, for wrapping notes.
 * SVG cannot measure text before it is drawn.
 */
const CHAR_WIDTH = 0.6;
/** Notes under a drawing narrower than this wrap at this width instead, so they stay readable. */
const NOTE_MIN_WIDTH = 7;

/** Words wrapped into lines of at most `chars` characters; a longer word has a line to itself. */
function wrap(text: string, chars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + 1 + word.length > chars) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Notes under a drawing `drawingWidth` wide whose top is at `top`, wrapped to the drawing's width
 * or `NOTE_MIN_WIDTH`, whichever is wider. Returns the text and the block's width and height.
 */
export function noteBlock(
  notes: readonly string[],
  drawingWidth: number,
  top: number,
): { shapes: Shape[]; width: number; height: number } {
  const width = Math.max(drawingWidth, NOTE_MIN_WIDTH);
  const chars = Math.floor(width / (CHAR_WIDTH * NOTE_SIZE));
  const lines = notes.flatMap((note) => wrap(note, chars));
  const used = Math.max(...lines.map((l) => l.length)) * CHAR_WIDTH * NOTE_SIZE;
  return {
    shapes: lines.map((text, i) => ({
      kind: 'text',
      at: { x: PAD, y: top + i * NOTE_LINE + NOTE_SIZE },
      text,
      size: NOTE_SIZE,
    })),
    width: Math.min(width, used),
    height: lines.length * NOTE_LINE,
  };
}

/** The whole part, full size. */
export function partSheet(part: Part): Sheet {
  const [row] = cutList([part]);
  if (!row) throw new Error(`No cut list row for ${part.id}`);
  const outline = geometry.partOutline(part);
  const us = outline.map((p) => p.u);
  const vs = outline.map((p) => p.v);
  const minU = Math.min(...us);
  const maxV = Math.max(...vs);
  const outlineWidth = Math.max(...us) - minU;
  const outlineHeight = maxV - Math.min(...vs);

  const edges = geometry.edgeLengths(part);
  const notes = [
    `Left end: ${row.ends[0]}`,
    `Right end: ${row.ends[1]}`,
    `Bottom: the reference edge (${part.referenceEdge}), ${formatLength(edges.reference)}. Top: the far edge, ${formatLength(edges.far)}.`,
  ];
  const notesTop = PAD + outlineHeight + PAD;
  const block = noteBlock(notes, outlineWidth, notesTop);

  const shapes: Shape[] = [
    {
      kind: 'outline',
      closed: true,
      points: outline.map((p) => ({ x: PAD + (p.u - minU), y: PAD + (maxV - p.v) })),
    },
    ...block.shapes,
  ];
  return {
    title: `${row.letter} · ${row.name} · ${row.stock} · make ${row.quantity}`,
    size: {
      width: Math.max(outlineWidth, block.width) + 2 * PAD,
      height: notesTop + block.height,
    },
    shapes,
  };
}
