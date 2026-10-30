import type { Part } from '../templates/types.ts';
import { angleToEdge, formatAngle } from '../units/angle.ts';
import { formatLength } from '../units/length.ts';
import { clipPolygon } from './clip.ts';
import { blankOutline, edgeLengths, partOutline, type UV } from './outline.ts';
import type { Drawing, PartRef, Point2, Primitive } from './primitives.ts';
import { boundsOf } from './primitives.ts';

// A part's cut detail (#90; docs/design/diagrams.html, Cut details): its face in its own plane,
// the long axis across the page, the first end on the left and the reference edge at the bottom.
// Overall length above, edge lengths below, each end's saw setting and angle to the edge with a
// square line and arc, the reference face mark, holes, and a taper's waste drawn dashed. A part
// more than 10 times longer than wide is drawn in pieces around its ends and holes, with break
// lines between; dimensions still give the full lengths.

const RAD = Math.PI / 180;
/** Gap left on the page where a stretch of a long part is broken out, in widths. */
const BREAK_GAP = 0.6;

interface Window {
  u0: number;
  u1: number;
  /** Where u0 lands on the page. */
  x: number;
}

/** The stretches of a long part to draw: around each end and each hole, merged where close. */
function windows(part: Part, outline: readonly UV[]): Window[] {
  const W = part.stock.width;
  const us = outline.map((p) => p.u);
  const min = Math.min(...us);
  const max = Math.max(...us);
  if (max - min <= 10 * W) return [{ u0: min, u1: max, x: min }];
  const t = Math.max(...part.ends.map((e) => Math.tan(e.setting * RAD)));
  const reach = W * t + 1.5 * W;
  const spans = [
    [min, min + reach],
    [max - reach, max],
    ...(part.holes ?? []).map((h) => [h.entry.u - W, h.entry.u + W]),
    ...(part.tapers ?? []).map((tp) => [min, Math.max(tp.start.u, tp.end.u) + W]),
  ]
    .map(([a, b]) => [Math.max(min, a as number), Math.min(max, b as number)] as const)
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [a, b] of spans) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1] + 2 * W) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  let x = min;
  return merged.map(([u0, u1], i) => {
    if (i > 0) x += BREAK_GAP * W;
    const w = { u0, u1, x };
    x += u1 - u0;
    return w;
  });
}

export function cutDetail(part: Part, title = `${part.letter} · ${part.name}`): Drawing {
  const W = part.stock.width;
  const ref: PartRef = { partId: part.id, instance: 0, letter: part.letter };
  const outline = partOutline(part);
  const blank = blankOutline(part);
  const ws = windows(part, blank);
  const broken = ws.length > 1;
  /** Page x for a u inside a window (or the nearest one). */
  const xOf = (u: number) => {
    const w = ws.find((w) => u >= w.u0 - 1e-9 && u <= w.u1 + 1e-9) ?? ws[0];
    return w ? w.x + (u - w.u0) : u;
  };
  const page = (p: UV): Point2 => ({ x: xOf(p.u), y: -p.v });
  const prims: Primitive[] = [];

  // The face, piece by piece.
  const lerp = (a: UV, b: UV, t: number): UV => ({
    u: a.u + (b.u - a.u) * t,
    v: a.v + (b.v - a.v) * t,
  });
  for (const w of ws) {
    const piece = clipPolygon(
      clipPolygon(outline, (p) => p.u - w.u0, lerp),
      (p) => w.u1 - p.u,
      lerp,
    );
    if (piece.length >= 3) {
      const shift = w.x - w.u0;
      prims.push({
        kind: 'polygon',
        role: 'visible',
        points: piece.map((p) => ({ x: p.u + shift, y: -p.v })),
        fill: 2,
        part: ref,
      });
    }
  }
  // Break lines: a zigzag across the part at each side of every gap.
  if (broken) {
    for (let i = 1; i < ws.length; i++) {
      const prev = ws[i - 1] as Window;
      const next = ws[i] as Window;
      for (const x of [prev.x + (prev.u1 - prev.u0), next.x]) {
        prims.push({
          kind: 'line',
          role: 'break',
          points: [
            { x, y: 0.15 * W },
            { x, y: -0.4 * W },
            { x: x - 0.12 * W, y: -0.5 * W },
            { x: x + 0.12 * W, y: -0.6 * W },
            { x, y: -0.7 * W },
            { x, y: -1.15 * W },
          ],
          part: ref,
        });
      }
    }
  }

  // A taper's waste, dashed.
  for (const taper of part.tapers ?? []) {
    const corner = blank[0] as UV;
    prims.push({
      kind: 'polygon',
      role: 'hidden',
      points: [taper.start, corner, taper.end].map(page),
      fill: 'none',
      part: ref,
    });
  }

  // Holes: through the face, a circle with center lines; in the face's plane, hidden lines along
  // the bore with its center line.
  for (const hole of part.holes ?? []) {
    const r = hole.diameter / 2;
    const c = page(hole.entry);
    if (Math.abs(hole.direction.n) > 0.5) {
      prims.push({ kind: 'circle', role: 'visible', center: c, radius: r, part: ref });
      prims.push({
        kind: 'line',
        role: 'center',
        points: [
          { x: c.x - 2 * r, y: c.y },
          { x: c.x + 2 * r, y: c.y },
        ],
        part: ref,
      });
      prims.push({
        kind: 'line',
        role: 'center',
        points: [
          { x: c.x, y: c.y - 2 * r },
          { x: c.x, y: c.y + 2 * r },
        ],
        part: ref,
      });
    } else {
      const d = { u: hole.direction.u, v: hole.direction.v };
      const side = { u: -d.v * r, v: d.u * r };
      const end = { u: hole.entry.u + d.u * hole.length, v: hole.entry.v + d.v * hole.length };
      for (const k of [1, -1]) {
        prims.push({
          kind: 'line',
          role: 'hidden',
          points: [
            page({ u: hole.entry.u + k * side.u, v: hole.entry.v + k * side.v }),
            page({ u: end.u + k * side.u, v: end.v + k * side.v }),
          ],
          part: ref,
        });
      }
      prims.push({
        kind: 'line',
        role: 'center',
        points: [page(hole.entry), page(end)],
        part: ref,
      });
    }
  }

  // Overall length above, long point to long point.
  const us = blank.map((p) => p.u);
  const left = Math.min(...us);
  const right = Math.max(...us);
  const above = -W - 0.8 * W;
  dimension(
    prims,
    ref,
    { x: xOf(left), y: -W },
    { x: xOf(right), y: -W },
    above,
    formatLength(part.length),
    'above',
  );
  if (broken) {
    prims.push({
      kind: 'text',
      role: 'note',
      at: { x: (xOf(left) + xOf(right)) / 2, y: above - 0.55 * W },
      text: 'Not to scale between the breaks',
      anchor: 'middle',
      part: ref,
    });
  }

  // Edge lengths: the reference edge below; the far edge just above, when it differs from the
  // overall length.
  const [a, b, c, d] = blank as [UV, UV, UV, UV];
  const edges = edgeLengths(part);
  dimension(prims, ref, page(a), page(b), 0.8 * W, formatLength(edges.reference), 'below');
  if (Math.abs(edges.far - part.length) > 1e-9 && Math.abs(edges.far - edges.reference) > 1e-9) {
    dimension(prims, ref, page(d), page(c), -W - 0.35 * W, formatLength(edges.far), 'above');
  }

  // Hole positions, from the first end's long point along the reference edge.
  const holes = part.holes ?? [];
  if (holes.length > 0) {
    const y = 1.6 * W;
    for (const hole of holes) {
      const x = xOf(hole.entry.u);
      prims.push({
        kind: 'line',
        role: 'extension',
        points: [
          { x, y: -hole.entry.v + 0.6 * hole.diameter },
          { x, y: y - 0.1 * W },
        ],
        part: ref,
      });
      prims.push({
        kind: 'text',
        role: 'dimension',
        at: { x, y },
        text: formatLength(hole.entry.u),
        anchor: 'end',
        rotate: -90,
        part: ref,
      });
    }
    // The hole size and the bolt size, labeled as each (#110): one note per pair, below the
    // positions.
    const sizes = [...new Set(holes.map((h) => `${h.diameter}\n${h.boltDiameter}`))];
    sizes.forEach((key, i) => {
      const [hole, bolt] = key.split('\n').map(Number) as [number, number];
      prims.push({
        kind: 'text',
        role: 'note',
        at: { x: xOf(left), y: y + (0.45 + 0.4 * i) * W },
        text: `Drill ${formatLength(hole)} holes for ${formatLength(bolt)} bolts`,
        anchor: 'start',
        part: ref,
      });
    });
  }

  // Each end's saw setting: a square line from the long point, the arc to the cut, the setting,
  // and the angle to the edge (DOMAIN.md, Units).
  const ends = [
    // First end: long point at (0, 0), the cut rising to (W·tan s, W).
    { at: a, square: 90, cut: 90 - part.ends[0].setting, setting: part.ends[0].setting },
    part.endsParallel
      ? // Parallel: the second end's long point is at the far edge, the cut falling toward u−.
        { at: c, square: 270, cut: 270 - part.ends[1].setting, setting: part.ends[1].setting }
      : { at: b, square: 90, cut: 90 + part.ends[1].setting, setting: part.ends[1].setting },
  ];
  for (const end of ends) {
    if (end.setting === 0) continue;
    const o = page(end.at);
    const r = 0.75 * W;
    const ray = (deg: number, len: number) => ({
      x: o.x + len * Math.cos(deg * RAD),
      y: o.y - len * Math.sin(deg * RAD),
    });
    prims.push({ kind: 'line', role: 'extension', points: [o, ray(end.square, W)], part: ref });
    prims.push({
      kind: 'arc',
      role: 'dimension',
      center: o,
      radius: r,
      start: Math.min(end.square, end.cut),
      end: Math.max(end.square, end.cut),
      part: ref,
    });
    // The setting and the angle to the edge, beside the end, outside the part.
    const first = end.at === a;
    const x = first ? xOf(left) - 0.35 * W : xOf(right) + 0.35 * W;
    const anchor = first ? ('end' as const) : ('start' as const);
    prims.push({
      kind: 'text',
      role: 'dimension',
      at: { x, y: -0.65 * W },
      text: `Saw at ${formatAngle(end.setting)}`,
      anchor,
      part: ref,
    });
    prims.push({
      kind: 'text',
      role: 'note',
      at: { x, y: -0.25 * W },
      text: `${formatAngle(angleToEdge(end.setting))} to the edge`,
      anchor,
      part: ref,
    });
  }

  // The reference face mark: a loop on the face, its tail to the reference edge, clear of holes
  // and tapers: the first of each piece's middle and quarter points that is at least a width
  // from both.
  const busy = [
    ...(part.holes ?? []).map((h) => h.entry.u),
    ...(part.tapers ?? []).flatMap((t) => [t.start.u, t.end.u, 0]),
  ];
  const candidates = ws.flatMap((w) => [0.5, 0.25, 0.75].map((f) => w.u0 + f * (w.u1 - w.u0)));
  const clear =
    candidates.find((u) => busy.every((b) => Math.abs(b - u) >= W)) ?? candidates[0] ?? 0;
  const mx = xOf(clear);
  const loop: Point2[] = Array.from({ length: 13 }, (_, i) => {
    const t = (i / 12) * 2 * Math.PI;
    return { x: mx + 0.12 * W * Math.sin(t), y: -0.55 * W - 0.18 * W * Math.cos(t) };
  });
  prims.push({ kind: 'line', role: 'leader', points: [...loop, { x: mx, y: 0 }], part: ref });

  const angles = [
    ...new Set(part.ends.filter((e) => e.setting !== 0).map((e) => formatAngle(e.setting))),
  ];
  return {
    title,
    description: `Cut detail for ${part.letter}, ${part.name}: ${formatLength(part.length)} overall${angles.length > 0 ? `, ends cut at ${angles.join(' and ')}` : ', ends square'}${(part.holes ?? []).length > 0 ? `, ${(part.holes ?? []).length} holes` : ''}.`,
    bounds: boundsOf(prims, 0.3 * W),
    primitives: prims,
    notes: [
      `The face shown is the reference face (the loop). Angles are measured from the ${part.referenceEdge ?? 'reference edge'}, at the bottom.`,
      ...(holes.length > 0
        ? [
            "Hole positions are measured from the first end's long point, on the left, along the reference edge.",
          ]
        : []),
    ],
  };
}

/** A dimension between two page points, its line at height `y`, its text above or below it. */
function dimension(
  prims: Primitive[],
  part: PartRef,
  from: Point2,
  to: Point2,
  y: number,
  text: string,
  side: 'above' | 'below',
) {
  const offset = side === 'above' ? -1 : 1;
  for (const p of [from, to]) {
    prims.push({
      kind: 'line',
      role: 'extension',
      points: [p, { x: p.x, y: y + offset * 0.15 }],
      part,
    });
  }
  prims.push({
    kind: 'line',
    role: 'dimension',
    points: [
      { x: from.x, y },
      { x: to.x, y },
    ],
    arrows: true,
    part,
  });
  prims.push({
    kind: 'text',
    role: 'dimension',
    at: { x: (from.x + to.x) / 2, y: y + offset * 0.3 },
    text,
    anchor: 'middle',
    part,
  });
}
