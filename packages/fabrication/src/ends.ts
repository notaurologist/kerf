import { cutList, formatLength, geometry, type Part } from '@kerf/core';
import { faceHoles, markShapes, unmarkedNote } from './marks.ts';
import { printSheet } from './print.ts';
import { noteBlock, PAD, partSheet, type Shape, type Sheet } from './sheet.ts';

// Templates of a long part's shaped ends: each end drawn full size as far in as its shape
// reaches, plus a little more (the part's width, at most 3"), and broken off there. Every point comes from core's outline and the
// blank's corners; this file only chooses how much of the part to show.

/**
 * A part prints whole when it fits on this many pages and its end templates would cover at least
 * half its length anyway, and otherwise as end templates.
 */
export const WHOLE_PAGE_LIMIT = 6;

/** How far past its shape an end template runs, at most: enough to line it up on the board. */
export const RUN_ON = 3;
/** Radius of the long point's dot. */
const DOT = 0.05;

interface UV {
  u: number;
  v: number;
}

/**
 * How far in from an end its shape reaches, along the part, or 0 for a plain square end: from
 * the long point to the short point of an angled cut (the blank's corners, from core), a taper's
 * length, and a notch's, cutout's, or tenon shoulder's depth.
 */
export function shapedReach(part: Part, end: 0 | 1): number {
  const W = part.stock.width;
  const L = part.length;
  const { long, short } = endCorners(part, end);
  const reaches = [
    Math.abs(short.u - long.u),
    ...(end === 0
      ? part.tapers.filter((t) => !t.plane).map((t) => Math.max(t.start.u, t.end.u))
      : []),
    ...part.notches.filter((n) => n.end === end).map((n) => n.along),
    ...part.cutouts.filter((c) => c.end === end).map((c) => c.depth),
    ...part.tenons
      .filter((t) => t.end === end && (t.v0 > 1e-9 || W - t.v0 - t.width > 1e-9))
      .map((t) => t.length),
  ];
  const reach = Math.max(0, ...reaches);
  return reach > 1e-9 ? Math.min(reach, L) : 0;
}

/**
 * Sutherland–Hodgman against one line u = cut, keeping the side `keep` says. On an outline
 * that is not convex it can leave edges along the cut line; the drawing leaves those out.
 */
function clip(points: readonly UV[], cut: number, keep: 'below' | 'above'): UV[] {
  const side = (p: UV) => (keep === 'below' ? cut - p.u : p.u - cut);
  const out: UV[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i] as UV;
    const b = points[(i + 1) % points.length] as UV;
    const da = side(a);
    const db = side(b);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      out.push({ u: cut, v: a.v + (b.v - a.v) * t });
    }
  }
  return out;
}

/** The clipped outline as open runs, leaving out every edge that lies along the cut line. */
function runsOffCut(points: readonly UV[], cut: number): UV[][] {
  const onCut = (p: UV) => Math.abs(p.u - cut) < 1e-9;
  const n = points.length;
  const start = points.findIndex((p, i) => onCut(p) && !onCut(points[(i + 1) % n] as UV));
  if (start < 0) return [[...points, points[0] as UV]];
  const runs: UV[][] = [];
  let run: UV[] = [];
  for (let k = 0; k <= n; k++) {
    const a = points[(start + k) % n] as UV;
    const b = points[(start + k + 1) % n] as UV;
    if (run.length === 0) run.push(a);
    if (onCut(a) && onCut(b)) {
      if (run.length > 1) runs.push(run);
      run = [];
    } else if (k < n) run.push(b);
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

/** The blank's corners at an end: its long point and short point, and the square line's far end. */
function endCorners(part: Part, end: 0 | 1): { long: UV; short: UV; square: UV } {
  const [a, b, c, d] = geometry.blankOutline(part) as [UV, UV, UV, UV];
  if (end === 0) return { long: a, short: d, square: { u: a.u, v: d.v } };
  if (part.endsParallel) return { long: c, short: b, square: { u: c.u, v: b.v } };
  return { long: b, short: c, square: { u: b.u, v: c.v } };
}

/**
 * How much of the part an end template shows, along it, and the extent it is measured in: the
 * blank's and the outline's together, so a long point a taper cuts away is still on the sheet.
 */
function endSpan(part: Part, end: 0 | 1) {
  const outline = geometry.partOutline(part);
  const us = [...outline, ...geometry.blankOutline(part)].map((p) => p.u);
  const minU = Math.min(...us);
  const maxU = Math.max(...us);
  const W = part.stock.width;
  const runOn = Math.min(W, RUN_ON);
  let shown = shapedReach(part, end) + runOn;
  // Take in each face hole that starts within two widths of what is shown, nearest first, as the
  // cut detail merges its pieces, so a joint's bolts stay on one template.
  const fromEnd = faceHoles(part)
    .map((h) => ({ d: end === 0 ? h.at.u - minU : maxU - h.at.u, r: h.diameter / 2 }))
    .sort((a, b) => a.d - b.d);
  for (const h of fromEnd) {
    if (h.d - h.r > shown + 2 * W) break;
    shown = Math.max(shown, h.d + h.r + runOn);
  }
  return { outline, minU, maxU, shown: Math.min(shown, maxU - minU) };
}

/** The stretch of the part, in u, that an end template shows. */
export function endWindow(part: Part, end: 0 | 1): { u0: number; u1: number } {
  const { minU, maxU, shown } = endSpan(part, end);
  return end === 0 ? { u0: minU, u1: minU + shown } : { u0: maxU - shown, u1: maxU };
}

/** One shaped end, full size, broken off a little past where its shape reaches. */
export function endSheet(part: Part, end: 0 | 1): Sheet {
  if (shapedReach(part, end) === 0)
    throw new Error(`${part.id}'s ${end === 0 ? 'first' : 'second'} end is square`);
  const [row] = cutList([part]);
  if (!row) throw new Error(`No cut list row for ${part.id}`);
  const { outline, minU, maxU, shown } = endSpan(part, end);
  const cut = end === 0 ? minU + shown : maxU - shown;
  const whole = shown >= maxU - minU - 1e-9;
  const piece = whole ? outline : clip(outline, cut, end === 0 ? 'below' : 'above');
  const runs = whole ? [[...outline, outline[0] as UV]] : runsOffCut(piece, cut);

  const vs = outline.map((p) => p.v);
  const maxV = Math.max(...vs);
  const height = maxV - Math.min(...vs);
  const u0 = end === 0 ? minU : cut;
  const at = (p: UV) => ({ x: PAD + (p.u - u0), y: PAD + (maxV - p.v) });

  const shapes: Shape[] = runs.map((r) => ({ kind: 'outline', points: r.map(at), closed: whole }));
  if (!whole) {
    // A zigzag across the part where the template stops.
    const x = PAD + (cut - u0);
    const top = PAD - 0.15;
    const bottom = PAD + height + 0.15;
    const step = (bottom - top) / 6;
    shapes.push({
      kind: 'break',
      points: Array.from({ length: 7 }, (_, i) => ({
        x: x + (i % 2 === 0 ? 0 : i % 4 === 1 ? 0.1 : -0.1),
        y: top + i * step,
      })),
    });
  }
  const corners = endCorners(part, end);
  const angled = part.ends[end].setting !== 0;
  const taper = end === 0 ? part.tapers.find((t) => !t.plane) : undefined;
  if (taper) {
    const corner = geometry.blankOutline(part)[0] as UV;
    shapes.push({ kind: 'waste', points: [taper.start, corner, taper.end].map(at) });
  }
  if (angled) {
    shapes.push({ kind: 'square', points: [at(corners.long), at(corners.square)] });
    shapes.push({ kind: 'dot', at: at(corners.long), radius: DOT });
  }

  const { u0: from, u1: to } = endWindow(part, end);
  const marks = markShapes(part, at, from, to);
  shapes.push(...marks.shapes);

  const side = end === 0 ? 'Left' : 'Right';
  const longEdge = corners.long.v === 0 ? 'reference edge' : 'far edge';
  const shortEdge = corners.long.v === 0 ? 'far edge' : 'reference edge';
  const notes = [
    `${end === 0 ? 'First' : 'Second'} end, drawn on the ${side.toLowerCase()}. ${row.ends[end]}`,
    ...(angled
      ? [
          `Long point on the ${longEdge} (the dot)${taper ? `, on the board before the ${taper.description.toLowerCase()}` : ''}. The dashed line is square across from it; the cut meets the ${shortEdge} ${formatLength(Math.abs(corners.short.u - corners.square.u))} along from the dashed line.`,
        ]
      : []),
    `Bottom: the reference edge (${part.referenceEdge}). ${whole ? 'The whole part' : 'The part continues past the break'}: ${row.length} long, long point to long point.`,
    ...marks.notes,
    ...unmarkedNote(part),
  ];
  const notesTop = PAD + height + PAD;
  const block = noteBlock(notes, notesTop);
  shapes.push(...block.shapes);
  return {
    title: `${row.letter} · ${row.name} · ${side.toLowerCase()} end · ${row.stock} · make ${row.quantity}`,
    size: { width: Math.max(shown, block.width) + 2 * PAD, height: notesTop + block.height },
    shapes,
  };
}

/**
 * The templates for a part: the whole part when it fits on `WHOLE_PAGE_LIMIT` pages and its end
 * templates would show at least half its length, otherwise one per shaped end, and none for a
 * part with two plain square ends.
 */
export function partTemplates(part: Part): Sheet[] {
  const shaped = ([0, 1] as const).filter((end) => shapedReach(part, end) > 0);
  if (shaped.length === 0) return [];
  const whole = partSheet(part);
  const { minU, maxU } = endSpan(part, 0);
  const covered = shaped.reduce<number>((sum, end) => sum + endSpan(part, end).shown, 0);
  const fits = printSheet(whole).pages.length <= WHOLE_PAGE_LIMIT;
  if (fits && covered >= (maxU - minU) / 2) return [whole];
  return shaped.map((end) => endSheet(part, end));
}
