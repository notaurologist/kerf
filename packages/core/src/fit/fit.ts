import { boredSide } from '../model/operations.ts';
import type { BoredHole, Part, Placement, Vec3 } from '../model/types.ts';
import type { HardwareLine } from '../outputs/hardwareList.ts';

// Whether a plan's parts go together, from what each part records and where each piece is placed
// (#570). Every joint is written on its parts twice, once on each side, and these check that the
// two sides agree: a dado holds the end it names, a mortise the tenon, a groove the tongue, and a
// bolt's holes line up through the parts it passes, as long as its grip. Generic: they know joints,
// not what a template builds. Run in tests on every template's output.

export interface FitProblem {
  check: 'within' | 'dado' | 'mortise' | 'tenon' | 'tongue' | 'bolt';
  partId: string;
  instance: number;
  message: string;
}

/** Below this, two lengths are the same: far below anything marked, far above float error. */
const EPSILON = 1e-6;

interface Piece {
  part: Part;
  placement: Placement;
}

type UVN = { u: number; v: number; n: number };

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const same = (a: number, b: number) => Math.abs(a - b) <= EPSILON;
const within = (x: number, [lo, hi]: readonly [number, number]) =>
  x >= lo - EPSILON && x <= hi + EPSILON;

function toWorld(pl: Placement, p: UVN): Vec3 {
  const { origin: o, along: a, across: c, through: t } = pl;
  return {
    x: o.x + a.x * p.u + c.x * p.v + t.x * p.n,
    y: o.y + a.y * p.u + c.y * p.v + t.y * p.n,
    z: o.z + a.z * p.u + c.z * p.v + t.z * p.n,
  };
}

function toLocal(pl: Placement, w: Vec3): UVN {
  const d = { x: w.x - pl.origin.x, y: w.y - pl.origin.y, z: w.z - pl.origin.z };
  return { u: dot(d, pl.along), v: dot(d, pl.across), n: dot(d, pl.through) };
}

/** Points of one piece in another's frame. */
const between = (from: Piece, to: Piece, points: readonly UVN[]) =>
  points.map((p) => toLocal(to.placement, toWorld(from.placement, p)));

const grid = (us: readonly number[], vs: readonly number[], ns: readonly number[]): UVN[] =>
  us.flatMap((u) => vs.flatMap((v) => ns.map((n) => ({ u, v, n }))));

/** The rectangle the points cover on two axes, if they lie on its corners, as a square end does. */
function rectangle(points: readonly UVN[], a: 'u' | 'v' | 'n', b: 'u' | 'v' | 'n') {
  const as = points.map((p) => p[a]);
  const bs = points.map((p) => p[b]);
  const r = { a0: Math.min(...as), a1: Math.max(...as), b0: Math.min(...bs), b1: Math.max(...bs) };
  const onCorners = points.every(
    (p) => (same(p[a], r.a0) || same(p[a], r.a1)) && (same(p[b], r.b0) || same(p[b], r.b1)),
  );
  return onCorners ? r : undefined;
}

const sameRectangle = (
  r: { a0: number; a1: number; b0: number; b1: number } | undefined,
  a0: number,
  a1: number,
  b0: number,
  b1: number,
) => r !== undefined && same(r.a0, a0) && same(r.a1, a1) && same(r.b0, b0) && same(r.b1, b1);

/** The square end of a piece, from v0 to v1 across and n0 to n1 through: its four corners. */
function endFace(part: Part, end: 0 | 1, v: [number, number], n: [number, number]): UVN[] | null {
  if (part.ends[end].setting !== 0) return null;
  return grid([end === 0 ? 0 : part.length], v, n);
}

const RAD = Math.PI / 180;

/** Whether a point in a part's frame is in its wood, between its end cuts (Placement). */
function inPart(part: Part, p: UVN): boolean {
  const { width: W, thickness: T } = part.stock;
  const [first, second] = part.ends.map((e) => Math.tan(e.setting * RAD)) as [number, number];
  const u1 = part.endsParallel ? part.length - (W - p.v) * second : part.length - p.v * second;
  return within(p.v, [0, W]) && within(p.n, [0, T]) && within(p.u, [p.v * first, u1]);
}

/**
 * Where a bored hole goes wrong in its part, or nothing: it enters on the face, edge, or square end
 * its direction faces, into the wood; its rim stays in the wood from the entry to its bottom; and it comes out
 * on the far side when it is through, and stops short of it when it is not.
 */
function boredProblem(part: Part, h: BoredHole): string | null {
  const d = h.direction;
  const name = `A ${h.diameter} hole ${h.use} at u ${h.entry.u}, v ${h.entry.v}, n ${h.entry.n}`;
  if (!same(Math.hypot(d.u, d.v, d.n), 1))
    return `${name} has a direction that is not a unit vector.`;
  const axis = boredSide(h);
  const size = { u: part.length, v: part.stock.width, n: part.stock.thickness }[axis];
  const inward = d[axis] > 0 ? 0 : size;
  if (!same(h.entry[axis], inward)) return `${name} does not start on the side it is bored into.`;
  const bottom = {
    u: h.entry.u + d.u * h.depth,
    v: h.entry.v + d.v * h.depth,
    n: h.entry.n + d.n * h.depth,
  };
  // Two directions square to the bore, each the radius long, for points on its rim.
  const helper = axis === 'u' ? { u: 0, v: 1, n: 0 } : { u: 1, v: 0, n: 0 };
  const cross = (a: UVN, b: UVN) => ({
    u: a.v * b.n - a.n * b.v,
    v: a.n * b.u - a.u * b.n,
    n: a.u * b.v - a.v * b.u,
  });
  const scale = (a: UVN, k: number) => {
    const len = Math.hypot(a.u, a.v, a.n);
    return { u: (a.u / len) * k, v: (a.v / len) * k, n: (a.n / len) * k };
  };
  const r = h.diameter / 2;
  const s1 = scale(cross(d, helper), r);
  const s2 = scale(cross(d, s1), r);
  const rim = [h.entry, bottom].flatMap((c) =>
    [s1, s2].flatMap((s) =>
      [1, -1].map((k) => ({ u: c.u + k * s.u, v: c.v + k * s.v, n: c.n + k * s.n })),
    ),
  );
  if (!rim.every((p) => inPart(part, p))) return `${name} runs past the part.`;
  const out = same(bottom[axis], size - inward);
  if (h.through && !out) return `${name} is through, but its ${h.depth} stops inside the part.`;
  if (!h.through && out) return `${name} is stopped, but its ${h.depth} comes out the far side.`;
  return null;
}

/**
 * Every cut a part records lies within the part: a dado, mortise, or groove inside its stock and
 * length, a tenon inside its end, and a bored hole in the wood, through or stopped as it says. The
 * two sides of a joint can agree with each other and both be outside the wood.
 */
function withinProblems(pieces: readonly Piece[]): FitProblem[] {
  const parts = [...new Map(pieces.map((p) => [p.part.id, p.part])).values()];
  return parts.flatMap((part) => {
    const L = part.length;
    const { width: W, thickness: T } = part.stock;
    const outside: string[] = [
      ...part.dadoes.flatMap((d) =>
        within(d.u0, [0, L]) &&
        within(d.u1, [0, L]) &&
        within(d.v0, [0, W]) &&
        within(d.v1, [0, W]) &&
        within(d.depth, [0, T])
          ? []
          : [`A dado for ${d.withPart} runs past the part.`],
      ),
      ...part.mortises.flatMap((m) => {
        const onFace = m.side === 'near' || m.side === 'far';
        const across = onFace ? W : T;
        const deep = onFace ? T : W;
        return within(m.u0, [0, L]) &&
          within(m.u1, [0, L]) &&
          within(m.a0, [0, across]) &&
          within(m.a1, [0, across]) &&
          within(m.depth, [0, deep])
          ? []
          : [
              `A mortise for ${m.withPart} in the ${m.side} runs past the part, from ${m.a0} to ${m.a1} across a side ${across} wide.`,
            ];
      }),
      ...part.grooves.flatMap((g) =>
        within(g.u0, [0, L]) &&
        within(g.u1, [0, L]) &&
        within(g.n0, [0, T]) &&
        within(g.n0 + g.width, [0, T]) &&
        within(g.depth, [0, W])
          ? []
          : [`A groove along the ${g.edge} edge runs past the part.`],
      ),
      ...part.tenons.flatMap((t) =>
        within(t.v0, [0, W]) &&
        within(t.v0 + t.width, [0, W]) &&
        within(t.n0, [0, T]) &&
        within(t.n0 + t.thickness, [0, T]) &&
        within(t.length, [0, L])
          ? []
          : [`The tenon on end ${t.end} runs past the part's end.`],
      ),
      ...part.boredHoles.flatMap((h) => {
        const problem = boredProblem(part, h);
        return problem ? [problem] : [];
      }),
    ];
    return outside.map((message) => ({
      check: 'within' as const,
      partId: part.id,
      instance: 0,
      message,
    }));
  });
}

/** Dadoes: each holds the end of a piece of the part it names, or that piece's edge, as a track. */
function dadoProblems(pieces: readonly Piece[]): FitProblem[] {
  return pieces.flatMap((h) =>
    h.part.dadoes.flatMap((d) => {
      const T = h.part.stock.thickness;
      const bottom = d.face === 'near' ? d.depth : T - d.depth;
      const inside: [number, number] = d.face === 'near' ? [0, d.depth] : [T - d.depth, T];
      const candidates = pieces.filter((p) => p.part.id === d.withPart);
      const holdsEnd = candidates.some((p) =>
        ([0, 1] as const).some((end) => {
          const notch = p.part.notches.find((x) => x.end === end);
          if (notch && !same(notch.along, d.depth)) return false;
          const W = p.part.stock.width;
          const v: [number, number] =
            notch?.edge === 'reference'
              ? [notch.across, W]
              : notch?.edge === 'far'
                ? [0, W - notch.across]
                : [0, W];
          const face = endFace(p.part, end, v, [0, p.part.stock.thickness]);
          if (!face) return false;
          const there = between(p, h, face);
          return (
            there.every((c) => same(c.n, bottom)) &&
            sameRectangle(rectangle(there, 'u', 'v'), d.u0, d.u1, d.v0, d.v1)
          );
        }),
      );
      // A piece that slides in the dado, as in a track: an edge inside it.
      const holdsEdge = candidates.some((p) =>
        [0, p.part.stock.width].some((v) =>
          between(p, h, grid([0, p.part.length], [v], [0, p.part.stock.thickness])).every(
            (c) => within(c.u, [d.u0, d.u1]) && within(c.v, [d.v0, d.v1]) && within(c.n, inside),
          ),
        ),
      );
      if (holdsEnd || holdsEdge) return [];
      return [
        {
          check: 'dado' as const,
          partId: h.part.id,
          instance: h.placement.instance,
          message:
            candidates.length === 0
              ? `A dado names ${d.withPart}, which is not placed.`
              : `A dado for ${d.withPart}, from u ${d.u0} to ${d.u1} and v ${d.v0} to ${d.v1}, ${d.depth} deep in the ${d.face} face, holds no end or edge of it.`,
        },
      ];
    }),
  );
}

/** Whether a tenon's tip, on piece `p`, reaches the bottom of a box `depth` in from a side of `h`. */
function tipIn(
  p: Piece,
  tenon: Part['tenons'][number],
  h: Piece,
  side: 'near' | 'far' | 'reference-edge' | 'far-edge',
  rect: { u0: number; u1: number; a0: number; a1: number },
  depth: number,
  fits: 'exactly' | 'within',
): boolean {
  const tip = endFace(
    p.part,
    tenon.end,
    [tenon.v0, tenon.v0 + tenon.width],
    [tenon.n0, tenon.n0 + tenon.thickness],
  );
  if (!tip) return false;
  const there = between(p, h, tip);
  const onFace = side === 'near' || side === 'far';
  const size = onFace ? h.part.stock.thickness : h.part.stock.width;
  const bottom = side === 'near' || side === 'reference-edge' ? depth : size - depth;
  const deep = (c: UVN) => (onFace ? c.n : c.v);
  const across = (c: UVN) => (onFace ? c.v : c.n);
  if (!there.every((c) => same(deep(c), bottom))) return false;
  if (fits === 'exactly') {
    return sameRectangle(
      rectangle(there, 'u', onFace ? 'v' : 'n'),
      rect.u0,
      rect.u1,
      rect.a0,
      rect.a1,
    );
  }
  return there.every(
    (c) => within(c.u, [rect.u0, rect.u1]) && within(across(c), [rect.a0, rect.a1]),
  );
}

/**
 * Mortises and tenons: each mortise holds a tenon of the part it names (by ID or role), the same
 * size, reaching its bottom; each tenon sits in a mortise that way or in a groove, as a stub tenon.
 */
function tenonProblems(pieces: readonly Piece[]): FitProblem[] {
  const named = (p: Piece, name: string) => p.part.id === name || p.part.role === name;
  const inMortise = (p: Piece, t: Part['tenons'][number]) =>
    pieces.some((h) =>
      h.part.mortises.some(
        (m) =>
          named(p, m.withPart) &&
          same(t.length, m.depth) &&
          tipIn(p, t, h, m.side, m, m.depth, 'exactly'),
      ),
    );
  const inGroove = (p: Piece, t: Part['tenons'][number]) =>
    pieces.some(
      (h) =>
        h !== p &&
        h.part.grooves.some(
          (g) =>
            same(t.length, g.depth) &&
            tipIn(
              p,
              t,
              h,
              g.edge === 'far' ? 'far-edge' : 'reference-edge',
              { u0: g.u0, u1: g.u1, a0: g.n0, a1: g.n0 + g.width },
              g.depth,
              'within',
            ),
        ),
    );
  const mortises = pieces.flatMap((h) =>
    h.part.mortises.flatMap((m) =>
      pieces.some(
        (p) =>
          named(p, m.withPart) &&
          p.part.tenons.some(
            (t) => same(t.length, m.depth) && tipIn(p, t, h, m.side, m, m.depth, 'exactly'),
          ),
      )
        ? []
        : [
            {
              check: 'mortise' as const,
              partId: h.part.id,
              instance: h.placement.instance,
              message: `A mortise for ${m.withPart} in the ${m.side}, from u ${m.u0} to ${m.u1} and ${m.a0} to ${m.a1}, ${m.depth} deep, holds no tenon of it.`,
            },
          ],
    ),
  );
  const tenons = pieces.flatMap((p) =>
    p.part.tenons.flatMap((t) =>
      inMortise(p, t) || inGroove(p, t)
        ? []
        : [
            {
              check: 'tenon' as const,
              partId: p.part.id,
              instance: p.placement.instance,
              message: `The tenon on end ${t.end}, ${t.length} long, sits in no mortise or groove.`,
            },
          ],
    ),
  );
  return [...mortises, ...tenons];
}

/**
 * Tongues: an edge rabbeted on both faces is a tongue, and it must lie in a groove of another
 * piece, no thicker than the groove is wide, between its mouth and its bottom.
 */
function tongueProblems(pieces: readonly Piece[]): FitProblem[] {
  return pieces.flatMap((p) => {
    const { length: L } = p.part;
    const { width: W, thickness: T } = p.part.stock;
    const edges = ['reference', 'far', 'first-end', 'second-end'] as const;
    return edges.flatMap((edge) => {
      const near = p.part.rabbets.find((r) => r.edge === edge && r.face === 'near');
      const far = p.part.rabbets.find((r) => r.edge === edge && r.face === 'far');
      if (!near || !far) return [];
      const n: [number, number] = [near.depth, T - far.depth];
      const face =
        edge === 'reference'
          ? grid([0, L], [0], n)
          : edge === 'far'
            ? grid([0, L], [W], n)
            : grid([edge === 'first-end' ? 0 : L], [0, W], n);
      const held = pieces.some(
        (h) =>
          h !== p &&
          h.part.grooves.some((g) => {
            const HW = h.part.stock.width;
            const mouth = g.edge === 'far' ? HW : 0;
            const bottom = g.edge === 'far' ? HW - g.depth : g.depth;
            const span: [number, number] = [Math.min(mouth, bottom), Math.max(mouth, bottom)];
            return between(p, h, face).every(
              (c) =>
                within(c.u, [g.u0, g.u1]) &&
                within(c.n, [g.n0, g.n0 + g.width]) &&
                within(c.v, span),
            );
          }),
      );
      return held
        ? []
        : [
            {
              check: 'tongue' as const,
              partId: p.part.id,
              instance: p.placement.instance,
              message: `The tongue on its ${edge} edge, ${n[1] - n[0]} thick, lies in no groove it fits.`,
            },
          ];
    });
  });
}

/**
 * Bolts: the holes on one line, through the pieces each part's holes are drilled in, touch end to
 * end, and their total length is the grip of the bolt the hardware lists for them.
 */
function boltProblems(pieces: readonly Piece[], hardware: readonly HardwareLine[]): FitProblem[] {
  const grips = new Map<string, number>();
  for (const line of hardware) {
    for (const id of line.bolt?.items ?? []) grips.set(id, line.bolt?.grip ?? Number.NaN);
  }
  const segments = pieces.flatMap((p) =>
    p.part.holes.map((hole) => {
      const start = toWorld(p.placement, hole.entry);
      const end = toWorld(p.placement, {
        u: hole.entry.u + hole.direction.u * hole.length,
        v: hole.entry.v + hole.direction.v * hole.length,
        n: hole.entry.n + hole.direction.n * hole.length,
      });
      return { piece: p, hardwareId: hole.hardwareId, start, end, length: hole.length };
    }),
  );
  type Segment = (typeof segments)[number];
  const sub = (a: Vec3, b: Vec3) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const size = (a: Vec3) => Math.sqrt(dot(a, a));
  const onLine = (s: Segment, line: Segment) => {
    const d = sub(line.end, line.start);
    const k = 1 / size(d);
    const unit = { x: d.x * k, y: d.y * k, z: d.z * k };
    return [s.start, s.end].every((q) => {
      const r = sub(q, line.start);
      const t = dot(r, unit);
      return size(sub(r, { x: unit.x * t, y: unit.y * t, z: unit.z * t })) <= EPSILON;
    });
  };
  const lines: Segment[][] = [];
  for (const s of segments) {
    const line = lines.find((l) => l[0] !== undefined && onLine(s, l[0]));
    if (line) line.push(s);
    else lines.push([s]);
  }
  return lines.flatMap((line) => {
    const first = line[0] as Segment;
    const d = sub(first.end, first.start);
    const unit = { x: d.x / size(d), y: d.y / size(d), z: d.z / size(d) };
    const along = (q: Vec3) => dot(sub(q, first.start), unit);
    const spans = line
      .map((s) => {
        const [a, b] = [along(s.start), along(s.end)];
        return { s, from: Math.min(a, b), to: Math.max(a, b) };
      })
      .sort((a, b) => a.from - b.from);
    const problems: FitProblem[] = [];
    const where = (s: Segment) => ({
      partId: s.piece.part.id,
      instance: s.piece.placement.instance,
    });
    // Holes that touch end to end are one bolt; a line can hold several bolts apart from each
    // other, such as one at each frame. A gap within a bolt leaves runs shorter than its grip.
    const bolts: (typeof spans)[] = [];
    for (const span of spans) {
      const last = bolts.at(-1);
      const prev = last?.at(-1);
      if (last && prev && span.from < prev.to - EPSILON) {
        problems.push({
          check: 'bolt',
          ...where(span.s),
          message: `A ${span.s.hardwareId} hole overlaps the hole before it on its line.`,
        });
      }
      if (last && prev && same(span.from, prev.to)) last.push(span);
      else bolts.push([span]);
    }
    for (const bolt of bolts) {
      const ids = new Set(bolt.map((b) => b.s.hardwareId));
      const head = (bolt[0] as (typeof spans)[number]).s;
      if (ids.size > 1) {
        problems.push({
          check: 'bolt',
          ...where(head),
          message: `Holes for ${[...ids].join(' and ')} lie on one bolt.`,
        });
      }
      const grip = grips.get(head.hardwareId);
      const wood = bolt.reduce((sum, b) => sum + b.s.length, 0);
      if (grip !== undefined && !same(grip, wood)) {
        problems.push({
          check: 'bolt',
          ...where(head),
          message: `The ${head.hardwareId} grip is ${grip}, but the holes it passes through run ${wood}.`,
        });
      }
    }
    return problems;
  });
}

/** Every way the parts fail to go together, or none. */
export function fitProblems(
  scene: { parts: readonly Part[]; placements: readonly Placement[] },
  hardware: readonly HardwareLine[] = [],
): FitProblem[] {
  const pieces = scene.placements.flatMap((placement) => {
    const part = scene.parts.find((p) => p.id === placement.partId);
    return part ? [{ part, placement }] : [];
  });
  return [
    ...withinProblems(pieces),
    ...dadoProblems(pieces),
    ...tenonProblems(pieces),
    ...tongueProblems(pieces),
    ...boltProblems(pieces, hardware),
  ];
}
