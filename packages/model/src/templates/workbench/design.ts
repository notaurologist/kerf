import {
  type Dado,
  type Dovetails,
  drawerBox,
  type EdgeRabbet,
  type Mortise,
  type Notch,
  type Part,
  type PartStock,
  type Placement,
  panelStock,
  type StripGlueUp,
  stripGlueUp,
  type Tenon,
  type Vec3,
} from '@kerf/core';
import type { PlacedPart } from '../../boltedLap.ts';
import { compare } from '../../compare.ts';
import { housedEnd, housingPlane, sideEntered } from '../../housedEnd.ts';
import {
  mortiseAndTenon,
  panelInFaces,
  type TenonSize,
  throughDovetails,
  throughTenon,
} from '../../joinery.ts';
import { type Member, type Plane, trim } from '../../trim.ts';
import type { WorkbenchParams } from './params.ts';

// The workbench, joint-first (docs/templates/workbench.md, Parts and their joints): the top, the
// four legs on two feet, the end rails under the top, and the low rails; then the case between the
// legs, its sides housed in its bottom, three drawer shelves in the sides, the divider in the
// shelves, and the back floating in grooves. The template says
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
  geometry: {
    underside: number;
    baseLength: number;
    baseDepth: number;
    legVisible: number;
    caseInside: number;
    upperOpenings: number;
    lowerOpening: number;
  };
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
export function base(p: WorkbenchParams, topMovement?: number, backGap = MOVEMENT_GAP): Made {
  try {
    return { ok: true, base: build(p, topMovement, backGap) };
  } catch (e) {
    if (e instanceof Refusal) return { ok: false, message: e.message };
    throw e;
  }
}

/**
 * A floating panel's gap across its grain, at the case back's edges and the drawer bottoms' fronts,
 * until the movement estimate gives one; and along it, 1/32, as for any floating panel (DOMAIN.md,
 * Joints that let wood move).
 */
const MOVEMENT_GAP = 0.125;
const END_GAP = 1 / 32;

function build(p: WorkbenchParams, topMovement: number | undefined, backGap: number): Base {
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

  // The case, between the legs, on the low rails and under the top.
  const t = p.caseThickness;
  const j = p.dadoDepth;
  const panel =
    (width: number, thickness = t) =>
    (length: number) => {
      const made = panelStock({
        thickness,
        width,
        length,
        board: p.board,
        allowances: p.allowances,
      });
      if (!made.ok) throw new Refusal(made.issue.message);
      return made.stock;
    };
  const between = (left: PlacedPart, right: PlacedPart, depth = 0): [Plane, Plane] => [
    housingPlane(left, sideOf(left, minus(X)), depth),
    housingPlane(right, sideOf(right, X), depth),
  ];
  const caseBottom = cut(
    'case-bottom',
    0,
    panel(baseDepth),
    {
      along: X,
      across: Y,
      through: Z,
      referenceEdge: { x: 0, y: legY[0], z: p.footHeight + p.lowRailHeight },
      width: baseDepth,
    },
    between(frontLeft, frontRight),
  );
  const underTop = housingPlane(top, 'near', 0);
  const inBottom = housingPlane(caseBottom, 'far', j);
  // Sides stand with their inside faces near, so the left runs up and the right down.
  const sides = [
    cut(
      'case-side-left',
      0,
      panel(baseDepth),
      {
        along: Z,
        across: Y,
        through: minus(X),
        referenceEdge: { x: legX[0] + s + t, y: legY[0], z: 0 },
        width: baseDepth,
      },
      [inBottom, underTop],
    ),
    cut(
      'case-side-right',
      0,
      panel(baseDepth),
      {
        along: minus(Z),
        across: Y,
        through: X,
        referenceEdge: { x: legX[1] - t, y: legY[0], z: 0 },
        width: baseDepth,
      },
      [underTop, inBottom],
    ),
  ] as const;
  for (const [k, side] of sides.entries()) {
    const housed = ok(
      housedEnd({ housing: caseBottom, housed: side, end: k === 0 ? 0 : 1, depth: j }),
    );
    features.add(caseBottom, { dadoes: [housed.dado] });
  }

  // Drawer shelves: under the top, between the rows, and above the doors, each housed at both
  // ends in stopped dadoes in the sides. The upper runs to the back edge to hold the back's groove;
  // the others stop short of the back.
  const backMiddle = legY[0] + baseDepth - p.back.inset - p.back.grooveWidth / 2;
  const shortDepth = backMiddle - t / 2 - p.back.shelfGap - legY[0];
  const lowerOpening = p.drawerBand - 3 * t - p.upperOpening;
  const shelfTops = [
    underside,
    underside - t - p.upperOpening,
    underside - 2 * t - p.upperOpening - lowerOpening,
  ];
  const shelfIds = ['shelf-upper', 'shelf-middle', 'shelf-lower'];
  const shelves = shelfTops.map((zTop, k) => {
    const depth = k === 0 ? baseDepth : shortDepth;
    const shelf = cut(
      shelfIds[k] as string,
      0,
      panel(depth),
      {
        along: X,
        across: Y,
        through: Z,
        referenceEdge: { x: 0, y: legY[0], z: zTop - t },
        width: depth,
      },
      [housingPlane(sides[0], 'near', j), housingPlane(sides[1], 'near', j)],
    );
    for (const [end, side] of sides.entries()) {
      const housed = ok(
        housedEnd({
          housing: side,
          housed: shelf,
          end: end as 0 | 1,
          depth: j,
          stop: p.stopSetback,
        }),
      );
      features.add(side, { dadoes: [housed.dado] });
      if (housed.notch) features.add(shelf, { notches: [housed.notch] });
    }
    return shelf;
  });
  const [upper, middle] = shelves as [PlacedPart, PlacedPart, PlacedPart];

  // The divider stands between the upper drawers, centered, housed in the shelves above and below.
  const caseMiddle = (legX[0] + s + legX[1]) / 2;
  const divider = cut(
    'divider',
    0,
    panel(shortDepth),
    {
      along: Z,
      across: Y,
      through: minus(X),
      referenceEdge: { x: caseMiddle + t / 2, y: legY[0], z: 0 },
      width: shortDepth,
    },
    [housingPlane(middle, 'far', j), housingPlane(upper, 'near', j)],
  );
  for (const [end, shelf] of [middle, upper].entries()) {
    const housed = ok(
      housedEnd({
        housing: shelf,
        housed: divider,
        end: end as 0 | 1,
        depth: j,
        stop: p.stopSetback,
      }),
    );
    features.add(shelf, { dadoes: [housed.dado] });
    if (housed.notch) features.add(divider, { notches: [housed.notch] });
  }

  // The back floats in grooves in the case bottom, the upper shelf, and both sides, grain up.
  const back = ok(
    panelInFaces({
      frame: [
        { ...caseBottom, face: 'far' },
        { ...upper, face: 'near' },
        { ...sides[0], face: 'near' },
        { ...sides[1], face: 'near' },
      ],
      groove: { width: p.back.grooveWidth, depth: p.back.grooveDepth },
      panel: { id: 'case-back', thickness: t, along: Z, across: X, through: Y },
      middle: backMiddle,
      gaps: { ends: END_GAP, edges: backGap },
    }),
  );
  for (const { partId, dado } of back.dadoes) {
    const holder = [caseBottom, upper, ...sides].find((q) => q.part.id === partId) as PlacedPart;
    features.add(holder, { dadoes: [dado] });
  }
  const caseBack: PlacedPart = {
    part: {
      ...blank('case-back', 'Case back', panel(back.width)(back.length), back.length),
      rabbets: back.rabbets,
    },
    placement: frame('case-back', 0, back.origin, Z, X, Y),
  };

  // The drawers, each in the opening between the faces of the parts around it.
  const at = (q: PlacedPart, side: 'near' | 'far', axis: Vec3) =>
    dot(housingPlane(q, side, 0).point, axis);
  const lower = shelves[2] as PlacedPart;
  const openings = {
    left: at(sides[0], 'near', X),
    right: at(sides[1], 'near', X),
    dividerLeft: at(divider, 'far', X),
    dividerRight: at(divider, 'near', X),
    upper: [at(middle, 'far', Z), at(upper, 'near', Z)] as const,
    lower: [at(lower, 'far', Z), at(middle, 'near', Z)] as const,
  };
  const backFront = backMiddle - t / 2;
  const d = p.drawer;
  const b = d.boxThickness;

  const drawer = (
    prefix: string,
    instance: number,
    [x0, x1]: readonly [number, number],
    [z0, z1]: readonly [number, number],
  ): PlacedPart[] => {
    const id = (part: string) => `${prefix}-${part}`;
    const g = d.frontGap;
    // The inset front, flush with the case front, its show face at y = 0.
    const frontLength = x1 - x0 - 2 * g;
    const front: PlacedPart = {
      part: blank(
        id('front'),
        '',
        panel(z1 - z0 - 2 * g, d.frontThickness)(frontLength),
        frontLength,
      ),
      placement: frame(
        id('front'),
        instance,
        { x: x0 + g, y: legY[0] + d.frontThickness, z: z0 + g },
        X,
        Z,
        minus(Y),
      ),
    };
    // The box, behind the front, as wide and deep as the slides allow.
    const sized = drawerBox(
      { width: x1 - x0, depth: backFront - legY[0] - d.frontThickness },
      p.slides,
      'slides',
    );
    if (sized.status === 'refused') throw new Refusal(sized.issues[0]?.message ?? 'No box fits.');
    if (sized.status === 'input-needed') throw new Refusal('The slides’ figures are needed.');
    const { width: w, depth } = sized.size;
    const bx0 = x0 + (x1 - x0 - w) / 2;
    const by0 = legY[0] + d.frontThickness;
    const bz0 = z0 + d.clearance;
    const h = z1 - z0 - 2 * d.clearance;
    const acrossBox: [Plane, Plane] = [plane(bx0, X), plane(bx0 + w, X)];
    const alongBox: [Plane, Plane] = [plane(by0, Y), plane(by0 + depth, Y)];
    // The back stands on the bottom's groove, so the bottom slides in under it.
    const backUp = d.groove.up + d.groove.width;
    const boxFront = cut(
      id('box-front'),
      instance,
      panel(h, b),
      {
        along: X,
        across: Z,
        through: minus(Y),
        referenceEdge: { x: 0, y: by0 + b, z: bz0 },
        width: h,
      },
      acrossBox,
    );
    const boxBack = cut(
      id('box-back'),
      instance,
      panel(h - backUp, b),
      {
        along: X,
        across: Z,
        through: minus(Y),
        referenceEdge: { x: 0, y: by0 + depth, z: bz0 + backUp },
        width: h - backUp,
      },
      acrossBox,
    );
    const left = cut(
      id('side-left'),
      instance,
      panel(h, b),
      { along: Y, across: Z, through: X, referenceEdge: { x: bx0, y: 0, z: bz0 }, width: h },
      alongBox,
    );
    const right = cut(
      id('side-right'),
      instance,
      panel(h, b),
      {
        along: minus(Y),
        across: Z,
        through: minus(X),
        referenceEdge: { x: bx0 + w, y: 0, z: bz0 },
        width: h,
      },
      [alongBox[1], alongBox[0]],
    );
    // Tails on the sides, pins on the box front and back. The left side's first end is at the
    // front, the right side's at the back; the front and back run from left to right.
    const corners = [
      { tails: left, tailsEnd: 0, pins: boxFront, pinsEnd: 0 },
      { tails: left, tailsEnd: 1, pins: boxBack, pinsEnd: 0 },
      { tails: right, tailsEnd: 1, pins: boxFront, pinsEnd: 1 },
      { tails: right, tailsEnd: 0, pins: boxBack, pinsEnd: 1 },
    ] as const;
    for (const c of corners) {
      const made = ok(throughDovetails({ ...c, slope: d.slope }));
      features.add(c.tails, { dovetails: [made.tails] });
      features.add(c.pins, { dovetails: [made.pins] });
    }
    // The bottom, grain side to side, in grooves in the box front and sides, its top flush with
    // their upper walls, running on under the short back to its outside face.
    const bottom = ok(
      panelInFaces({
        frame: [
          { ...boxFront, face: 'near' },
          { ...left, face: 'far' },
          { ...right, face: 'far' },
        ],
        groove: { width: d.groove.width, depth: d.groove.depth },
        panel: { id: id('bottom'), thickness: d.bottomThickness, along: X, across: Y, through: Z },
        middle: bz0 + d.groove.up + d.groove.width / 2,
        gaps: { ends: END_GAP, edges: MOVEMENT_GAP },
        open: by0 + depth,
        flush: 'far',
      }),
    );
    for (const { partId, dado } of bottom.dadoes) {
      const holder = [boxFront, left, right].find((q) => q.part.id === partId) as PlacedPart;
      features.add(holder, { dadoes: [dado] });
    }
    const bottomPart: PlacedPart = {
      part: {
        ...blank(
          id('bottom'),
          '',
          panel(bottom.width, d.bottomThickness)(bottom.length),
          bottom.length,
        ),
        rabbets: bottom.rabbets,
      },
      placement: frame(id('bottom'), instance, bottom.origin, X, Y, Z),
    };
    return [front, boxFront, boxBack, left, right, bottomPart];
  };
  const drawers = [
    ...drawer('upper-drawer', 0, [openings.left, openings.dividerLeft], openings.upper),
    ...drawer('upper-drawer', 1, [openings.dividerRight, openings.right], openings.upper),
    ...drawer('lower-drawer', 0, [openings.left, openings.right], openings.lower),
  ];

  const placed = [
    top,
    ...feet,
    ...legs,
    ...endRails,
    ...lowRails,
    caseBottom,
    ...sides,
    ...shelves,
    divider,
    caseBack,
    ...drawers,
  ];
  return {
    parts: features.parts(placed),
    placements: placed.map((q) => q.placement),
    geometry: {
      underside,
      baseLength,
      baseDepth,
      legVisible: underside - p.footHeight,
      caseInside: legX[1] - legX[0] - s - 2 * t,
      upperOpenings: (legX[1] - legX[0] - s - 3 * t) / 2,
      lowerOpening,
    },
  };
}

/** The side of a part that another, running `toward`, meets square. */
function sideOf(part: PlacedPart, toward: Vec3) {
  const side = sideEntered(part, toward);
  if (!side) throw new Refusal(`The case does not meet the ${part.part.id} square.`);
  return side;
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
  'case-bottom': 'Case bottom',
  'case-side-left': 'Case side, left',
  'case-side-right': 'Case side, right',
  'shelf-upper': 'Drawer shelf, upper',
  'shelf-middle': 'Drawer shelf, middle',
  'shelf-lower': 'Drawer shelf, lower',
  divider: 'Drawer divider',
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
type Found = {
  mortises: Mortise[];
  tenons: Tenon[];
  dadoes: Dado[];
  notches: Notch[];
  rabbets: EdgeRabbet[];
  dovetails: Dovetails[];
};
const none = (): Found => ({
  mortises: [],
  tenons: [],
  dadoes: [],
  notches: [],
  rabbets: [],
  dovetails: [],
});

class Features {
  private readonly found = new Map<string, Map<number, Found>>();

  add(piece: PlacedPart, more: Partial<Found>) {
    const { partId, instance } = piece.placement;
    const byInstance = this.found.get(partId) ?? new Map<number, Found>();
    this.found.set(partId, byInstance);
    const held = byInstance.get(instance) ?? none();
    byInstance.set(instance, held);
    for (const key of Object.keys(held) as (keyof Found)[]) {
      (held[key] as unknown[]).push(...((more[key] as unknown[] | undefined) ?? []));
    }
  }

  /** One part per ID, with its features, quantity, and stock. */
  parts(placed: readonly PlacedPart[]): Part[] {
    const ids = [...new Set(placed.map((q) => q.placement.partId))];
    return ids.map((id) => {
      const all = placed.filter((q) => q.placement.partId === id);
      const first = all[0] as PlacedPart;
      const byInstance = this.found.get(id);
      const held = byInstance?.get(0) ?? none();
      for (const q of all) {
        const other = byInstance?.get(q.placement.instance) ?? none();
        const differ = compare(held, other);
        if (differ.length > 0) {
          throw new Error(`${id} ${q.placement.instance} differs from ${id} 0: ${differ[0]?.path}`);
        }
      }
      const kept = Object.fromEntries(
        (Object.keys(held) as (keyof Found)[]).map((key) => [
          key,
          [...first.part[key], ...held[key]],
        ]),
      );
      return { ...first.part, quantity: all.length, ...kept };
    });
  }
}
