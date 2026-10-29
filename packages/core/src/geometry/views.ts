import type { Part, Placement } from '../templates/types.ts';
import { signedArea2 } from './clip.ts';
import type { Drawing, PartRef, Point2, Primitive, Tone } from './primitives.ts';
import { boundsOf } from './primitives.ts';
import { depth, depthOnPlane, type Isometric, project } from './projection.ts';
import { type Solid, solid, solidCentroid } from './solid.ts';
import { add, dot, length, sub, type Vec3 } from './vec.ts';

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
}

/** A face, or a piece of one, in 3D. `edge[i]` says whether the edge from point i is real. */
interface Piece {
  points: Vec3[];
  edge: boolean[];
  normal: Vec3;
  tone: Tone;
  part: PartRef;
  solid: number;
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
  out.push(...node.here);
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

/** Draws solids: faces in paint order, hidden edges below grade, grade lines, phantoms. */
function drawSolids(
  scene: Scene,
  view: Isometric,
  solids: readonly { solid: Solid; ref: PartRef }[],
): { primitives: Primitive[]; faces: Drawn[] } {
  const ground = scene.ground;
  const above = (p: Vec3) => (ground ? dot(sub(p, ground.point), ground.up) : 1);
  const pieces: Piece[] = [];
  const lines: Primitive[] = [];
  solids.forEach(({ solid: s, ref }, index) => {
    for (const face of s.faces) {
      if (dot(face.normal, view.toViewer) <= EPS) continue;
      const whole: Piece = {
        points: face.points,
        edge: face.points.map(() => true),
        normal: face.normal,
        tone: tone(face.normal, scene.endAxis ?? 'x'),
        part: ref,
        solid: index,
      };
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

/**
 * Part letters (D2): one per part, its leader ending on the part's largest face that nothing
 * drawn later covers. Letters sit in a column on each side, sorted by height so leaders do not
 * cross.
 */
function letters(faces: readonly Drawn[], primitives: readonly Primitive[]): Primitive[] {
  const box = boundsOf(primitives);
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
  const column = (side: 'left' | 'right') => {
    const items = [...targets.values()]
      .filter((t) => (side === 'left' ? t.at.x < middle : t.at.x >= middle))
      .sort((a, b) => a.at.y - b.at.y);
    const x = side === 'left' ? box.x - gap : box.x + box.width + gap;
    let y = -Infinity;
    return items.map((t): Primitive => {
      y = Math.max(t.at.y, y + spacing);
      return { kind: 'letter', at: { x, y }, target: t.at, letter: t.part.letter, part: t.part };
    });
  };
  return [...column('left'), ...column('right')];
}

export function isometricView(
  scene: Scene,
  view: Isometric,
  description: string,
  title = 'Isometric view',
): Drawing {
  const solids = placedSolids(scene);
  const { primitives, faces } = drawSolids(scene, view, solids);
  const all = [...primitives, ...letters(faces, primitives)];
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
  return { title, description, bounds: boundsOf(all, 2), primitives: all, notes: [] };
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
