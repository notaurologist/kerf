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
  | { kind: 'outline'; points: Point[] }
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
 * A wide estimate of a character's width as a fraction of the text's height, for leaving room
 * for a note longer than the part. SVG cannot measure text before it is drawn.
 */
const CHAR_WIDTH = 0.6;

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
  const notesWidth = Math.max(...notes.map((n) => n.length)) * CHAR_WIDTH * NOTE_SIZE;
  const width = Math.max(outlineWidth, notesWidth) + 2 * PAD;
  const notesTop = PAD + outlineHeight + PAD;
  const height = notesTop + notes.length * NOTE_LINE;

  const shapes: Shape[] = [
    {
      kind: 'outline',
      points: outline.map((p) => ({ x: PAD + (p.u - minU), y: PAD + (maxV - p.v) })),
    },
    ...notes.map(
      (text, i): Shape => ({
        kind: 'text',
        at: { x: PAD, y: notesTop + (i + 1) * NOTE_LINE - (NOTE_LINE - NOTE_SIZE) },
        text,
        size: NOTE_SIZE,
      }),
    ),
  ];
  return {
    title: `${row.letter} · ${row.name} · ${row.stock} · make ${row.quantity}`,
    size: { width, height },
    shapes,
  };
}
