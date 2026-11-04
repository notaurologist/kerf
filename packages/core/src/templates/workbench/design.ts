import type { PlacedPart } from '../../joints/boltedLap.ts';
import { compare } from '../../joints/compare.ts';
import { housedEnd, housingPlane, sideEntered } from '../../joints/housedEnd.ts';
import {
  floatingPanel,
  mortiseAndTenon,
  panelInFaces,
  type TenonSize,
  tenonInGroove,
  throughDovetails,
  throughTenon,
} from '../../joints/joinery.ts';
import { type Member, type Plane, trim } from '../../joints/trim.ts';
import { type BoardStock, panelStock } from '../../lumber/panel.ts';
import type { PartStock } from '../../lumber/partStock.ts';
import { type StripGlueUp, stripGlueUp } from '../../lumber/strips.ts';
import { cupHingeIssues, cupHingeItem, cupHingePair } from '../../model/cupHinge.ts';
import { drawerBox } from '../../model/drawerSlide.ts';
import type {
  BoredHole,
  Dado,
  Dovetails,
  EdgeGroove,
  EdgeRabbet,
  HardwareItem,
  HingePlate,
  Mortise,
  Notch,
  Part,
  Placement,
  ScrewHole,
  Tenon,
  Vec3,
} from '../../model/types.ts';
import { type ViseScrew, viseHoles, viseScrewItem } from '../../model/viseScrew.ts';
import { formatLength } from '../../units/length.ts';
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
  /** The hardware the joints name, for now the doors' hinges. */
  hardware: HardwareItem[];
  /** z_u, the top's underside; L_b and D_b, the base outside the legs; the legs' visible length. */
  geometry: {
    underside: number;
    baseLength: number;
    baseDepth: number;
    legVisible: number;
    caseInside: number;
    upperOpenings: number;
    lowerOpening: number;
    /** Each drawer's slide length, by the drawer's ID prefix. */
    slides: Record<string, number>;
    /**
     * What each movement joint's room is sized across: the top between its front and back tenons,
     * and the case back, a drawer bottom, and a door panel between their grooves' bottoms (a drawer
     * bottom from its front groove to its free back edge).
     */
    spans: { tenons: number; back: number; bottom: number; doorPanel: number };
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
 * The room each wood-movement joint leaves (DOMAIN.md, Joints that let wood move): the back legs'
 * mortises in the top, left long toward the back; and the gap across the grain at each edge of the
 * case back and each door panel, and at the front of each drawer bottom. The review sizes them from
 * the movement estimate (`review.ts`); `ILLUSTRATIVE` is for building without one.
 */
export interface Gaps {
  topRoom?: number;
  backEdge: number;
  bottomFront: number;
  doorPanelEdge: number;
}
export const ILLUSTRATIVE: Gaps = { backEdge: 0.125, bottomFront: 0.125, doorPanelEdge: 0.125 };

/** The bench, with its movement joints sized by `gaps`. */
export function base(p: WorkbenchParams, gaps: Gaps = ILLUSTRATIVE): Made {
  try {
    return { ok: true, base: build(p, gaps) };
  } catch (e) {
    if (e instanceof Refusal) return { ok: false, message: e.message };
    throw e;
  }
}

/** A floating panel's gap along its grain, at each end, as for any (DOMAIN.md). */
const END_GAP = 1 / 32;

/** Hardwood lengths, 4 to 16 ft in 1-ft steps (Wood Handbook, ch. 6, p. 6-3). */
const DEALER_FEET = Array.from({ length: 13 }, (_, i) => i + 4);

/** The boards everything is cut and glued from, as the record cabinet's. */
export function boardStock(board: WorkbenchParams['board']): BoardStock {
  return board.source === 'store'
    ? {
        nominal: `${formatLength(board.thickness)} x ${formatLength(board.width)}`,
        thickness: board.thickness,
        width: board.width,
        buyableFeet: board.lengths,
      }
    : {
        nominal: `${board.quarters}/4 hardwood`,
        thickness: board.surfaced,
        width: board.planWidth,
        buyableFeet: DEALER_FEET,
        byBoardFoot: { nominalThickness: board.quarters / 4, waste: board.wastePercent / 100 },
      };
}

/** Wood screws that hold each drawer's front to its box, through the box front. */
export const FRONT_SCREWS = 'front-screws';
/** The wood screw up through each drawer bottom's slot into the box back. */
export const BOTTOM_SCREWS = 'bottom-screws';

function build(p: WorkbenchParams, gaps: Gaps): Base {
  // A floating panel stays in its grooves only while its gap is shallower than they are deep
  // (DOMAIN.md, Joints that let wood move).
  const shallow = (what: string, gap: number, depth: number) => {
    if (gap >= depth) {
      throw new Refusal(
        `The ${what} needs ${formatLength(gap)} at its edge for the wood's movement, as much as its ${formatLength(depth)} grooves are deep, so it would come out of them. Deepen the grooves or make it narrower.`,
      );
    }
  };
  shallow('case back', gaps.backEdge, p.back.grooveDepth);
  shallow('drawer bottoms', gaps.bottomFront, p.drawer.groove.depth);
  shallow('door panels', gaps.doorPanelEdge, p.door.grooveDepth);
  const board = boardStock(p.board);
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
      board,
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
    { id: 'leg-vise', foot: 0, across: X, through: Y, corner: { x: legX[0], y: legY[0] } },
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
        ...(back && gaps.topRoom !== undefined
          ? { lengthen: { toward: Y, by: gaps.topRoom } }
          : {}),
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
        board,
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
      gaps: { ends: END_GAP, edges: gaps.backEdge },
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
  const spans = {
    tenons: baseDepth - s,
    back: back.width + 2 * gaps.backEdge,
    bottom: 0,
    doorPanel: 0,
  };
  const slides: Record<string, number> = {};
  const d = p.drawer;
  const b = d.boxThickness;

  const drawer = (
    prefix: string,
    instance: number,
    [x0, x1]: readonly [number, number],
    [z0, z1]: readonly [number, number],
  ): PlacedPart[] => {
    const id = (part: string) => `${prefix}-${part}`;
    const label = prefix === 'upper-drawer' ? 'Upper' : 'Lower';
    const g = d.frontGap;
    // The inset front, flush with the case front, its show face at y = 0. A front within the
    // flattening allowance of its board keeps the board's thickness, so it is placed by its stock.
    const frontLength = x1 - x0 - 2 * g;
    const frontStock = panel(z1 - z0 - 2 * g, d.frontThickness)(frontLength);
    const ft = frontStock.thickness;
    const front: PlacedPart = {
      part: blank(id('front'), `${label} drawer front`, frontStock, frontLength),
      placement: frame(
        id('front'),
        instance,
        { x: x0 + g, y: legY[0] + ft, z: z0 + g },
        X,
        Z,
        minus(Y),
      ),
    };
    // The box, behind the front, as wide and deep as the slides allow.
    const sized = drawerBox(
      { width: x1 - x0, depth: backFront - legY[0] - ft },
      p.slides,
      'slides',
    );
    if (sized.status === 'refused') throw new Refusal(sized.issues[0]?.message ?? 'No box fits.');
    // Without the slides' figures, entered from their maker, no box can be sized yet: the front
    // is made, and the box waits for them.
    if (sized.status === 'input-needed') return [front];
    const { width: w, depth } = sized.size;
    slides[prefix] = sized.size.slideLength;
    const bx0 = x0 + (x1 - x0 - w) / 2;
    const by0 = legY[0] + ft;
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
        gaps: { ends: END_GAP, edges: gaps.bottomFront },
        open: by0 + depth,
        flush: 'far',
      }),
    );
    spans.bottom = Math.max(spans.bottom, bottom.width + gaps.bottomFront);
    // Two screws through the box front into the drawer front, a quarter of its length in from each
    // end, at its middle height.
    const boxLength = boxFront.part.length;
    features.add(boxFront, {
      screwHoles: [boxLength / 4, (3 * boxLength) / 4].map(
        (u): ScrewHole => ({ hardwareId: FRONT_SCREWS, u, v: h / 2, slot: 0, direction: 'along' }),
      ),
    });
    for (const { partId, dado } of bottom.dadoes) {
      const holder = [boxFront, left, right].find((q) => q.part.id === partId) as PlacedPart;
      features.add(holder, { dadoes: [dado] });
    }
    const bottomPart: PlacedPart = {
      part: {
        ...blank(
          id('bottom'),
          `${label} drawer bottom`,
          panel(bottom.width, d.bottomThickness)(bottom.length),
          bottom.length,
        ),
        rabbets: bottom.rabbets,
        // One screw up through the bottom into the middle of the back's lower edge, in a slot the
        // way the bottom moves, so it can move as far as its gap at the front.
        screwHoles: [
          {
            hardwareId: BOTTOM_SCREWS,
            u: bottom.length / 2,
            v: bottom.width - b / 2,
            slot: gaps.bottomFront,
            direction: 'across',
          },
        ],
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

  // Two inset doors under the drawers, each a frame of stiles and rails around a floating panel,
  // hung on the outer case sides. The right door is the left turned end for end about the front-
  // to-back axis, so the two are one set of parts.
  const door = p.door;
  const doorOpening = {
    x: [openings.left, openings.right] as const,
    z: [at(caseBottom, 'far', Z), at(lower, 'near', Z)] as const,
  };
  const dg = door.gap;
  const doorWidth = (doorOpening.x[1] - doorOpening.x[0] - 3 * dg) / 2;
  const doorHeight = doorOpening.z[1] - doorOpening.z[0] - 2 * dg;
  const one = panel(door.frameWidth, board.thickness)(doorHeight);
  const dt = one.thickness;
  if (doorWidth <= 2 * door.frameWidth || doorHeight <= 2 * door.frameWidth) {
    throw new Refusal(
      `Each door is ${formatLength(doorWidth)} by ${formatLength(doorHeight)}, too small for stiles and rails ${formatLength(door.frameWidth)} wide around a panel.`,
    );
  }
  const cups = door.hinge;
  if (cups && doorHeight < 2 * door.hingeFromEnd + cups.cupDiameter) {
    throw new Refusal(
      `Each door is ${formatLength(doorHeight)} tall, too short for two hinges ${formatLength(door.hingeFromEnd)} from its ends, whose cups are ${formatLength(cups.cupDiameter)} across.`,
    );
  }
  const center = {
    x: (doorOpening.x[0] + doorOpening.x[1]) / 2,
    z: (doorOpening.z[0] + doorOpening.z[1]) / 2,
  };
  const doors = [0, 1].flatMap((k) => {
    const turn = (v: Vec3): Vec3 => (k === 0 ? v : { x: -v.x, y: v.y, z: -v.z });
    const spot = (q: Vec3): Vec3 =>
      k === 0 ? q : { x: 2 * center.x - q.x, y: q.y, z: 2 * center.z - q.z };
    const x0 = doorOpening.x[0] + dg;
    const z0 = doorOpening.z[0] + dg;
    const member = (along: Vec3, across: Vec3, through: Vec3, corner: Vec3): Member => ({
      along: turn(along),
      across: turn(across),
      through: turn(through),
      referenceEdge: spot(corner),
      width: door.frameWidth,
    });
    const ends = (a: number, b: number): [Plane, Plane] => [
      { point: spot({ x: 0, y: 0, z: a }), normal: turn(Z) },
      { point: spot({ x: 0, y: 0, z: b }), normal: turn(Z) },
    ];
    const stileStock = (length: number) => panel(door.frameWidth, board.thickness)(length);
    const hinge = cut(
      'door-stile-hinge',
      k,
      stileStock,
      member(Z, X, Y, { x: x0, y: legY[0], z: 0 }),
      ends(z0, z0 + doorHeight),
    );
    const meeting = cut(
      'door-stile-meeting',
      k,
      stileStock,
      member(Z, minus(X), minus(Y), { x: x0 + doorWidth, y: legY[0] + dt, z: 0 }),
      ends(z0, z0 + doorHeight),
    );
    const railEnds = (): [Plane, Plane] => [
      housingPlane(hinge, 'far-edge', door.grooveDepth),
      housingPlane(meeting, 'far-edge', door.grooveDepth),
    ];
    const rails = [
      cut(
        'door-rail',
        2 * k,
        stileStock,
        member(X, Z, minus(Y), { x: 0, y: legY[0] + dt, z: z0 }),
        railEnds(),
      ),
      cut(
        'door-rail',
        2 * k + 1,
        stileStock,
        member(X, minus(Z), Y, { x: 0, y: legY[0], z: z0 + doorHeight }),
        railEnds(),
      ),
    ];
    // The panel, grain up, between the frame's groove bottoms less its gaps.
    const across = doorWidth - 2 * door.frameWidth + 2 * door.grooveDepth - 2 * gaps.doorPanelEdge;
    spans.doorPanel = across + 2 * gaps.doorPanelEdge;
    const panelPart = blank('door-panel', 'Door panel', panel(across)(doorHeight), doorHeight);
    const floating = ok(
      floatingPanel({
        frame: [hinge, meeting, ...rails].map((q) => ({ ...q, edge: 'far' as const })),
        groove: { width: door.grooveWidth, depth: door.grooveDepth },
        panel: { part: panelPart, along: turn(Z), across: turn(X), through: turn(Y) },
        gaps: { ends: END_GAP, edges: gaps.doorPanelEdge },
      }),
    );
    // The joint gives each frame part's groove, in the frame's order.
    const framed = [hinge, meeting, ...rails];
    for (const [i, { groove }] of floating.grooves.entries()) {
      features.add(framed[i] as PlacedPart, { grooves: [groove] });
    }
    // Rails' stub tenons, as thick as the grooves are wide, into the stiles' grooves.
    for (const rail of rails) {
      for (const [end, stile] of [hinge, meeting].entries()) {
        const grooved = {
          ...stile,
          part: {
            ...stile.part,
            grooves: floating.grooves
              .filter((f) => f.partId === stile.part.id)
              .map((f) => f.groove),
          },
        };
        const made = ok(
          tenonInGroove({ grooved, tenoned: rail, end: end as 0 | 1, v: [0, door.frameWidth] }),
        );
        features.add(rail, { tenons: [made.tenon] });
      }
    }
    const doorPanel: PlacedPart = {
      part: {
        ...panelPart,
        stock: panel(across)(floating.length),
        length: floating.length,
        rabbets: floating.rabbets,
      },
      placement: frame('door-panel', k, floating.origin, turn(Z), turn(X), turn(Y)),
    };
    // Two cup hinges on the hinge stile, 3 from each end, their plates on the case side beside it.
    if (cups) {
      const issues = cupHingeIssues(cups, 'door.hinge', dt, 'board.thickness');
      if (issues.length > 0) throw new Refusal((issues[0] as { message: string }).message);
      const hung = cupHingePair(cups, 'hinge', hinge, sides[k] as PlacedPart, {
        edge: 'reference',
        back: 'far',
        cups: [door.hingeFromEnd, doorHeight - door.hingeFromEnd],
      });
      features.add(hinge, { boredHoles: hung.cups });
      features.add(sides[k] as PlacedPart, { hingePlates: hung.plates });
    }
    return [hinge, meeting, ...rails, doorPanel];
  });

  // The face vise at the front left: its chop in front of the front-left leg, which is the bench's
  // jaw, from the top's left end to the leg's inner face. The screw and its one guide bar below it
  // pass through the chop and the leg, the screw clear below the end rail.
  const v = p.vise;
  const faceChop = cut(
    'face-chop',
    0,
    (length: number) => strips(p.chopThickness, v.face.height, length, 'width'),
    {
      along: X,
      across: minus(Z),
      through: Y,
      referenceEdge: { x: 0, y: -p.chopThickness, z: p.height },
      width: v.face.height,
    },
    [plane(0, X), plane(legX[0] + s, X)],
  );
  // Without the screw's figures, entered from its maker, nothing is bored for it yet.
  const fs = entered(v.face.screw);
  if (fs) {
    const screwZ = underside - v.face.screwBelow;
    // The screw and guide bar run through the front-left leg, so they must pass below the end rail's
    // and above the low rail's mortises in it.
    if (screwZ + fs.screwHole / 2 > endRailZ) {
      throw new Refusal(
        `The face vise's screw, ${formatLength(v.face.screwBelow)} below the top's underside, would run into the end rail, which comes down ${formatLength(p.endRailHeight)} from it. Set the screw lower or the end rail shorter.`,
      );
    }
    const guideZ = screwZ - (fs.guides > 0 ? (fs.guideFromScrew ?? 0) : 0);
    const guideHole = fs.guides > 0 ? (fs.guideHole ?? 0) : fs.screwHole;
    if (guideZ - guideHole / 2 < p.footHeight + p.lowRailHeight) {
      throw new Refusal(
        `The face vise's guide bar, ${formatLength(fs.guideFromScrew ?? 0)} below its screw, would run into the low rail. Set the screw higher or the guide bar closer to it.`,
      );
    }
    const legHoles = (() => {
      // Bored from the leg's front face; the guide bar goes below the screw, down the leg, so the
      // holes are laid out from the leg's top end and turned back.
      const leg = frontLeft;
      const L = leg.part.length;
      const top = dot(leg.placement.origin, Z) + L;
      const center = { u: top - screwZ, v: s / 2 };
      return viseHoles(fs, { center, thickness: s, guidesAlong: 'u' }).map((h) => ({
        ...h,
        entry: { ...h.entry, u: L - h.entry.u },
      }));
    })();
    features.add(frontLeft, { boredHoles: legHoles });
    // The chop runs down from the top's surface, so its v is down: the guide bar comes out below.
    features.add(faceChop, {
      boredHoles: viseHoles(fs, {
        center: { u: legX[0] + s / 2, v: p.height - screwZ },
        thickness: p.chopThickness,
        guidesAlong: 'v',
      }),
    });
  }

  // The end vise at the right end: a jaw block glued under the top's overhang, from the legs to the
  // top's end, grain along the bench like the top; the chop across the top's end, as tall as the
  // top and block; the screw centered, a guide bar either side.
  const blockBottom = underside - v.end.blockHeight;
  const block = cut(
    'vise-block',
    0,
    (length: number) => strips(v.end.blockHeight, p.topDepth, length, 'width'),
    {
      along: X,
      across: Y,
      through: Z,
      referenceEdge: { x: 0, y: 0, z: blockBottom },
      width: p.topDepth,
    },
    [housingPlane(frontRight, sideOf(frontRight, minus(X)), 0), plane(p.topLength, X)],
  );
  const chopHeight = v.end.blockHeight + p.topThickness;
  const endChop = cut(
    'end-chop',
    0,
    (length: number) => strips(p.chopThickness, chopHeight, length, 'width'),
    {
      along: Y,
      across: Z,
      through: X,
      referenceEdge: { x: p.topLength, y: 0, z: blockBottom },
      width: chopHeight,
    },
    [plane(0, Y), plane(p.topDepth, Y)],
  );
  const es = entered(v.end.screw);
  if (es) {
    const endCenter = { u: p.topDepth / 2, v: v.end.blockHeight / 2 };
    // The holes come out of the block's inside face beside the right legs, so each must clear them.
    const across = [
      { at: endCenter.u, hole: es.screwHole },
      ...(es.guides === 0
        ? []
        : [1, -1].slice(0, es.guides).map((k) => ({
            at: endCenter.u + k * (es.guideFromScrew ?? 0),
            hole: es.guideHole ?? 0,
          }))),
    ];
    const legsAcross = legY.map((y) => [y, y + s] as const);
    if (
      across.some(({ at, hole }) =>
        legsAcross.some(([y0, y1]) => at + hole / 2 > y0 && at - hole / 2 < y1),
      )
    ) {
      throw new Refusal(
        `The end vise's screw or guide bars would run into a right leg where they come out of the block. Set the guide bars closer to the screw, or the legs farther apart.`,
      );
    }
    // Between the legs, the right end rail comes out to the block's face when it is nearly as thick
    // as the legs, and its height is where the holes come out.
    const railOut = legX[1] + s / 2 + p.railThickness / 2;
    const holeBand = [
      blockBottom + v.end.blockHeight / 2 - es.screwHole / 2,
      blockBottom + v.end.blockHeight / 2 + es.screwHole / 2,
    ];
    if (
      railOut > legX[1] + s - 1 / 64 &&
      (holeBand[1] as number) > endRailZ &&
      (holeBand[0] as number) < underside
    ) {
      throw new Refusal(
        `The end vise's screw would come out of the block into the right end rail, which is as thick as the legs. Make the end rails thinner than the legs.`,
      );
    }
    const chopHoles = viseHoles(es, {
      center: endCenter,
      thickness: p.chopThickness,
      guidesAlong: 'u',
    });
    features.add(endChop, { boredHoles: chopHoles });
    // The same holes run on through the block, along its length from the top's end.
    const blockLength = block.part.length;
    features.add(block, {
      boredHoles: chopHoles.map((h) => ({
        ...h,
        entry: { u: blockLength, v: h.entry.u, n: h.entry.v },
        direction: { u: -1, v: 0, n: 0 },
        depth: blockLength,
      })),
    });
  }

  // Dog holes along the front, every `spacing` back from the end chop's, skipping any that would cut
  // into a leg's mortise. Through where nothing is under the top, stopped short of its underside
  // over the case, the legs, and the vise block.
  const dog = v.dogs;
  const r = dog.diameter / 2;
  const clearOfMortises = (x: number) =>
    features
      .of(top)
      .mortises.every(
        (m) =>
          x + r <= m.u0 || x - r >= m.u1 || dog.fromFront + r <= m.a0 || dog.fromFront - r >= m.a1,
      );
  const open = (x: number) => x + r <= legX[0];
  const dogs: number[] = [];
  const chopDog = p.topLength + p.chopThickness / 2;
  for (let x = chopDog - dog.spacing; x - r >= 0; x -= dog.spacing) {
    if (clearOfMortises(x)) dogs.push(x);
  }
  features.add(top, {
    boredHoles: dogs.map((x) => ({
      use: 'for a dog',
      diameter: dog.diameter,
      entry: { u: x, v: dog.fromFront, n: p.topThickness },
      direction: { u: 0, v: 0, n: -1 },
      depth: open(x) ? p.topThickness : p.topThickness - dog.stopShort,
      through: open(x),
    })),
  });
  features.add(endChop, {
    boredHoles: [
      {
        use: 'for a dog',
        diameter: dog.diameter,
        entry: { u: dog.fromFront, v: chopHeight, n: p.chopThickness / 2 },
        direction: { u: 0, v: -1, n: 0 },
        depth: chopHeight,
        through: true,
      },
    ],
  });

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
    ...doors,
    faceChop,
    block,
    endChop,
  ];
  return {
    parts: features.parts(placed),
    placements: placed.map((q) => q.placement),
    hardware: [
      cups
        ? cupHingeItem({ id: 'hinge', name: 'Concealed cup hinges', group: 'Hinges' }, cups, 4)
        : toEnter(
            { id: 'hinge', name: 'Concealed cup hinges, inset type', group: 'Hinges' },
            4,
            'the hinges’ figures',
            'the cups and plates',
          ),
      fs
        ? viseScrewItem({ id: 'face-vise', name: 'Face vise screw', group: 'Vise hardware' }, fs)
        : toEnter(
            { id: 'face-vise', name: 'Face vise screw', group: 'Vise hardware' },
            1,
            'the screw’s figures',
            'its holes',
          ),
      es
        ? viseScrewItem({ id: 'end-vise', name: 'End vise screw', group: 'Vise hardware' }, es)
        : toEnter(
            { id: 'end-vise', name: 'End vise screw', group: 'Vise hardware' },
            1,
            'the screw’s figures',
            'its holes',
          ),
    ],
    geometry: {
      underside,
      baseLength,
      baseDepth,
      legVisible: underside - p.footHeight,
      caseInside: legX[1] - legX[0] - s - 2 * t,
      upperOpenings: (legX[1] - legX[0] - s - 3 * t) / 2,
      lowerOpening,
      slides,
      spans,
    },
  };
}

/** A vise screw with every figure its holes need, or undefined while one is missing. */
function entered(screw: ViseScrew | undefined): ViseScrew | undefined {
  if (!screw) return undefined;
  if (screw.guides > 0 && (screw.guideHole === undefined || screw.guideFromScrew === undefined)) {
    return undefined;
  }
  return screw;
}

/** Hardware whose figures are not entered yet, so the plan bores nothing for it (hard rule 3). */
function toEnter(
  item: { id: string; name: string; group: string },
  quantity: number,
  figures: string,
  bored: string,
): HardwareItem {
  return {
    ...item,
    quantity,
    structural: false,
    notes: [
      `Input needed: enter ${figures} from the maker’s instructions. Until then the plan does not lay out ${bored}.`,
    ],
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
  'leg-vise': 'Leg, front left, behind the face vise',
  'leg-a': 'Leg, back right',
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
  'upper-drawer-box-front': 'Upper drawer box front',
  'upper-drawer-box-back': 'Upper drawer box back',
  'upper-drawer-side-left': 'Upper drawer side, left',
  'upper-drawer-side-right': 'Upper drawer side, right',
  'lower-drawer-box-front': 'Lower drawer box front',
  'lower-drawer-box-back': 'Lower drawer box back',
  'lower-drawer-side-left': 'Lower drawer side, left',
  'lower-drawer-side-right': 'Lower drawer side, right',
  'door-stile-hinge': 'Door stile, hinge side',
  'door-stile-meeting': 'Door stile, where the doors meet',
  'door-rail': 'Door rail',
  'face-chop': 'Face vise chop',
  'vise-block': 'End vise block',
  'end-chop': 'End vise chop',
};

/** Both legs are a leg, so the joints into the top and feet name them by it. */
const ROLES: Record<string, string> = { 'leg-vise': 'leg', 'leg-a': 'leg', 'leg-b': 'leg' };

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
  grooves: EdgeGroove[];
  boredHoles: BoredHole[];
  hingePlates: HingePlate[];
  screwHoles: ScrewHole[];
};
const none = (): Found => ({
  mortises: [],
  tenons: [],
  dadoes: [],
  notches: [],
  rabbets: [],
  dovetails: [],
  grooves: [],
  boredHoles: [],
  hingePlates: [],
  screwHoles: [],
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

  /** What one instance has gathered so far. */
  of(piece: PlacedPart): Found {
    return this.found.get(piece.placement.partId)?.get(piece.placement.instance) ?? none();
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
