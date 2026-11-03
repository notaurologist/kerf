import type { Part, Placement } from '../model/types.ts';
import { formatLength } from '../units/length.ts';
import { signedArea2 } from './clip.ts';
import { convexPieces } from './convex.ts';
import { letterColumn, letterRoom } from './letters.ts';
import { partOutline, type UV } from './outline.ts';
import type { Drawing, PartRef, Point2, Primitive, Stage, Tone } from './primitives.ts';
import { boundsOf } from './primitives.ts';
import { depth, depthOnPlane, type Isometric, project } from './projection.ts';
import { type Solid, solid, solidCentroid } from './solid.ts';
import { add, dot, length, scale, sub, type Vec3 } from './vec.ts';

// The isometric and exploded views (#90): every part instance as a solid, faces facing the viewer
// drawn in depth order and toned by which way they point (D2), edges below grade hidden, and part
// letters in columns beside the drawing with leaders (docs/design/diagrams.html, the standard).
// Generic: the template supplies the parts, placements, ground, phantom lines, and how the
// exploded view pulls parts apart, as data.

export interface Scene {
  parts: readonly Part[];
  placements: readonly Placement[];
  /** The ground plane; anything on the side away from `up` is below grade. */
  ground?: { point: Vec3; up: Vec3 };
  /** Things not in the cut list, drawn as phantom lines: 3D polylines. */
  phantoms?: readonly Vec3[][];
  /** The template axis along which faces count as ends (darkest tone). Default x. */
  endAxis?: 'x' | 'y';
}

/** How far to move one part instance in the exploded view, in template coordinates. */
export interface Explode {
  partId: string;
  instance: number;
  offset: Vec3;
  /**
   * When it moves as the view explodes: a stage at a time, lowest first, so each stage can be
   * drawn in an order that holds while it moves (#352). 0 when left out.
   */
  stage?: number;
}

/** A face, or a piece of one, in 3D. `edge[i]` says whether the edge from point i is real. */
interface Piece {
  points: Vec3[];
  edge: boolean[];
  normal: Vec3;
  tone: Tone;
  part: PartRef;
  solid: number;
  /** Painted after the other pieces on its plane (Solid's faces). */
  decal?: true;
}

/** A piece as painted, in paint order. */
interface Drawn {
  points: Point2[];
  part: PartRef;
  solid: number;
}

const EPS = 1e-9;

function tone(normal: Vec3, endAxis: 'x' | 'y'): Tone {
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);
  if (az >= ax && az >= ay) return 1;
  const ends = endAxis === 'x' ? ax : ay;
  const sides = endAxis === 'x' ? ay : ax;
  return ends > sides ? 3 : 2;
}

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 =>
  add(a, { x: (b.x - a.x) * t, y: (b.y - a.y) * t, z: (b.z - a.z) * t });

/**
 * The part of a piece on the side of a plane where `side` is ≥ 0 (within `eps`), keeping track of
 * which edges are real: an edge along the cut is not.
 */
function keep(piece: Piece, side: (p: Vec3) => number, eps = 1e-9): Piece | null {
  const points: Vec3[] = [];
  const edge: boolean[] = [];
  const n = piece.points.length;
  for (let i = 0; i < n; i++) {
    const a = piece.points[i] as Vec3;
    const b = piece.points[(i + 1) % n] as Vec3;
    const real = piece.edge[i] ?? false;
    const da = side(a);
    const db = side(b);
    const aIn = da >= -eps;
    const bIn = db >= -eps;
    if (aIn) {
      points.push(a);
      edge.push(real);
    }
    if (aIn !== bIn) {
      const x = lerp3(a, b, da / (da - db));
      if (aIn) {
        // a → x is part of the edge; x then runs along the cut.
        points.push(x);
        edge.push(false);
      } else {
        // x → b is part of the edge.
        points.push(x);
        edge.push(real);
      }
    }
  }
  return points.length >= 3 ? { ...piece, points, edge } : null;
}

interface Node {
  on: Vec3;
  normal: Vec3;
  here: Piece[];
  front: Node | null;
  back: Node | null;
}

/**
 * A BSP tree of the pieces (Fuchs, Kedem, and Naylor 1980): each node's plane splits the pieces
 * beyond it, so painting back to front from any viewpoint is exact, with no ordering cycles.
 */
function bsp(pieces: readonly Piece[]): Node | null {
  const [first, ...rest] = pieces;
  if (!first) return null;
  const on = first.points[0] as Vec3;
  const normal = first.normal;
  const side = (p: Vec3) => dot(sub(p, on), normal);
  const here = [first];
  const front: Piece[] = [];
  const back: Piece[] = [];
  for (const piece of rest) {
    const d = piece.points.map(side);
    if (d.every((x) => Math.abs(x) < 1e-7)) here.push(piece);
    else if (d.every((x) => x >= -1e-7)) front.push(piece);
    else if (d.every((x) => x <= 1e-7)) back.push(piece);
    else {
      const f = keep(piece, side, 0);
      const b = keep(piece, (p) => -side(p), 0);
      if (f) front.push(f);
      if (b) back.push(b);
    }
  }
  return { on, normal, here, front: bsp(front), back: bsp(back) };
}

function paint(node: Node | null, view: Isometric, out: Piece[]) {
  if (!node) return;
  const viewerInFront = dot(node.normal, view.toViewer) > 0;
  paint(viewerInFront ? node.back : node.front, view, out);
  out.push(...node.here.filter((p) => !p.decal), ...node.here.filter((p) => p.decal));
  paint(viewerInFront ? node.front : node.back, view, out);
}

const centroid2 = (points: readonly Point2[]): Point2 => ({
  x: points.reduce((s, p) => s + p.x, 0) / points.length,
  y: points.reduce((s, p) => s + p.y, 0) / points.length,
});

function inside(point: Point2, polygon: readonly Point2[]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i] as Point2;
    const b = polygon[j] as Point2;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      hit = !hit;
    }
  }
  return hit;
}

function refFor(scene: Scene, pl: Placement): PartRef {
  const part = scene.parts.find((p) => p.id === pl.partId);
  return { partId: pl.partId, instance: pl.instance, letter: part?.letter ?? '' };
}

/** A section plane: a point on it and its unit normal, pointing toward the viewer. */
export interface SectionPlane {
  point: Vec3;
  normal: Vec3;
}

/**
 * Draws solids: faces in paint order, hidden edges below grade, grade lines, phantoms. With a
 * section plane, only what lies behind it is drawn.
 */
function drawSolids(
  scene: Scene,
  view: Isometric,
  solids: readonly { solid: Solid; ref: PartRef }[],
  section?: SectionPlane,
): { primitives: Primitive[]; faces: Drawn[] } {
  const behind = (p: Vec3) => (section ? -dot(sub(p, section.point), section.normal) : 1);
  const ground = scene.ground;
  const above = (p: Vec3) => (ground ? dot(sub(p, ground.point), ground.up) : 1);
  const pieces: Piece[] = [];
  const lines: Primitive[] = [];
  solids.forEach(({ solid: s, ref }, index) => {
    for (const face of s.faces) {
      if (dot(face.normal, view.toViewer) <= EPS) continue;
      const full: Piece = {
        points: face.points,
        edge: face.edge ?? face.points.map(() => true),
        ...(face.decal ? { decal: face.decal } : {}),
        normal: face.normal,
        tone: tone(face.normal, scene.endAxis ?? 'x'),
        part: ref,
        solid: index,
      };
      const whole = section ? keep(full, behind, 0) : full;
      if (!whole) continue;
      const up = keep(whole, above, 0);
      if (up) pieces.push(up);
      if (!ground) continue;
      // Below grade: the face's edges as hidden lines; where it meets the ground, a grade line.
      const cut = keep(whole, (p) => -above(p), 0);
      // A face that only touches the ground, such as a side face of a part resting on it, has
      // nothing below it.
      const down = cut?.points.some((p) => above(p) < -1e-7) ? cut : null;
      for (let i = 0; down && i < down.points.length; i++) {
        const a = down.points[i] as Vec3;
        const b = down.points[(i + 1) % down.points.length] as Vec3;
        lines.push({
          kind: 'line',
          role: down.edge[i] ? 'hidden' : 'grade',
          points: [project(view, a), project(view, b)],
          part: ref,
        });
      }
    }
  });
  const ordered: Piece[] = [];
  paint(bsp(pieces), view, ordered);
  const primitives: Primitive[] = [];
  for (const piece of ordered) {
    const points = piece.points.map((p) => project(view, p));
    primitives.push({
      kind: 'polygon',
      role: 'visible',
      points,
      fill: piece.tone,
      outline: false,
      part: piece.part,
    });
    for (let i = 0; i < points.length; i++) {
      if (!piece.edge[i]) continue;
      primitives.push({
        kind: 'line',
        role: 'visible',
        points: [points[i] as Point2, points[(i + 1) % points.length] as Point2],
        part: piece.part,
      });
    }
  }
  primitives.push(
    ...lines,
    ...(scene.phantoms ?? []).flatMap((line) => visibleRuns(line, ordered, view)),
  );
  const faces = ordered.map((p) => ({
    points: p.points.map((q) => project(view, q)),
    part: p.part,
    solid: p.solid,
  }));
  return { primitives, faces };
}

/** How finely phantom lines are checked for parts in front of them, in inches. */
const PHANTOM_STEP = 0.25;

/**
 * The stretches of a 3D polyline that no part hides, as phantom lines. Each short step is hidden
 * when a painted piece covers its middle on the page and is nearer there.
 */
function visibleRuns(
  line: readonly Vec3[],
  pieces: readonly Piece[],
  view: Isometric,
): Primitive[] {
  const page = pieces.map((p) => p.points.map((q) => project(view, q)));
  const hidden = (p: Vec3) => {
    const at = project(view, p);
    const d = depth(view, p);
    return pieces.some(
      (piece, i) =>
        inside(at, page[i] as Point2[]) &&
        depthOnPlane(view, at, piece.points[0] as Vec3, piece.normal) > d + 1e-6,
    );
  };
  const runs: Point2[][] = [];
  let run: Point2[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i] as Vec3;
    const b = line[i + 1] as Vec3;
    const steps = Math.max(1, Math.ceil(length(sub(b, a)) / PHANTOM_STEP));
    for (let k = 0; k < steps; k++) {
      const p0 = lerp3(a, b, k / steps);
      const p1 = lerp3(a, b, (k + 1) / steps);
      if (hidden(lerp3(p0, p1, 0.5))) {
        if (run.length >= 2) runs.push(run);
        run = [];
        continue;
      }
      if (run.length === 0) run.push(project(view, p0));
      run.push(project(view, p1));
    }
  }
  if (run.length >= 2) runs.push(run);
  return runs.map((points) => ({ kind: 'line', role: 'phantom', points }));
}

type Letter = Extract<Primitive, { kind: 'letter' }>;

/**
 * Part letters (D2): one per part, its leader ending on the part's largest face that nothing
 * drawn later covers. Letters sit in a column on each side free of `dimensions`, each letter on
 * the side of its part, or all in one column when dimensions take the other side
 * (`letterColumn`).
 */
function letters(
  faces: readonly Drawn[],
  primitives: readonly Primitive[],
  dimensions: readonly Primitive[] = [],
): Primitive[] {
  const box = boundsOf(primitives);
  const outer = boundsOf([...primitives, ...dimensions]);
  const room = letterRoom([...primitives, ...dimensions]);
  const targets = new Map<string, { at: Point2; part: PartRef; area: number }>();
  faces.forEach((face, i) => {
    const at = centroid2(face.points);
    const covered = faces
      .slice(i + 1)
      .some((later) => later.solid !== face.solid && inside(at, later.points));
    if (covered) return;
    const area = Math.abs(signedArea2(face.points));
    const best = targets.get(face.part.partId);
    if (!best || area > best.area) targets.set(face.part.partId, { at, part: face.part, area });
  });
  const middle = box.x + box.width / 2;
  const gap = Math.max(box.width, box.height) * 0.08;
  const spacing = box.height / 12;
  const all = [...targets.values()].map(
    (t): Letter => ({
      kind: 'letter',
      at: t.at,
      target: t.at,
      letter: t.part.letter,
      part: t.part,
    }),
  );
  return room.sides.flatMap((side) => {
    const mine =
      room.sides.length === 1
        ? all
        : all.filter((l) => (side === 'left' ? l.target.x < middle : l.target.x >= middle));
    const x = side === 'left' ? outer.x - gap : outer.x + outer.width + gap;
    return letterColumn(mine, x, spacing, room);
  });
}

export function isometricView(
  scene: Scene,
  view: Isometric,
  description: string,
  title = 'Isometric view',
  options: { letters?: boolean } = {},
): Drawing {
  const solids = placedSolids(scene);
  const { primitives, faces } = drawSolids(scene, view, solids);
  const all = [...primitives, ...(options.letters === false ? [] : letters(faces, primitives))];
  return { title, description, bounds: boundsOf(all, 2), primitives: all, notes: [] };
}

/**
 * The exploded view: each listed instance moved by its offset, with a guideline from where it
 * goes to where it is drawn.
 */
export function explodedView(
  scene: Scene,
  view: Isometric,
  explode: readonly Explode[],
  description: string,
  title = 'Exploded view',
): Drawing {
  const offsetOf = (pl: Placement) =>
    explode.find((e) => e.partId === pl.partId && e.instance === pl.instance)?.offset;
  const solids = placedSolids(scene, offsetOf);
  const { primitives, faces } = drawSolids(scene, view, solids);
  const guidelines = scene.placements.flatMap((pl): Primitive[] => {
    const offset = offsetOf(pl);
    const part = scene.parts.find((p) => p.id === pl.partId);
    if (!offset || !part) return [];
    const home = solidCentroid(solid(part, pl));
    return [
      {
        kind: 'line',
        role: 'guideline',
        points: [project(view, home), project(view, add(home, offset))],
        part: refFor(scene, pl),
      },
    ];
  });
  const all = [...guidelines, ...primitives, ...letters(faces, primitives)];
  const stages = explodeStages(scene, view, explode);
  return { title, description, bounds: boundsOf(all, 2), primitives: all, notes: [], stages };
}

const stageOf = (e: Explode) => e.stage ?? 0;

/**
 * The move from the assembled view to the exploded one, a stage at a time (#352). A drawing has
 * one paint order, which is right for where its parts are drawn; a part sliding past another can
 * need the other order. So each stage is drawn where it ends, and its parts slide out over that
 * drawing, from `from` of the way through the stage, once they have left the joints they sat in
 * and nothing they pass changes which is in front. Until then they slide over the drawing the
 * stage starts from: the stage before's, or the assembled view for the first. The last stage
 * ends at the exploded view itself, so it has no primitives of its own.
 */
function explodeStages(scene: Scene, view: Isometric, explode: readonly Explode[]): Stage[] {
  const order = [...new Set(explode.map(stageOf))].sort((a, b) => a - b);
  const offsets = (keep: (stage: number) => boolean) => (pl: Placement) =>
    explode.find((e) => e.partId === pl.partId && e.instance === pl.instance && keep(stageOf(e)))
      ?.offset;
  return order.map((n, k) => {
    const moving = explode.filter((e) => stageOf(e) === n);
    const start = placedSolids(
      scene,
      offsets((m) => m < n),
    );
    const primitives =
      k === order.length - 1
        ? undefined
        : drawSolids(
            scene,
            view,
            placedSolids(
              scene,
              offsets((m) => m <= n),
            ),
          ).primitives;
    return {
      // Projection is linear, so a part's 3D offset projects to its shift on the page.
      moves: moving.map((e) => ({
        partId: e.partId,
        instance: e.instance,
        by: project(view, e.offset),
      })),
      from: clearOfJoints(start, moving),
      ...(primitives ? { primitives } : {}),
    };
  });
}

/** How much two boxes must share in every direction to count as one sitting in the other. */
const JOINED = 1e-6;

/**
 * The fraction of a stage at which its parts have left every part they sit in, judged by boxes
 * around the solids: a tenon in its mortise, a panel in its groove, a part in its dado. Parts
 * that only touch are not joined.
 */
function clearOfJoints(
  solids: readonly { solid: Solid; ref: PartRef }[],
  moving: readonly Explode[],
): number {
  const boxes = solids.map(({ solid: s, ref }) => {
    const points = s.faces.flatMap((f) => f.points);
    const axis = (k: 'x' | 'y' | 'z') => [
      Math.min(...points.map((p) => p[k])),
      Math.max(...points.map((p) => p[k])),
    ];
    const offset = moving.find(
      (e) => e.partId === ref.partId && e.instance === ref.instance,
    )?.offset;
    return { box: { x: axis('x'), y: axis('y'), z: axis('z') }, offset };
  });
  let from = 0;
  for (const a of boxes) {
    if (!a.offset) continue;
    for (const b of boxes) {
      if (a === b) continue;
      const by = sub(a.offset, b.offset ?? { x: 0, y: 0, z: 0 });
      const shared = (['x', 'y', 'z'] as const).map((k) => {
        const [a0, a1] = a.box[k] as [number, number];
        const [b0, b1] = b.box[k] as [number, number];
        return { k, depth: Math.min(a1, b1) - Math.max(a0, b0) };
      });
      if (shared.some((s) => s.depth <= JOINED)) continue;
      // They part when the first direction they share stops being shared.
      const apart = Math.min(
        ...shared.map((s) => (Math.abs(by[s.k]) > EPS ? s.depth / Math.abs(by[s.k]) : Infinity)),
      );
      if (Number.isFinite(apart)) from = Math.max(from, apart);
    }
  }
  return Math.min(1, from);
}

/** What one assembly step shows (#118): the parts it adds and the parts already built. */
export interface Action {
  /** Part IDs the step adds: drawn tinted, each moved by its `explode` offset if it has one. */
  added: ReadonlySet<string>;
  /** Part IDs built in earlier steps: drawn in place, in their face tones. */
  built: ReadonlySet<string>;
  /** How far the template pulls each instance apart, as for the exploded view. */
  explode: readonly Explode[];
}

/**
 * An action drawing (Stage 5, "Drawings in Building mode"; Agrawala et al. 2003): only the parts
 * built so far and the parts the step adds. An added part the template pulls apart is drawn away
 * from where it goes, with a motion arrow back to it. Parts not built yet, and phantom lines such
 * as chains, are left out. Added
 * parts are the drawing's emphasis, tinted and outlined heavily by the renderer.
 */
export function actionView(
  scene: Scene,
  view: Isometric,
  action: Action,
  description: string,
  title: string,
): Drawing {
  const shown = (pl: Placement) => action.added.has(pl.partId) || action.built.has(pl.partId);
  const offsetOf = (pl: Placement) =>
    action.added.has(pl.partId)
      ? action.explode.find((e) => e.partId === pl.partId && e.instance === pl.instance)?.offset
      : undefined;
  // Phantoms are things not built, such as chains hung from a part not there yet: left out.
  const partial: Scene = { ...scene, placements: scene.placements.filter(shown), phantoms: [] };
  const solids = placedSolids(partial, offsetOf);
  const { primitives, faces } = drawSolids(partial, view, solids);
  const arrows = partial.placements.flatMap((pl): Primitive[] => {
    const offset = offsetOf(pl);
    const part = scene.parts.find((p) => p.id === pl.partId);
    if (!offset || !part) return [];
    const home = solidCentroid(solid(part, pl));
    return [
      {
        kind: 'line',
        role: 'guideline',
        points: [project(view, add(home, offset)), project(view, home)],
        arrows: 'end',
        part: refFor(scene, pl),
      },
    ];
  });
  const all = [...primitives, ...arrows, ...letters(faces, primitives)];
  return {
    title,
    description,
    bounds: boundsOf(all, 2),
    primitives: all,
    notes: [],
    emphasis: [...action.added],
  };
}

function placedSolids(
  scene: Scene,
  offsetOf: (pl: Placement) => Vec3 | undefined = () => undefined,
): { solid: Solid; ref: PartRef }[] {
  return scene.placements.flatMap((pl) => {
    const part = scene.parts.find((p) => p.id === pl.partId);
    if (!part) return [];
    return [{ solid: solid(part, pl, offsetOf(pl)), ref: refFor(scene, pl) }];
  });
}

/**
 * Where a section plane cuts a part instance, as polygons in 3D. The plane must contain the
 * part's through direction, cutting across its thickness, or be parallel to its faces; a part
 * cut at another angle is refused. A part the plane misses gives none.
 */
export function sectionCuts(part: Part, pl: Placement, plane: SectionPlane): Vec3[][] {
  const T = part.stock.thickness;
  const N = plane.normal;
  const a = dot(pl.along, N);
  const b = dot(pl.across, N);
  const c = dot(pl.through, N);
  const d = -dot(sub(pl.origin, plane.point), N);
  const world = (u: number, v: number, n: number) =>
    add(add(add(pl.origin, scale(pl.along, u)), scale(pl.across, v)), scale(pl.through, n));
  const outline = partOutline(part);
  if (Math.abs(c) < 1e-9) {
    // The plane meets the face in the line a·u + b·v = d: pair its crossings with the outline.
    const f = (p: UV) => a * p.u + b * p.v - d;
    const dir = { u: -b, v: a };
    const along = (p: UV) => p.u * dir.u + p.v * dir.v;
    const crossings: UV[] = [];
    outline.forEach((p, i) => {
      const q = outline[(i + 1) % outline.length] as UV;
      const fp = f(p);
      const fq = f(q);
      if (fp < 0 !== fq < 0) {
        const t = fp / (fp - fq);
        crossings.push({ u: p.u + (q.u - p.u) * t, v: p.v + (q.v - p.v) * t });
      }
    });
    crossings.sort((x, y) => along(x) - along(y));
    const cuts: Vec3[][] = [];
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const p = crossings[i] as UV;
      const q = crossings[i + 1] as UV;
      cuts.push([world(p.u, p.v, 0), world(q.u, q.v, 0), world(q.u, q.v, T), world(p.u, p.v, T)]);
    }
    return cuts;
  }
  if (Math.abs(a) < 1e-9 && Math.abs(b) < 1e-9) {
    const n = d / c;
    if (n <= 0 || n >= T) return [];
    return convexPieces(outline).map((piece) => piece.points.map((p) => world(p.u, p.v, n)));
  }
  throw new Error(`a section plane cuts ${part.id} at an angle; only square sections are drawn`);
}

/** Chained dimensions along the page between projected points, on one side of the drawing. */
export interface DimensionChain {
  points: readonly Vec3[];
  /** Below or above the drawing for horizontal chains, left or right for vertical ones. */
  side: 'below' | 'above' | 'left' | 'right';
  /** Distance from the drawing's edge to the dimension line, in inches at the drawing's scale. */
  offset: number;
}

function chains(
  view: Isometric,
  list: readonly DimensionChain[],
  box: Drawing['bounds'],
): Primitive[] {
  return list.flatMap((chain) => {
    const page = chain.points.map((p) => project(view, p));
    const horizontal = chain.side === 'below' || chain.side === 'above';
    const sorted = [...page].sort((p, q) => (horizontal ? p.x - q.x : p.y - q.y));
    const line =
      chain.side === 'below'
        ? box.y + box.height + chain.offset
        : chain.side === 'above'
          ? box.y - chain.offset
          : chain.side === 'left'
            ? box.x - chain.offset
            : box.x + box.width + chain.offset;
    const out: Primitive[] = [];
    for (const p of sorted) {
      out.push({
        kind: 'line',
        role: 'extension',
        points: horizontal ? [p, { x: p.x, y: line }] : [p, { x: line, y: p.y }],
      });
    }
    for (let i = 0; i + 1 < sorted.length; i++) {
      const p = sorted[i] as Point2;
      const q = sorted[i + 1] as Point2;
      const span = horizontal ? q.x - p.x : q.y - p.y;
      if (span < 1e-9) continue;
      const from = horizontal ? { x: p.x, y: line } : { x: line, y: p.y };
      const to = horizontal ? { x: q.x, y: line } : { x: line, y: q.y };
      out.push({ kind: 'line', role: 'dimension', points: [from, to], arrows: true });
      out.push({
        kind: 'text',
        role: 'dimension',
        at: horizontal
          ? { x: (p.x + q.x) / 2, y: line }
          : { x: line + (chain.side === 'right' ? 0.3 : -0.3), y: (p.y + q.y) / 2 },
        ...(horizontal ? { side: chain.side === 'below' ? 'below' : 'above' } : {}),
        span: [from, to],
        text: formatLength(span),
        anchor: horizontal ? 'middle' : chain.side === 'right' ? 'start' : 'end',
      });
    }
    return out;
  });
}

/**
 * An elevation (#302): the model seen straight from one side with `orthographic`, faces toned by
 * which way they point, part letters, and chained dimensions the template asks for. Edges hidden
 * behind other parts are not drawn.
 */
export function elevationView(
  scene: Scene,
  view: Isometric,
  description: string,
  title: string,
  dimensions: readonly DimensionChain[] = [],
): Drawing {
  const { primitives, faces } = drawSolids(scene, view, placedSolids(scene));
  const box = boundsOf(primitives);
  const dims = chains(view, dimensions, box);
  const all = [...primitives, ...dims, ...letters(faces, primitives, dims)];
  return { title, description, bounds: boundsOf(all, 2), primitives: all, notes: [] };
}

/**
 * A section (#302): an elevation of what lies behind a plane, with the faces the plane cuts drawn
 * in section lining over everything else, since they are nearest.
 */
export function sectionView(
  scene: Scene,
  view: Isometric,
  plane: SectionPlane,
  description: string,
  title: string,
  dimensions: readonly DimensionChain[] = [],
): Drawing {
  const { primitives, faces } = drawSolids(scene, view, placedSolids(scene), plane);
  const cuts = scene.placements.flatMap((pl): Primitive[] => {
    const part = scene.parts.find((p) => p.id === pl.partId);
    if (!part) return [];
    return sectionCuts(part, pl, plane).map((points) => ({
      kind: 'polygon',
      role: 'visible',
      points: points.map((p) => project(view, p)),
      fill: 'section',
      part: refFor(scene, pl),
    }));
  });
  const drawn = [...primitives, ...cuts];
  const box = boundsOf(drawn);
  const dims = chains(view, dimensions, box);
  const all = [...drawn, ...dims, ...letters(faces, drawn, dims)];
  return { title, description, bounds: boundsOf(all, 2), primitives: all, notes: [] };
}
