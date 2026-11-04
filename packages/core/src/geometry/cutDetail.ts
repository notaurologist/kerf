import { cornerGeometry, type DovetailSide, dovetailSpan } from '../joinery/dovetails.ts';
import { boredSide } from '../model/operations.ts';
import { type BoredHole, type Part, widthTapers } from '../model/types.ts';
import { endName } from '../outputs/cutList.ts';
import { angleToEdge, formatAngle } from '../units/angle.ts';
import { formatLength } from '../units/length.ts';
import { clipPolygon } from './clip.ts';
import { blankOutline, edgeLengths, partOutline, type UV } from './outline.ts';
import type { Drawing, PartRef, Point2, Primitive } from './primitives.ts';
import { boundsOf } from './primitives.ts';

// A part's cut detail (#90; docs/design/diagrams.html, Cut details): its face in its own plane,
// the long axis across the page, the first end on the left and the reference edge at the bottom.
// Overall length above, edge lengths below, each end's saw setting and angle to the edge with a
// square line and arc, the reference face mark, the grain arrow, holes and bored holes, dadoes
// (solid on the face shown, dashed on the other), notches and cutouts in the outline, a taper's
// waste drawn dashed, and dovetails' waste hatched. A part more than 10 times longer than wide
// is drawn in pieces around its ends and holes, with break lines between; dimensions still give
// the full lengths.

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
    ...part.holes.map((h) => [h.entry.u - W, h.entry.u + W]),
    ...part.boredHoles.map((h) => [h.entry.u - W, h.entry.u + W]),
    ...part.hingePlates.flatMap((p) => p.screws.map((s) => [s.u - W, s.u + W])),
    ...part.tapers.map((tp) => [min, Math.max(tp.start.u, tp.end.u) + W]),
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
  const names = part.ends.map((e) => endName(e.description));
  /** "the top, on the left", or "the first end, on the left" for an end the template does not name. */
  const whichEnd = (end: 0 | 1) => {
    const name = names[end]?.toLowerCase() ?? (end === 0 ? 'first end' : 'second end');
    return `the ${name}, on the ${end === 0 ? 'left' : 'right'}`;
  };
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

  // A taper's waste, dashed. One that takes off thickness is on the back face, so it is noted.
  for (const taper of widthTapers(part.tapers)) {
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
  for (const hole of part.holes) {
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

  // Bored holes: into a face, a circle with center lines, solid when it shows on the face shown
  // (bored from it, or through) and dashed when stopped in the back face; into an edge or end,
  // hidden lines along the bore as deep as it goes.
  const T = part.stock.thickness;
  for (const hole of part.boredHoles) {
    const r = hole.diameter / 2;
    const c = page(hole.entry);
    if (boredSide(hole) === 'n') {
      const shows = hole.through || hole.entry.n > T / 2;
      prims.push({
        kind: 'circle',
        role: shows ? 'visible' : 'hidden',
        center: c,
        radius: r,
        part: ref,
      });
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ] as const) {
        prims.push({
          kind: 'line',
          role: 'center',
          points: [
            { x: c.x - 1.4 * r * dx, y: c.y - 1.4 * r * dy },
            { x: c.x + 1.4 * r * dx, y: c.y + 1.4 * r * dy },
          ],
          part: ref,
        });
      }
    } else {
      const d = { u: hole.direction.u, v: hole.direction.v };
      const k = Math.hypot(d.u, d.v);
      const side = { u: (-d.v / k) * r, v: (d.u / k) * r };
      const end = { u: hole.entry.u + d.u * hole.depth, v: hole.entry.v + d.v * hole.depth };
      for (const s of [1, -1]) {
        prims.push({
          kind: 'line',
          role: 'hidden',
          points: [
            page({ u: hole.entry.u + s * side.u, v: hole.entry.v + s * side.v }),
            page({ u: end.u + s * side.u, v: end.v + s * side.v }),
          ],
          part: ref,
        });
      }
      if (!hole.through) {
        prims.push({
          kind: 'line',
          role: 'hidden',
          points: [
            page({ u: end.u + side.u, v: end.v + side.v }),
            page({ u: end.u - side.u, v: end.v - side.v }),
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

  // Dadoes: their outline on the face, solid on the face shown (far, n = thickness) and dashed
  // on the other, with each one's position from the first end below the part.
  for (const d of part.dadoes) {
    prims.push({
      kind: 'polygon',
      role: d.face === 'far' ? 'visible' : 'hidden',
      points: [
        { u: d.u0, v: d.v0 },
        { u: d.u1, v: d.v0 },
        { u: d.u1, v: d.v1 },
        { u: d.u0, v: d.v1 },
      ].map(page),
      fill: 'none',
      part: ref,
    });
  }

  // Mortises: on the face shown, solid; on the other face, dashed; in an edge, dashed from that
  // edge as deep as the mortise.
  for (const m of part.mortises) {
    const [v0, v1] =
      m.side === 'reference-edge'
        ? [0, m.depth]
        : m.side === 'far-edge'
          ? [W - m.depth, W]
          : [m.a0, m.a1];
    prims.push({
      kind: 'polygon',
      role: m.side === 'far' ? 'visible' : 'hidden',
      points: [
        { u: m.u0, v: v0 },
        { u: m.u1, v: v0 },
        { u: m.u1, v: v1 },
        { u: m.u0, v: v1 },
      ].map(page),
      fill: 'none',
      part: ref,
    });
  }
  // A tenon's shoulder on the face shown: the face steps down to the cheek there.
  for (const t of part.tenons) {
    if (t.n0 + t.thickness >= part.stock.thickness - 1e-9) continue;
    const u = t.end === 0 ? t.length : part.length - t.length;
    prims.push({
      kind: 'line',
      role: 'visible',
      points: [page({ u, v: t.v0 }), page({ u, v: t.v0 + t.width })],
      part: ref,
    });
  }

  // Dovetails: the waste between tails, hatched, its sloped walls on the face. On a pin board the
  // tails' sockets, which run square along the face: hatched on the face shown, dashed on the other,
  // the two set apart by the slope across the thickness.
  for (const d of part.dovetails) {
    const T = part.stock.thickness;
    const g = cornerGeometry(d, W, d.board === 'tails' ? d.baseline : T);
    if (!g) continue;
    const { v0, v1 } = dovetailSpan(d, W);
    const uEnd = d.end === 0 ? 0 : part.length;
    const uBase = d.end === 0 ? d.baseline : part.length - d.baseline;
    if (d.board === 'tails') {
      const walls = [{ outside: v0, inside: v0 }, ...g.sides, { outside: v1, inside: v1 }];
      for (let i = 0; i + 1 < walls.length; i += 2) {
        const [a, b] = [walls[i] as DovetailSide, walls[i + 1] as DovetailSide];
        prims.push({
          kind: 'polygon',
          role: 'visible',
          points: [
            { u: uEnd, v: a.outside },
            { u: uBase, v: a.inside },
            { u: uBase, v: b.inside },
            { u: uEnd, v: b.outside },
          ].map(page),
          fill: 'zone',
          part: ref,
        });
      }
    } else {
      for (const face of ['far', 'near'] as const) {
        const at = face === d.outside ? 'outside' : 'inside';
        for (let i = 0; i + 1 < g.sides.length; i += 2) {
          const [a, b] = [g.sides[i] as DovetailSide, g.sides[i + 1] as DovetailSide];
          prims.push({
            kind: 'polygon',
            role: face === 'far' ? 'visible' : 'hidden',
            points: [
              { u: uEnd, v: a[at] },
              { u: uBase, v: a[at] },
              { u: uBase, v: b[at] },
              { u: uEnd, v: b[at] },
            ].map(page),
            fill: face === 'far' ? 'zone' : 'none',
            part: ref,
          });
        }
      }
    }
  }

  // Hinge plates' screws: a cross at each, solid on the face shown and dashed on the back.
  for (const plate of part.hingePlates) {
    const role = plate.face === 'far' ? 'center' : 'hidden';
    for (const s of plate.screws) {
      const c = page({ u: s.u, v: s.v });
      const r = 0.06 * W;
      prims.push({
        kind: 'line',
        role,
        points: [
          { x: c.x - r, y: c.y },
          { x: c.x + r, y: c.y },
        ],
        part: ref,
      });
      prims.push({
        kind: 'line',
        role,
        points: [
          { x: c.x, y: c.y - r },
          { x: c.x, y: c.y + r },
        ],
        part: ref,
      });
    }
  }

  // Screw holes: a cross at each round hole; a slot drawn as its length the way it runs.
  for (const h of part.screwHoles) {
    const c = page({ u: h.u, v: h.v });
    const r = 0.06 * W;
    prims.push({
      kind: 'line',
      role: 'center',
      points: [
        { x: c.x - r, y: c.y },
        { x: c.x + r, y: c.y },
      ],
      part: ref,
    });
    prims.push({
      kind: 'line',
      role: 'center',
      points: [
        { x: c.x, y: c.y - r },
        { x: c.x, y: c.y + r },
      ],
      part: ref,
    });
    if (h.slot > 0) {
      const end = page(
        h.direction === 'along' ? { u: h.u + h.slot, v: h.v } : { u: h.u, v: h.v + h.slot },
      );
      prims.push({ kind: 'line', role: 'visible', points: [c, end], part: ref });
    }
  }

  // A groove along an edge, dashed as deep as it goes; a rabbet's step, solid on the face shown
  // and dashed on the other; a finger recess's outline the same way.
  const L = part.length;
  for (const g of part.grooves) {
    const [v0, v1] = g.edge === 'reference' ? [0, g.depth] : [W - g.depth, W];
    prims.push({
      kind: 'polygon',
      role: 'hidden',
      points: [
        { u: g.u0, v: v0 },
        { u: g.u1, v: v0 },
        { u: g.u1, v: v1 },
        { u: g.u0, v: v1 },
      ].map(page),
      fill: 'none',
      part: ref,
    });
  }
  for (const rb of part.rabbets) {
    const line: UV[] =
      rb.edge === 'reference'
        ? [
            { u: 0, v: rb.width },
            { u: L, v: rb.width },
          ]
        : rb.edge === 'far'
          ? [
              { u: 0, v: W - rb.width },
              { u: L, v: W - rb.width },
            ]
          : rb.edge === 'first-end'
            ? [
                { u: rb.width, v: 0 },
                { u: rb.width, v: W },
              ]
            : [
                { u: L - rb.width, v: 0 },
                { u: L - rb.width, v: W },
              ];
    prims.push({
      kind: 'line',
      role: rb.face === 'far' ? 'visible' : 'hidden',
      points: line.map(page),
      part: ref,
    });
  }
  for (const rc of part.recesses) {
    prims.push({
      kind: 'polygon',
      role: rc.face === 'far' ? 'visible' : 'hidden',
      points: [
        { u: rc.u - rc.width / 2, v: rc.v - rc.height / 2 },
        { u: rc.u + rc.width / 2, v: rc.v - rc.height / 2 },
        { u: rc.u + rc.width / 2, v: rc.v + rc.height / 2 },
        { u: rc.u - rc.width / 2, v: rc.v + rc.height / 2 },
      ].map(page),
      fill: 'none',
      part: ref,
    });
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
      at: { x: (xOf(left) + xOf(right)) / 2, y: above },
      text: 'Not to scale between the breaks',
      anchor: 'middle',
      side: 'above',
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

  // Hole and dado positions, from the first end's long point along the reference edge: a dado's
  // wall nearer the first end, and its far wall when the dado runs across the part.
  const holes = part.holes;
  const across = part.dadoes.filter((d) => d.u0 > 1e-9 || d.u1 < part.length - 1e-9);
  const positions = [
    ...holes.map((h) => ({ u: h.entry.u, from: -h.entry.v + 0.6 * h.diameter })),
    ...part.boredHoles.map((h) => ({ u: h.entry.u, from: -h.entry.v + 0.6 * h.diameter })),
    ...across.flatMap((d) => [d.u0, d.u1].map((u) => ({ u, from: 0.1 * W }))),
  ];
  if (positions.length > 0) {
    const y = 1.6 * W;
    for (const { u, from } of positions) {
      const x = xOf(u);
      prims.push({
        kind: 'line',
        role: 'extension',
        points: [
          { x, y: from },
          { x, y: y - 0.1 * W },
        ],
        part: ref,
      });
      prims.push({
        kind: 'text',
        role: 'dimension',
        at: { x, y },
        text: formatLength(u),
        anchor: 'end',
        rotate: -90,
        part: ref,
      });
    }
  }
  if (holes.length > 0) {
    const y = 1.6 * W;
    // The hole size and the bolt size, labeled as each (#110): one note per pair, below the
    // positions, whose length is known only once they are shown.
    const sizes = [...new Set(holes.map((h) => `${h.diameter}\n${h.boltDiameter}`))];
    for (const key of sizes) {
      const [hole, bolt] = key.split('\n').map(Number) as [number, number];
      prims.push({
        kind: 'text',
        role: 'note',
        at: { x: xOf(left), y },
        text: `Drill ${formatLength(hole)} holes for ${formatLength(bolt)} bolts`,
        anchor: 'start',
        side: 'below',
        part: ref,
      });
    }
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
  for (const [i, end] of ends.entries()) {
    const first = i === 0;
    const x = first ? xOf(left) - 0.35 * W : xOf(right) + 0.35 * W;
    const anchor = first ? ('end' as const) : ('start' as const);
    // The end's name, as the text names it ("Top", "Foot"), above its setting.
    const name = names[i];
    if (name) {
      prims.push({
        kind: 'text',
        role: 'label',
        at: { x, y: end.setting === 0 ? -0.65 * W : -1.05 * W },
        text: name,
        anchor,
        part: ref,
      });
    }
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

  // The reference face mark: a loop on the face, its tail to the reference edge, clear of holes,
  // tapers, and joinery: the first of each piece's middle and quarter points that is at least a width
  // from both.
  const fromEnd = (end: 0 | 1, d: number) => (end === 0 ? d : part.length - d);
  const busy = [
    ...part.holes.map((h) => h.entry.u),
    ...part.boredHoles.map((h) => h.entry.u),
    ...part.tapers.flatMap((t) => [t.start.u, t.end.u, 0]),
    ...part.dadoes.flatMap((d) => [d.u0, d.u1]),
    ...part.notches.map((n) => fromEnd(n.end, n.along)),
    ...part.cutouts.map((c) => fromEnd(c.end, c.depth)),
    ...part.mortises.flatMap((m) => [m.u0, m.u1]),
    ...part.tenons.map((t) => fromEnd(t.end, t.length)),
    ...part.dovetails.map((d) => fromEnd(d.end, d.baseline)),
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

  // The grain arrow (owner's choice on #71): along the part near its far edge, away from the
  // loop, labeled. Every part is solid wood, with its grain along its length. When every point
  // tried is near something, such as a long part with a row of holes, it goes in the
  // middle of the longest clear stretch inside a window.
  const widestGap = () => {
    const points = [...busy, clear].sort((a, b) => a - b);
    let best: { u: number; gap: number } | undefined;
    for (const w of ws) {
      const inside = points.filter((u) => u > w.u0 && u < w.u1);
      const stops = [w.u0, ...inside, w.u1];
      for (let i = 1; i < stops.length; i++) {
        const gap = (stops[i] as number) - (stops[i - 1] as number);
        if (gap >= 2 * W && (!best || gap > best.gap)) {
          best = { u: ((stops[i] as number) + (stops[i - 1] as number)) / 2, gap };
        }
      }
    }
    return best?.u;
  };
  const free = candidates.filter((u) => Math.abs(u - clear) >= W);
  const gu =
    free.find((u) => busy.every((b) => Math.abs(b - u) >= W)) ?? widestGap() ?? free[0] ?? clear;
  // Short enough to stay clear of the nearest joinery, a hole, or the loop.
  const room = Math.min(...[...busy, clear].map((b) => Math.abs(b - gu)).filter((d) => d > 0));
  const gx = xOf(gu);
  const reach = Math.min(0.75 * W, 0.2 * (xOf(right) - xOf(left)), 0.8 * room);
  const gy = -0.82 * W;
  prims.push({
    kind: 'line',
    role: 'leader',
    points: [
      { x: gx - reach, y: gy },
      { x: gx + reach, y: gy },
    ],
    arrows: true,
    part: ref,
  });
  prims.push({
    kind: 'text',
    role: 'note',
    at: { x: gx, y: gy - 0.06 * W },
    text: 'Grain',
    anchor: 'middle',
    part: ref,
  });

  const along = (n: { along: number; across: number }) =>
    `${formatLength(n.along)} along the part by ${formatLength(n.across)} across`;
  const joinery = [
    ...part.dadoes.map((d) => {
      const runsAlong = d.u0 <= 1e-9 && d.u1 >= part.length - 1e-9;
      const where = runsAlong
        ? `${formatLength(d.v0)} from the ${part.referenceEdge}`
        : `${formatLength(d.u0)} from the first end`;
      const size = runsAlong ? d.v1 - d.v0 : d.u1 - d.u0;
      return `Dado ${where}: ${formatLength(size)} wide, ${formatLength(d.depth)} deep, on ${d.face === 'far' ? 'the face shown' : 'the other face (dashed)'}.`;
    }),
    ...part.notches.map(
      (n) =>
        `Notch at ${whichEnd(n.end)}, at the ${n.edge === 'reference' ? part.referenceEdge : 'far edge'}: ${along(n)}.`,
    ),
    ...part.cutouts.map(
      (c) =>
        `Cutout at ${whichEnd(c.end)}: ${formatLength(c.v1 - c.v0)} wide, ${formatLength(c.depth)} deep, starting ${formatLength(c.v0)} from the ${part.referenceEdge}.`,
    ),
    ...part.mortises.map((m) => {
      const onFace = m.side === 'near' || m.side === 'far';
      const where =
        m.side === 'far'
          ? 'the face shown'
          : m.side === 'near'
            ? 'the other face (dashed)'
            : m.side === 'reference-edge'
              ? `the ${part.referenceEdge} (dashed)`
              : 'the far edge (dashed)';
      const from = onFace ? `the ${part.referenceEdge}` : 'the back face';
      return `Mortise ${formatLength(m.u0)} from the first end, in ${where}: ${formatLength(m.u1 - m.u0)} long, ${formatLength(m.a1 - m.a0)} wide, ${formatLength(m.depth)} deep, starting ${formatLength(m.a0)} from ${from}.`;
    }),
    ...screwNotes(part),
    ...boredNotes(part),
    ...plateNotes(part),
    ...part.grooves.map((g) => {
      const edge = g.edge === 'reference' ? `the ${part.referenceEdge}` : 'the far edge';
      const through = g.u0 <= 1e-9 && g.u1 >= L - 1e-9;
      const where = through
        ? 'end to end'
        : `from ${formatLength(g.u0)} to ${formatLength(g.u1)} from the first end`;
      return `Groove along ${edge}, ${where}: ${formatLength(g.width)} wide, ${formatLength(g.depth)} deep, ${formatLength(g.n0)} from the back face (dashed).`;
    }),
    ...part.rabbets.map((rb) => {
      const along =
        rb.edge === 'reference'
          ? `the ${part.referenceEdge}`
          : rb.edge === 'far'
            ? 'the far edge'
            : rb.edge === 'first-end'
              ? 'the first end'
              : 'the second end';
      const face = rb.face === 'far' ? 'the face shown' : 'the back face (dashed)';
      return `Rabbet along ${along}, in ${face}: ${formatLength(rb.width)} wide, ${formatLength(rb.depth)} deep.`;
    }),
    ...part.recesses.map(
      (rc) =>
        `Finger recess in ${rc.face === 'far' ? 'the face shown' : 'the back face (dashed)'}: ${formatLength(rc.width)} by ${formatLength(rc.height)}, ${formatLength(rc.depth)} deep, centered ${formatLength(rc.u)} from the first end and ${formatLength(rc.v)} from the ${part.referenceEdge}.`,
    ),
    ...part.tapers
      .filter((t) => t.plane)
      .map(
        (t) =>
          `Taper the back face too: from full thickness ${formatLength(t.start.u)} from the first end to ${formatLength(t.end.v)} thinner at the first end.`,
      ),
    ...part.dovetails.map((d) => {
      const slope = `1:${d.slope}`;
      const g = cornerGeometry(d, W, d.board === 'tails' ? d.baseline : part.stock.thickness);
      const span = d.span
        ? `, from ${formatLength(d.span.v0)} to ${formatLength(d.span.v1)} from the ${part.referenceEdge}`
        : '';
      if (d.board === 'tails') {
        const wide = g ? `, each ${formatLength(g.tailWide)} wide at the end` : '';
        return `Dovetail tails at ${whichEnd(d.end)}${span}: ${d.tails} tails${wide}, sloped ${slope} on the faces and cut ${formatLength(d.baseline)} in to the baseline, between half pins ${formatLength(d.halfPin)} and pins ${formatLength(d.pin)} wide at their narrow ends. The waste is hatched.`;
      }
      const outside = d.outside === 'far' ? 'the face shown' : 'the back face';
      return `Dovetail pins at ${whichEnd(d.end)}${span}: ${d.tails - 1} pins and a half pin at each edge, ${formatLength(d.pin)} and ${formatLength(d.halfPin)} wide at ${outside}, sloped ${slope} across the thickness and cut ${formatLength(d.baseline)} in to the baseline. The tails' sockets are hatched on the face shown and dashed on the back.`;
    }),
    ...part.tenons.map(
      (t) =>
        `Tenon at ${whichEnd(t.end)}: ${formatLength(t.length)} long, ${formatLength(t.thickness)} thick, ${formatLength(t.width)} wide, ${formatLength(t.n0)} from the back face and ${formatLength(t.v0)} from the ${part.referenceEdge}.`,
    ),
  ];

  const angles = [
    ...new Set(part.ends.filter((e) => e.setting !== 0).map((e) => formatAngle(e.setting))),
  ];
  return {
    title,
    partId: part.id,
    description: `Cut detail for ${part.letter}, ${part.name}: ${formatLength(part.length)} overall${angles.length > 0 ? `, ends cut at ${angles.join(' and ')}` : ', ends square'}${part.holes.length > 0 ? `, ${part.holes.length} holes` : ''}${part.boredHoles.length > 0 ? `, ${part.boredHoles.length} bored holes` : ''}.`,
    bounds: boundsOf(prims, 0.3 * W),
    primitives: prims,
    notes: [
      `The face shown is the reference face (the loop). Angles are measured from the ${part.referenceEdge}, at the bottom.`,
      ...(holes.length > 0 || part.boredHoles.length > 0
        ? [
            `Hole positions are measured from the long point of ${whichEnd(0)}, along the reference edge.`,
          ]
        : []),
      ...joinery,
    ],
  };
}

/**
 * What the bored holes are, in words: one line for each that share a use, size, depth, side, and
 * place across that side, with each one's distance from the first end.
 */
function boredNotes(part: Part): string[] {
  const T = part.stock.thickness;
  const sideOf = (h: BoredHole) => {
    const side = boredSide(h);
    if (side === 'n') return h.entry.n > T / 2 ? 'the face shown' : 'the back face';
    if (side === 'v')
      return h.entry.v < part.stock.width / 2 ? `the ${part.referenceEdge}` : 'the far edge';
    return h.entry.u < part.length / 2 ? 'the first end' : 'the second end';
  };
  const across = (h: BoredHole) => {
    const side = boredSide(h);
    const fromEdge = `${formatLength(h.entry.v)} from the ${part.referenceEdge}`;
    const fromBack = `${formatLength(h.entry.n)} from the back face`;
    return side === 'n' ? fromEdge : side === 'v' ? fromBack : `${fromEdge} and ${fromBack}`;
  };
  const groups = new Map<string, BoredHole[]>();
  for (const h of part.boredHoles) {
    const deep = h.through ? 'through' : `${formatLength(h.depth)} deep`;
    const key = [h.use, formatLength(h.diameter), deep, sideOf(h), across(h)].join('\n');
    groups.set(key, [...(groups.get(key) ?? []), h]);
  }
  return [...groups.entries()].map(([key, hs]) => {
    const [use, diameter, deep, side, place] = key.split('\n') as [
      string,
      string,
      string,
      string,
      string,
    ];
    const first = hs[0] as BoredHole;
    const dashed = !first.through && side === 'the back face' ? ' (dashed)' : '';
    const along =
      boredSide(first) === 'u'
        ? ''
        : `, at ${hs.map((h) => formatLength(h.entry.u)).join(', ')} from the first end`;
    const count = hs.length === 1 ? 'one' : `${hs.length}`;
    const holes = hs.length === 1 ? 'hole' : 'holes';
    return `Bore ${count} ${diameter} ${holes} ${use}, ${deep}, into ${side}${dashed}, ${place}${along}.`;
  });
}

/** Where each hinge plate's screws go, in words, one line for each plate. */
function plateNotes(part: Part): string[] {
  return part.hingePlates.map((plate) => {
    const face = plate.face === 'far' ? 'the face shown' : 'the back face (dashed)';
    const at = plate.screws
      .map(
        (s) =>
          `${formatLength(s.u)} from the first end and ${formatLength(s.v)} from the ${part.referenceEdge}`,
      )
      .join('; ');
    const screws = plate.screws.length === 1 ? 'its screw' : 'its screws';
    return `Hinge plate on ${face}, ${screws} at ${at}.`;
  });
}

/** What the screw holes are, in words: how many are round, and how long and which way the slots run. */
function screwNotes(part: Part): string[] {
  const holes = part.screwHoles;
  if (holes.length === 0) return [];
  const slots = holes.filter((h) => h.slot > 0);
  const round = holes.length - slots.length;
  const ways = [...new Set(slots.map((h) => h.direction))].map((d) =>
    d === 'along' ? 'toward the second end' : 'toward the far edge',
  );
  const longest = Math.max(0, ...slots.map((h) => h.slot));
  return [
    `Screw holes: ${round} round${slots.length > 0 ? `, and ${slots.length} slotted ${formatLength(longest)} longer, ${ways.join(' and ')}, so the part they hold can move` : ''}.`,
  ];
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
    at: { x: (from.x + to.x) / 2, y },
    text,
    anchor: 'middle',
    side,
    part,
  });
}
