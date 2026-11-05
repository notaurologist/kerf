// One A-frame of the swing set in its own plane (exploration #545, step 2). The frame is read from
// a generated plan: each leg's centerline from its placement, and each joint from the holes the
// template's bolted laps drilled. Loads are the uplift check's (spec, Structural model, Uplift at
// the feet), from core. Plane coordinates: x is the plan's y (front to back, front negative) and y
// is the plan's z (up).

import { designValues, swingSetAFrame } from '@kerf/core';
import { type Analysis, analyze } from './analyze.ts';
import type { Frame, Member, Offset, Section, Support } from './model.ts';

type Output = swingSetAFrame.SwingSetOutput;
type Part = Output['parts'][number];
type Placement = NonNullable<Output['placements']>[number];
type Vec3 = Placement['origin'];
type Point = { x: number; y: number };

export const HEADING = 'Exploratory frame analysis, not a structural check';

/**
 * The swing set's structural inputs, and the species and grade of the crossbar and gusset, which
 * the template's checks do not ask for.
 */
export type AFrameInputs = swingSetAFrame.SwingSetStructuralInputs & {
  crossbarSpeciesGrade?: designValues.SpeciesGradeId;
  crossbarIncised?: boolean;
  gussetSpeciesGrade?: designValues.SpeciesGradeId;
  gussetIncised?: boolean;
};

const INPUT_LABELS = {
  riderWeights: 'Heaviest rider on each swing, with seat and chain',
  maxSwingAngle: 'Maximum swing angle',
  dynamicFactor: 'Dynamic factor',
  beamSpeciesGrade: 'Beam species and grade',
  beamMoistureContent: 'Beam moisture content',
  legSpeciesGrade: 'Leg species and grade',
  legIncised: 'Whether the leg lumber is incised',
  crossbarSpeciesGrade: 'Crossbar species and grade',
  crossbarIncised: 'Whether the crossbar lumber is incised',
  gussetSpeciesGrade: 'Gusset species and grade',
  gussetIncised: 'Whether the gusset lumber is incised',
} as const satisfies Partial<Record<keyof AFrameInputs, string>>;

export type JointModel = 'pinned' | 'rigid';
type Side = 'back' | 'front';

/** A member's section in the A-frame's plane and where its E came from. */
export interface MemberSection extends Section {
  nominal: string;
  /** The depth in the frame's plane and the breadth across it, inches. */
  depth: number;
  breadth: number;
  /** E from Table 4B and the factors applied to it. */
  basis: string;
}

export interface CaseResult {
  heading: typeof HEADING;
  frame: 'left' | 'right';
  load: string;
  supports: string;
  joints: JointModel;
  /** Chain angle from vertical, degrees, and the loads applied at the leg-to-beam bolt. */
  phi: number;
  applied: { fx: number; fy: number; moment: number };
  assumptions: string[];
  analysis: Analysis;
}

export type AFrameReport =
  | { heading: typeof HEADING; status: 'input-needed'; missing: string[] }
  | { heading: typeof HEADING; status: 'not-computed'; reason: string }
  | {
      heading: typeof HEADING;
      status: 'computed';
      sections: { leg: MemberSection; crossbar: MemberSection; gusset: MemberSection };
      assumptions: string[];
      cases: CaseResult[];
    };

const inPlane = (v: Vec3): Point => ({ x: v.y, y: v.z });
const minus = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });

/** A point in a part's own frame (u along, v across, n through) in the plan's coordinates. */
function world(pl: Placement, u: number, v: number, n: number): Vec3 {
  return {
    x: pl.origin.x + u * pl.along.x + v * pl.across.x + n * pl.through.x,
    y: pl.origin.y + u * pl.along.y + v * pl.across.y + n * pl.through.y,
    z: pl.origin.z + u * pl.along.z + v * pl.across.z + n * pl.through.z,
  };
}

function direction(pl: Placement, d: { u: number; v: number; n: number }): Vec3 {
  return world({ ...pl, origin: { x: 0, y: 0, z: 0 } }, d.u, d.v, d.n);
}

/** Where the lines p + s·d and q + r·e cross, in the plane. */
function crossing(p: Point, d: Point, q: Point, e: Point): Point {
  const det = d.x * -e.y - d.y * -e.x;
  if (Math.abs(det) < 1e-12) throw new Error('The lines are parallel.');
  const w = minus(q, p);
  const s = (w.x * -e.y - w.y * -e.x) / det;
  return { x: p.x + s * d.x, y: p.y + s * d.y };
}

interface Leg {
  side: Side;
  /** A point on the centerline, and its direction from the top down. */
  point: Point;
  along: Point;
  /** The bolt groups' centroids, by hardware ID. */
  groups: Map<string, Point>;
  /** The leg-to-beam bolt's hole, its two ends. */
  boltEnds: [Point, Point];
  boltDirection: Point;
}

const LEG_BEAM = 'leg-beam-bolts';
const CROSSBAR = 'crossbar-bolts';
const GUSSET = 'gusset-bolts';

function leg(output: Output, side: Side, instance: number): Leg {
  const id = side === 'back' ? 'leg-back' : 'leg-front';
  const part = output.parts.find((p) => p.id === id);
  const pl = output.placements?.find((p) => p.partId === id && p.instance === instance);
  if (!part || !pl) throw new Error(`The plan has no ${id} ${instance}.`);
  const { width: w, thickness: t } = part.stock;
  const holes = (hardwareId: string) => part.holes.filter((h) => h.hardwareId === hardwareId);
  const center = (h: Part['holes'][number], at: number): Point =>
    inPlane(
      world(
        pl,
        h.entry.u + h.direction.u * at,
        h.entry.v + h.direction.v * at,
        h.entry.n + h.direction.n * at,
      ),
    );
  const groups = new Map<string, Point>();
  for (const hardwareId of [CROSSBAR, GUSSET]) {
    const centers = holes(hardwareId).map((h) => center(h, h.length / 2));
    if (centers.length === 0) throw new Error(`The ${id} has no ${hardwareId}.`);
    groups.set(hardwareId, {
      x: centers.reduce((s, c) => s + c.x, 0) / centers.length,
      y: centers.reduce((s, c) => s + c.y, 0) / centers.length,
    });
  }
  const [bolt] = holes(LEG_BEAM);
  if (!bolt) throw new Error(`The ${id} has no leg-to-beam bolt.`);
  return {
    side,
    point: inPlane(world(pl, 0, w / 2, t / 2)),
    along: inPlane(pl.along),
    groups,
    boltEnds: [center(bolt, 0), center(bolt, bolt.length)],
    boltDirection: inPlane(direction(pl, bolt.direction)),
  };
}

/** E' = E·C_M·C_t·C_i for a member's stock (NDS Supplement 2024 Table 4B; core's factors). */
function section(
  label: string,
  nominal: string,
  stock: { thickness: number; width: number },
  speciesGrade: designValues.SpeciesGradeId,
  incised: boolean,
): MemberSection | string {
  const row = designValues.referenceRow(speciesGrade, nominal);
  if (!row) return `No design values are entered for ${speciesGrade} in ${nominal}, the ${label}.`;
  const CM = designValues.TABLE_4B_ADJUSTMENTS.wetService.E;
  const Ct = designValues.TEMPERATURE['up-to-100F'].E;
  const Ci = incised ? designValues.INCISING.E : 1;
  const e = row.values.E * CM * Ct * Ci;
  const depth = stock.width;
  const breadth = stock.thickness;
  return {
    nominal,
    depth,
    breadth,
    e,
    area: depth * breadth,
    inertia: (breadth * depth ** 3) / 12,
    basis: `E = ${row.values.E} psi (Table 4B, ${designValues.speciesGrade(speciesGrade).species} ${designValues.speciesGrade(speciesGrade).grade}, ${row.label}) × C_M ${CM} (wet service) × C_t ${Ct}${incised ? ` × C_i ${Ci} (incised)` : ''}`,
  };
}

const SHARED_ASSUMPTIONS = [
  'One A-frame in its own plane. Nothing along the beam is analyzed here.',
  'Linear elastic, small displacements, Euler–Bernoulli members: shear deformation is left out, which matters most for the gusset, a deep member over a short span. No second-order (P-Δ) effects and no buckling.',
  'Members are prismatic, on their gross sections: bolt holes are not deducted. E is from Table 4B for the species and grade entered for each member, with wet service, C_t = 1.0, and incising where entered.',
  "The beam's cross-section is taken as rigid. It is one joint, at the leg-to-beam bolt's center. Each leg joins it by a rigid link at the leg's centerline on the bolt's line, and the gusset by a rigid link at the middle of its depth under the beam, where the beam bears on it (McGuire et al., Section 13.5.2).",
  "Each crossbar and gusset joint's bolts act together at their centroid, which is on the leg's centerline.",
  "Bolted joints are run pinned and rigid; the real joint lies between them. Pinned: the legs turn freely about the leg-to-beam bolt, and the crossbar's and gusset's ends turn freely on their bolts. Rigid: no member turns against another. The legs are continuous in both. The gusset is not bolted to the beam: it bears under it and turns with it in both.",
  "The swing loads are the uplift check's: chain tension W·(3·cos φ − 2·cos θ) at angle φ on the way down from θ, both swings at the same φ, each rider centered, each frame's share by the beam's span between its supports. They act at the hangers on the beam's underside and are carried to the bolt's center with the moment their fore-and-aft part makes about it.",
  "The dynamic factor multiplies the swing loads, not the beam's weight. Half the beam's whole weight is on each frame. The legs', crossbars', and gussets' own weight and the frame's inertia are left out.",
  'Out of scope: connection capacity, soil, sliding, and whole-frame buckling.',
];

/** Each frame, each load case, each support case, with joints pinned and rigid. */
export function aFrameAnalysis(output: Output, inputs: AFrameInputs): AFrameReport {
  const missing = (Object.keys(INPUT_LABELS) as (keyof typeof INPUT_LABELS)[])
    .filter((key) => inputs[key] === undefined)
    .map((key) => INPUT_LABELS[key]);
  if (missing.length > 0) return { heading: HEADING, status: 'input-needed', missing };
  const v = inputs as Required<AFrameInputs>;
  const p = output.params;
  const part = (id: string) => {
    const found = output.parts.find((x) => x.id === id);
    if (!found) throw new Error(`The plan has no ${id}.`);
    return found.stock;
  };

  const leg = section('legs', p.legStock, part('leg-back'), v.legSpeciesGrade, v.legIncised);
  const crossbar = section(
    'crossbar',
    p.crossbarStock,
    part('crossbar'),
    v.crossbarSpeciesGrade,
    v.crossbarIncised,
  );
  const gusset = section(
    'gusset',
    p.gussetStock,
    part('gusset'),
    v.gussetSpeciesGrade,
    v.gussetIncised,
  );
  for (const s of [leg, crossbar, gusset]) {
    if (typeof s === 'string') return { heading: HEADING, status: 'not-computed', reason: s };
  }
  const sections = {
    leg: leg as MemberSection,
    crossbar: crossbar as MemberSection,
    gusset: gusset as MemberSection,
  };
  const w = swingSetAFrame.beamWeightPerInch(output, v.beamSpeciesGrade, v.beamMoistureContent);
  if (w === null) {
    return {
      heading: HEADING,
      status: 'not-computed',
      reason: `No design values are entered for the beam's species and grade in ${p.beamStock}, so its weight on the frame is not known.`,
    };
  }

  const uplift = swingSetAFrame.upliftFeet(output, v.riderWeights, v.maxSwingAngle, w);
  const theta = (v.maxSwingAngle * Math.PI) / 180;
  const C = v.dynamicFactor;
  const pads = p.burialDepth === 0;

  const cases: CaseResult[] = [];
  uplift.frames.forEach((share, instance) => {
    const geometry = frameGeometry(output, instance);
    const phiOf = (foot: Side) => {
      const f = uplift.feet.find((x) => x.frame === share.name && x.foot === foot);
      if (!f) throw new Error(`No uplift for the ${share.name} frame's ${foot} foot.`);
      return f.phi;
    };
    const loads = [
      { name: 'Bottom of the arc', phi: 0, toward: 1, lifting: undefined },
      {
        name: 'Pushed toward the front, where the back foot lifts most',
        phi: phiOf('back'),
        toward: -1,
        lifting: 'back' as const,
      },
      {
        name: 'Pushed toward the back, where the front foot lifts most',
        phi: phiOf('front'),
        toward: 1,
        lifting: 'front' as const,
      },
    ];
    for (const load of loads) {
      const phi = (load.phi * Math.PI) / 180;
      const tension = C * share.W * (3 * Math.cos(phi) - 2 * Math.cos(theta));
      const F = load.toward * tension * Math.sin(phi);
      const down = tension * Math.cos(phi) + uplift.D;
      // F acts at the hangers, (beam center, beam's underside); about the bolt's center it turns.
      const arm = minus(geometry.hangers, geometry.top);
      const applied = { fx: F, fy: -down, moment: arm.x * -down - arm.y * F };
      const supportCases: { name: string; supports: Record<Side, Support>; notes: string[] }[] =
        pads
          ? [
              {
                name: 'Both feet pinned on their pads',
                supports: { back: { kind: 'pinned' }, front: { kind: 'pinned' } },
                notes: [
                  "Each foot is pinned on its pad where the leg's centerline meets the ground: held from moving, free to turn. Both feet share the fore-and-aft reaction, which statics alone does not divide.",
                ],
              },
              ...(load.lifting
                ? [
                    {
                      name: `The lifting ${load.lifting} foot released`,
                      supports: {
                        [load.lifting]: { kind: 'roller', restrains: 'y' },
                        [load.lifting === 'back' ? 'front' : 'back']: { kind: 'pinned' },
                      } as Record<Side, Support>,
                      notes: [
                        `The ${load.lifting} foot is lifting, so it bears nothing and has no friction: it is held only up and down (its anchor holds it down), and the whole fore-and-aft reaction is at the other foot, as the uplift check takes it. The frame is then statically determinate.`,
                      ],
                    },
                  ]
                : []),
            ]
          : [
              {
                name: 'Both feet fixed at grade',
                supports: { back: { kind: 'fixed' }, front: { kind: 'fixed' } },
                notes: [
                  'Each buried leg is fixed at grade, where its centerline meets the ground; the leg below grade is left out. Soil near the surface gives, so the real fixity is lower and the real point of fixity is below grade.',
                ],
              },
            ];
      for (const supportCase of supportCases) {
        for (const joints of ['pinned', 'rigid'] as const) {
          const frame = buildFrame(geometry, sections, joints, supportCase.supports, applied);
          cases.push({
            heading: HEADING,
            frame: share.name,
            load: load.name,
            supports: supportCase.name,
            joints,
            phi: load.phi,
            applied,
            assumptions: [...SHARED_ASSUMPTIONS, ...supportCase.notes],
            analysis: analyze(frame),
          });
        }
      }
    }
  });
  return { heading: HEADING, status: 'computed', sections, assumptions: SHARED_ASSUMPTIONS, cases };
}

/** Where the joints of one A-frame are, in its plane. */
export interface FrameGeometry {
  /** The leg-to-beam bolt's center: the beam's cross-section, taken as rigid. */
  top: Point;
  /** Where the hangers hang: the beam's underside, under its center. */
  hangers: Point;
  /** Where the beam bears on the gusset, on the gusset's axis. */
  bearing: Point;
  legs: Record<
    Side,
    {
      /** The leg's centerline on the leg-to-beam bolt's line. */
      top: Point;
      crossbar: Point;
      gusset: Point;
      foot: Point;
    }
  >;
}

export function frameGeometry(output: Output, instance: number): FrameGeometry {
  const back = leg(output, 'back', instance);
  const front = leg(output, 'front', instance);
  // The bolt runs through both legs and the beam; its center is halfway between its outer ends.
  const b = back.boltDirection;
  const size = Math.hypot(b.x, b.y);
  const unit = { x: b.x / size, y: b.y / size };
  const ends = [...back.boltEnds, ...front.boltEnds];
  const along = ends.map((e) => e.x * unit.x + e.y * unit.y);
  const lo = ends[along.indexOf(Math.min(...along))] as Point;
  const hi = ends[along.indexOf(Math.max(...along))] as Point;
  const top = { x: (lo.x + hi.x) / 2, y: (lo.y + hi.y) / 2 };

  const legPoints = (l: Leg, groundZ: number) => {
    const s = (groundZ - l.point.y) / l.along.y;
    return {
      top: crossing(l.point, l.along, top, unit),
      crossbar: l.groups.get(CROSSBAR) as Point,
      gusset: l.groups.get(GUSSET) as Point,
      foot: { x: l.point.x + s * l.along.x, y: groundZ },
    };
  };
  const legs = {
    back: legPoints(back, output.geometry.back.groundZ),
    front: legPoints(front, output.geometry.front.groundZ),
  };
  const g0 = legs.front.gusset;
  const g1 = legs.back.gusset;
  const s = (top.x - g0.x) / (g1.x - g0.x);
  return {
    top,
    hangers: { x: top.x, y: output.params.beamHeight },
    bearing: { x: top.x, y: g0.y + s * (g1.y - g0.y) },
    legs,
  };
}

/** The plane frame for one A-frame, with its joints pinned or rigid. */
export function buildFrame(
  g: FrameGeometry,
  sections: { leg: Section; crossbar: Section; gusset: Section },
  joints: JointModel,
  supports: Record<Side, Support>,
  applied: { fx: number; fy: number; moment: number },
): Frame {
  const pinned = joints === 'pinned';
  const offset = (to: Point): Offset => minus(to, g.top);
  const members: Member[] = [];
  const jointList = [{ id: 'top', ...g.top }];
  for (const side of ['back', 'front'] as const) {
    const l = g.legs[side];
    // From the top down: the bolt groups by height, then the foot.
    const nodes = [
      { id: `${side}-gusset`, ...l.gusset },
      { id: `${side}-crossbar`, ...l.crossbar },
    ].sort((a, b) => b.y - a.y);
    const below = [...nodes, { id: `${side}-foot`, ...l.foot }];
    jointList.push(...below);
    below.forEach((node, i) => {
      const previous = i === 0 ? 'top' : (below[i - 1] as { id: string }).id;
      members.push({
        id: `${side}-leg-${i + 1}`,
        start: previous,
        end: node.id,
        section: sections.leg,
        ...(i === 0 ? { offsets: { start: offset(l.top) } } : {}),
        ...(i === 0 && pinned ? { releases: { start: true } } : {}),
      });
    });
  }
  members.push({
    id: 'crossbar',
    start: 'front-crossbar',
    end: 'back-crossbar',
    section: sections.crossbar,
    ...(pinned ? { releases: { start: true, end: true } } : {}),
  });
  members.push(
    {
      id: 'gusset-front',
      start: 'front-gusset',
      end: 'top',
      section: sections.gusset,
      offsets: { end: offset(g.bearing) },
      ...(pinned ? { releases: { start: true } } : {}),
    },
    {
      id: 'gusset-back',
      start: 'top',
      end: 'back-gusset',
      section: sections.gusset,
      offsets: { start: offset(g.bearing) },
      ...(pinned ? { releases: { end: true } } : {}),
    },
  );
  return {
    joints: jointList,
    members,
    supports: { 'back-foot': supports.back, 'front-foot': supports.front },
    loads: [{ joint: 'top', ...applied }],
  };
}
