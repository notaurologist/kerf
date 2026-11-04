import {
  type Mortise,
  type Part,
  type PartStock,
  type Placement,
  type StripGlueUp,
  stripGlueUp,
  type Tenon,
  type Vec3,
} from '@kerf/core';
import type { PlacedPart } from '../../boltedLap.ts';
import { compare } from '../../compare.ts';
import { housingPlane, sideEntered } from '../../housedEnd.ts';
import { mortiseAndTenon, type TenonSize, throughTenon } from '../../joinery.ts';
import { type Member, type Plane, trim } from '../../trim.ts';
import type { WorkbenchParams } from './params.ts';

// The workbench's base, joint-first (docs/templates/workbench.md, Parts and their joints): the top,
// the four legs on two feet, the end rails under the top, and the low rails. The template says
// where each part stands and how big each joint is; the joints give every length, end cut,
// placement, mortise, and tenon.

const X: Vec3 = { x: 1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };
const minus = (v: Vec3): Vec3 => ({ x: -v.x, y: -v.y, z: -v.z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

const SQUARE = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };

interface Base {
  parts: Part[];
  placements: Placement[];
  /** z_u, the top's underside; L_b and D_b, the base outside the legs; the legs' visible length. */
  geometry: { underside: number; baseLength: number; baseDepth: number; legVisible: number };
}

type Made = { ok: true; base: Base } | { ok: false; message: string };

/** Thrown inside `base` and returned as its refusal. */
class Refusal extends Error {}
/** A joint's result, or its refusal thrown as the base's. */
function ok<R extends { ok: true } | { ok: false; message: string }>(
  made: R,
): Extract<R, { ok: true }> {
  if (!made.ok) throw new Refusal(made.message);
  return made as Extract<R, { ok: true }>;
}

/**
 * The base. `topMovement` is how far the top moves across its depth between the front and back
 * legs, from the movement estimate; the back legs' mortises are lengthened by it toward the back.
 * Without it they are not, and the plan says the movement is input needed.
 */
export function base(p: WorkbenchParams, topMovement?: number): Made {
  try {
    return { ok: true, base: build(p, topMovement) };
  } catch (e) {
    if (e instanceof Refusal) return { ok: false, message: e.message };
    throw e;
  }
}

function build(p: WorkbenchParams, topMovement: number | undefined): Base {
  const s = p.legSize;
  const underside = p.height - p.topThickness;
  const baseLength = p.topLength - 2 * p.overhangEnds;
  const baseDepth = p.topDepth - p.overhangFront - p.overhangBack;
  const legX = [p.overhangEnds, p.overhangEnds + baseLength - s] as const;
  const legY = [p.overhangFront, p.overhangFront + baseDepth - s] as const;

  const strips = (
    thickness: number,
    width: number,
    length: number,
    stackedAcross: StripGlueUp['stackedAcross'],
  ): StripGlueUp => {
    const made = stripGlueUp({
      thickness,
      width,
      length,
      stackedAcross,
      board: p.board,
      allowances: p.allowances,
      kerf: p.kerf,
    });
    if (!made.ok) throw new Refusal(made.issue.message);
    return made.stock;
  };

  const top: PlacedPart = {
    part: blank(
      'top',
      'Top',
      strips(p.topThickness, p.topDepth, p.topLength, 'width'),
      p.topLength,
    ),
    placement: frame('top', 0, { x: 0, y: 0, z: underside }, X, Y, Z),
  };

  // Each foot runs front to back under its two legs, as wide as a leg, from the floor.
  // Square parts are strips lying flat; the top's stand on edge.
  const footStock = (length: number) => strips(p.footHeight, s, length, 'thickness');
  const legStock = (length: number) => strips(s, s, length, 'thickness');
  const railStock = (height: number) => (length: number) =>
    strips(p.railThickness, height, length, 'thickness');
  const feet = legX.map((x, k) =>
    cut(
      'foot',
      k,
      footStock,
      { along: Y, across: minus(X), through: Z, referenceEdge: { x: x + s, y: 0, z: 0 }, width: s },
      [plane(legY[0] - p.footPast, Y), plane(legY[1] + s + p.footPast, Y)],
    ),
  );

  // Legs stand on their feet and run up through the top. Each is placed so its two mortised faces
  // are its far face and far edge, which makes the front left and back right legs one part and
  // the other two its mirror (a placement is right-handed).
  const legFrames = [
    { id: 'leg-a', foot: 0, across: X, through: Y, corner: { x: legX[0], y: legY[0] } },
    { id: 'leg-b', foot: 1, across: Y, through: minus(X), corner: { x: legX[1] + s, y: legY[0] } },
    { id: 'leg-b', foot: 0, across: minus(Y), through: X, corner: { x: legX[0], y: legY[1] + s } },
    {
      id: 'leg-a',
      foot: 1,
      across: minus(X),
      through: minus(Y),
      corner: { x: legX[1] + s, y: legY[1] + s },
    },
  ] as const;
  const instances = new Map<string, number>();
  const legs = legFrames.map((f) => {
    const instance = instances.get(f.id) ?? 0;
    instances.set(f.id, instance + 1);
    const foot = feet[f.foot] as PlacedPart;
    return cut(
      f.id,
      instance,
      legStock,
      {
        along: Z,
        across: f.across,
        through: f.through,
        referenceEdge: { ...f.corner, z: 0 },
        width: s,
      },
      [housingPlane(foot, 'far', p.legTenon.footLength), housingPlane(top, 'near', p.topThickness)],
    );
  });

  /** A leg's tenon, centered, its long side running `long` and its thickness square to it. */
  const legTenon = (leg: PlacedPart, long: Vec3): TenonSize => {
    const { thickness: t, shoulder } = p.legTenon;
    const wide = { at: shoulder, size: s - 2 * shoulder };
    const thin = { at: (s - t) / 2, size: t };
    const [v, n] = Math.abs(dot(leg.placement.across, long)) > 0.5 ? [wide, thin] : [thin, wide];
    return { v0: v.at, width: v.size, n0: n.at, thickness: n.size };
  };

  const features = new Features();
  for (const [k, leg] of legs.entries()) {
    const back = k >= 2;
    const intoTop = ok(
      throughTenon({
        mortised: top,
        tenoned: leg,
        end: 1,
        tenon: legTenon(leg, X),
        withPart: 'leg',
        ...(back && topMovement !== undefined ? { lengthen: { toward: Y, by: topMovement } } : {}),
      }),
    );
    const foot = feet[legFrames[k]?.foot ?? 0] as PlacedPart;
    const intoFoot = ok(
      mortiseAndTenon({
        mortised: foot,
        tenoned: leg,
        end: 0,
        depth: p.legTenon.footLength,
        tenon: legTenon(leg, Y),
        withPart: 'leg',
      }),
    );
    features.add(top, { mortises: [intoTop.mortise] });
    features.add(foot, { mortises: [intoFoot.mortise] });
    features.add(leg, { tenons: [intoFoot.tenon, intoTop.tenon] });
  }

  /** A rail between two legs, centered on them, its tenons from the rail tenon sizes. */
  const rail = (
    id: string,
    instance: number,
    height: number,
    member: Omit<Member, 'width'>,
    between: readonly [PlacedPart, PlacedPart],
  ) => {
    const { length, thickness, shoulder } = p.railTenon;
    const ends = between.map((leg, end) => {
      const toward = end === 0 ? minus(member.along) : member.along;
      const side = sideEntered(leg, toward);
      if (!side) throw new Refusal(`The ${id} does not meet its leg square.`);
      return housingPlane(leg, side, length);
    }) as [Plane, Plane];
    const made = cut(id, instance, railStock(height), { ...member, width: height }, ends);
    const tenon = {
      v0: shoulder,
      width: height - 2 * shoulder,
      n0: (p.railThickness - thickness) / 2,
      thickness,
    };
    const joints = between.map((leg, end) =>
      ok(
        mortiseAndTenon({ mortised: leg, tenoned: made, end: end as 0 | 1, depth: length, tenon }),
      ),
    );
    features.add(made, { tenons: joints.map((j) => j.tenon) });
    for (const [end, leg] of between.entries()) {
      features.add(leg, { mortises: [(joints[end] as { mortise: Mortise }).mortise] });
    }
    return made;
  };

  const [frontLeft, frontRight, backLeft, backRight] = legs as [
    PlacedPart,
    PlacedPart,
    PlacedPart,
    PlacedPart,
  ];
  const half = p.railThickness / 2;
  const endRailZ = underside - p.endRailHeight;
  const endRails = [
    [legX[0], frontLeft, backLeft],
    [legX[1], frontRight, backRight],
  ].map(([x, front, back], k) =>
    rail(
      'end-rail',
      k,
      p.endRailHeight,
      {
        along: Y,
        across: Z,
        through: X,
        referenceEdge: { x: (x as number) + s / 2 - half, y: 0, z: endRailZ },
      },
      [front as PlacedPart, back as PlacedPart],
    ),
  );
  const lowRails = [
    [legY[0], frontLeft, frontRight],
    [legY[1], backLeft, backRight],
  ].map(([y, left, right], k) =>
    rail(
      'low-rail',
      k,
      p.lowRailHeight,
      {
        along: X,
        across: Z,
        through: minus(Y),
        referenceEdge: { x: 0, y: (y as number) + s / 2 + half, z: p.footHeight },
      },
      [left as PlacedPart, right as PlacedPart],
    ),
  );

  const placed = [top, ...feet, ...legs, ...endRails, ...lowRails];
  return {
    parts: features.parts(placed),
    placements: placed.map((q) => q.placement),
    geometry: {
      underside,
      baseLength,
      baseDepth,
      legVisible: underside - p.footHeight,
    },
  };
}

/** A part with no features yet, square at both ends. */
function blank(id: string, name: string, stock: PartStock, length: number): Part {
  return {
    id,
    letter: '',
    name,
    role: id,
    stock,
    quantity: 1,
    length,
    markLengths: [],
    ends: [SQUARE, SQUARE],
    endsParallel: true,
    notes: [],
    selection: ['structural'],
    referenceEdge: 'edge',
    holes: [],
    boltAreas: [],
    tapers: [],
    dadoes: [],
    notches: [],
    cutouts: [],
    mortises: [],
    tenons: [],
    dovetails: [],
    screwHoles: [],
    grooves: [],
    rabbets: [],
    recesses: [],
    boredHoles: [],
    hingePlates: [],
  };
}

const NAMES: Record<string, string> = {
  foot: 'Foot',
  'leg-a': 'Leg, front left and back right',
  'leg-b': 'Leg, front right and back left',
  'end-rail': 'End rail',
  'low-rail': 'Low rail',
};

/** Both legs are a leg, so the joints into the top and feet name them by it. */
const ROLES: Record<string, string> = { 'leg-a': 'leg', 'leg-b': 'leg' };

function frame(
  id: string,
  instance: number,
  origin: Vec3,
  along: Vec3,
  across: Vec3,
  through: Vec3,
): Placement {
  return { partId: id, instance, origin, along, across, through };
}

function plane(at: number, normal: Vec3): Plane {
  return { point: { x: normal.x * at, y: normal.y * at, z: normal.z * at }, normal };
}

/**
 * A part trimmed square to a plane at each end, its length and placement from the trim, and its
 * stock made for that length.
 */
function cut(
  id: string,
  instance: number,
  stock: (length: number) => PartStock,
  member: Member,
  planes: [Plane, Plane],
): PlacedPart {
  const trimmed = trim(member, planes);
  if (!trimmed.ok) throw new Refusal(`${id} ${instance}, end ${trimmed.end}: ${trimmed.message}`);
  return {
    part: {
      ...blank(id, NAMES[id] ?? id, stock(trimmed.length), trimmed.length),
      role: ROLES[id] ?? id,
    },
    placement: frame(id, instance, trimmed.origin, member.along, member.across, member.through),
  };
}

/**
 * Each instance's features, gathered as its joints are made. Every instance of a part must come
 * out with the same features, since they share one cut-list line; one that differs is a template
 * error, not a refusal.
 */
class Features {
  private readonly found = new Map<string, Map<number, { mortises: Mortise[]; tenons: Tenon[] }>>();

  add(piece: PlacedPart, more: { mortises?: Mortise[]; tenons?: Tenon[] }) {
    const { partId, instance } = piece.placement;
    const byInstance = this.found.get(partId) ?? new Map();
    this.found.set(partId, byInstance);
    const held = byInstance.get(instance) ?? { mortises: [], tenons: [] };
    byInstance.set(instance, held);
    held.mortises.push(...(more.mortises ?? []));
    held.tenons.push(...(more.tenons ?? []));
  }

  /** One part per ID, with its features, quantity, and stock. */
  parts(placed: readonly PlacedPart[]): Part[] {
    const ids = [...new Set(placed.map((q) => q.placement.partId))];
    return ids.map((id) => {
      const all = placed.filter((q) => q.placement.partId === id);
      const first = all[0] as PlacedPart;
      const byInstance = this.found.get(id);
      const held = byInstance?.get(0) ?? { mortises: [], tenons: [] };
      for (const q of all) {
        const other = byInstance?.get(q.placement.instance) ?? { mortises: [], tenons: [] };
        const differ = compare(held, other);
        if (differ.length > 0) {
          throw new Error(`${id} ${q.placement.instance} differs from ${id} 0: ${differ[0]?.path}`);
        }
      }
      return { ...first.part, quantity: all.length, ...held };
    });
  }
}
