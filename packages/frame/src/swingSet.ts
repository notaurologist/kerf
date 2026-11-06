// The whole swing set in 3D (exploration #545, step 4): both A-frames and the beam, read from a
// generated plan. Coordinates are the spec's: x along the beam from its left end, y front to back
// (front negative), z up. Each A-frame's points in its own plane are step 2's (`frameGeometry`);
// their positions along the beam come from the plan's placements.

import { swingSetAFrame } from '@kerf/core';
import {
  type AFrameInputs,
  type FrameGeometry,
  frameGeometry,
  HEADING,
  type JointModel,
  type MemberSection,
  section,
} from './aFrame.ts';
import { type Analysis3, analyze3 } from './space/analyze.ts';
import type {
  Frame3,
  Joint3,
  JointLoad3,
  Member3,
  Release,
  Section3,
  Support3,
  Vec3,
} from './space/model.ts';
import { torsionConstant } from './space/torsion.ts';

type Output = swingSetAFrame.SwingSetOutput;
type Side = 'back' | 'front';
type FrameName = 'left' | 'right';

/** The A-frame inputs, whether the beam is incised, and the wood's shear modulus over its E. */
export type SwingSetInputs = AFrameInputs & {
  /** G/E for the members' wood, and where it comes from. */
  shearModulus?: { ratio: number; basis: string };
};

const INPUT_LABELS = {
  riderWeights: 'Heaviest rider on each swing, with seat and chain',
  maxSwingAngle: 'Maximum swing angle',
  dynamicFactor: 'Dynamic factor',
  beamSpeciesGrade: 'Beam species and grade',
  beamIncised: 'Whether the beam lumber is incised',
  beamMoistureContent: 'Beam moisture content',
  legSpeciesGrade: 'Leg species and grade',
  legIncised: 'Whether the leg lumber is incised',
  crossbarSpeciesGrade: 'Crossbar species and grade',
  crossbarIncised: 'Whether the crossbar lumber is incised',
  gussetSpeciesGrade: 'Gusset species and grade',
  gussetIncised: 'Whether the gusset lumber is incised',
  shearModulus: "The wood's shear modulus, as a ratio to E, with its source",
} as const satisfies Partial<Record<keyof SwingSetInputs, string>>;

/** A member's section in 3D: step 2's, with bending across the frame, torsion, and G. */
export interface SpaceSection extends Section3 {
  nominal: string;
  /** Depth in the frame's plane (vertical for the beam) and breadth across it, inches. */
  depth: number;
  breadth: number;
  /** Where E, G, and J come from. */
  basis: string;
}

export interface SwingSetCase {
  heading: typeof HEADING;
  load: string;
  supports: string;
  joints: JointModel;
  /** Chain angle from vertical, degrees; null for the load along the beam. */
  phi: number | null;
  /** The loads applied, at the beam's joints, in global axes. */
  loads: JointLoad3[];
  assumptions: string[];
  result:
    | {
        kind: 'solved';
        analysis: Extract<Analysis3, { kind: 'solved' }>;
        /** Each frame's top, at its leg-to-beam bolt, along the beam, inches (per pound for the stiffness case). */
        sway: Record<FrameName, number>;
      }
    | { kind: 'mechanism-along-beam'; message: string }
    | { kind: 'mechanism'; message: string };
}

export type SwingSetReport =
  | { heading: typeof HEADING; status: 'input-needed'; missing: string[] }
  | { heading: typeof HEADING; status: 'not-computed'; reason: string }
  | {
      heading: typeof HEADING;
      status: 'computed';
      sections: Record<'leg' | 'crossbar' | 'gusset' | 'beam', SpaceSection>;
      geometry: SetGeometry;
      assumptions: string[];
      cases: SwingSetCase[];
    };

export const ALONG_THE_BEAM =
  'One pound along the beam, at the middle of the beam between the frames';

/** Where each part of the swing set is, in the spec's coordinates. */
export interface SetGeometry {
  frames: {
    name: FrameName;
    /** The legs' centerline along the beam, where the leg-to-beam bolt is. */
    x: number;
    /** The crossbar's and gusset's mid-thickness, on the frame's outside face. */
    crossbarX: number;
    gussetX: number;
    /** The middle of the part of the gusset's top edge under the beam. */
    bearingX: number;
    plane: FrameGeometry;
  }[];
  /** The beam's axis: y and z of the leg-to-beam bolt's center. */
  beam: { y: number; z: number };
  hangersX: number[];
  /** Where the hangers hang: the beam's underside. */
  hangerZ: number;
  /** Where the load along the beam is applied: halfway between the frames' bolts. */
  middleX: number;
}

export function setGeometry(output: Output): SetGeometry | string {
  const p = output.params;
  const placement = (partId: string, instance: number) => {
    const pl = output.placements?.find((x) => x.partId === partId && x.instance === instance);
    if (!pl) throw new Error(`The plan has no ${partId} ${instance}.`);
    return pl;
  };
  const stock = (id: string) => {
    const found = output.parts.find((x) => x.id === id);
    if (!found) throw new Error(`The plan has no ${id}.`);
    return found.stock;
  };
  const leg = stock('leg-back');
  const midThickness = (partId: string, instance: number) => {
    const pl = placement(partId, instance);
    return pl.origin.x + (stock(partId).thickness / 2) * pl.through.x;
  };
  const frames: SetGeometry['frames'] = [];
  for (const [instance, name] of [
    [0, 'left'],
    [1, 'right'],
  ] as const) {
    const pl = placement('leg-back', instance);
    const x = pl.origin.x + (leg.width / 2) * pl.across.x + (leg.thickness / 2) * pl.through.x;
    // The gusset's thickness runs along x; the part of its top edge under the beam is its overlap
    // with the beam, 0 to L.
    const g = placement('gusset', instance);
    const ends = [g.origin.x, g.origin.x + stock('gusset').thickness * g.through.x];
    const lo = Math.max(Math.min(...ends), 0);
    const hi = Math.min(Math.max(...ends), p.beamLength);
    if (!(hi > lo)) {
      return `The ${name} frame's gusset is not under the beam (frame inset ${p.frameInset}), so the beam does not bear on it and this model does not apply.`;
    }
    frames.push({
      name,
      x,
      crossbarX: midThickness('crossbar', instance),
      gussetX: midThickness('gusset', instance),
      bearingX: (lo + hi) / 2,
      plane: frameGeometry(output, instance),
    });
  }
  const [left, right] = frames as [SetGeometry['frames'][0], SetGeometry['frames'][0]];
  return {
    frames,
    beam: { y: left.plane.top.x, z: left.plane.top.y },
    hangersX: [...output.swings.hangersX],
    hangerZ: p.beamHeight,
    middleX: (left.x + right.x) / 2,
  };
}

function spaceSection(
  s: MemberSection,
  ratio: number,
  ratioBasis: string,
  plies = 1,
): SpaceSection {
  const ply = s.breadth / plies;
  // Plies fastened face to face bend together about their strong axis (decision 0013). Across
  // it and in torsion they are taken as separate boards, since nothing glues them.
  const g = ratio * s.e;
  const j = plies * torsionConstant(s.depth, ply);
  return {
    nominal: s.nominal,
    depth: s.depth,
    breadth: s.breadth,
    e: s.e,
    g,
    area: s.area,
    iz: s.inertia,
    iy: (plies * s.depth * ply ** 3) / 12,
    j,
    basis: `${s.basis}; G = ${ratio.toFixed(6)} × E (${ratioBasis}); J = ${plies > 1 ? `${plies} × ` : ''}h·b³/φ for ${s.depth} by ${ply} (Wood Handbook, FPL-GTR-282, Eq. 9–11, p. 9–5, φ from Figure 9–9, p. 9–6)`,
  };
}

const X: Vec3 = { x: 1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };

/** The space frame for the whole swing set, with its bolted joints pinned or rigid. */
export function buildSwingSet(
  g: SetGeometry,
  sections: Record<'leg' | 'crossbar' | 'gusset' | 'beam', Section3>,
  joints: JointModel,
  supports: Record<FrameName, Record<Side, Support3>>,
  loads: JointLoad3[],
): Frame3 {
  const pinned = joints === 'pinned';
  const jointList: Joint3[] = [];
  const members: Member3[] = [];
  const supportMap: Record<string, Support3> = {};
  for (const f of g.frames) {
    const top = `${f.name}-top`;
    const t = f.plane.top;
    jointList.push({ id: top, x: f.x, y: t.x, z: t.y });
    const fromTop = (to: { x: number; y: number }, x = f.x): Vec3 => ({
      x: x - f.x,
      y: to.x - t.x,
      z: to.y - t.y,
    });
    for (const side of ['back', 'front'] as const) {
      const l = f.plane.legs[side];
      const nodes = [
        { id: `${f.name}-${side}-gusset`, ...l.gusset },
        { id: `${f.name}-${side}-crossbar`, ...l.crossbar },
      ].sort((a, b) => b.y - a.y);
      const below = [...nodes, { id: `${f.name}-${side}-foot`, ...l.foot }];
      for (const n of below) jointList.push({ id: n.id, x: f.x, y: n.x, z: n.y });
      below.forEach((node, i) => {
        const previous = i === 0 ? top : (below[i - 1] as { id: string }).id;
        members.push({
          id: `${f.name}-${side}-leg-${i + 1}`,
          start: previous,
          end: node.id,
          section: sections.leg,
          // Local y in the frame's plane, so Iz is the leg's in-plane inertia, as in step 2.
          reference: Y,
          ...(i === 0 ? { offsets: { start: fromTop(l.top) } } : {}),
          // One bolt: pinned, the leg turns on it every way.
          ...(i === 0 && pinned
            ? { releases: { start: [{ moment: X }, { moment: Y }, { moment: Z }] } }
            : {}),
        });
      });
      supportMap[`${f.name}-${side}-foot`] = supports[f.name][side];
    }
    // The crossbar's and gusset's bolts run along the beam: pinned, each end turns about x, the
    // frame's plane, as in step 2.
    const aboutBolts: Release[] = pinned ? [{ moment: X }] : [];
    const along = (x: number): Vec3 => ({ x: x - f.x, y: 0, z: 0 });
    members.push({
      id: `${f.name}-crossbar`,
      start: `${f.name}-front-crossbar`,
      end: `${f.name}-back-crossbar`,
      section: sections.crossbar,
      reference: Z,
      offsets: { start: along(f.crossbarX), end: along(f.crossbarX) },
      releases: { start: aboutBolts, end: aboutBolts },
    });
    // The gusset bears under the beam, unfastened: it carries no force along the beam and no
    // moment about y or z there, in both joint cases.
    const bearing: Release[] = [{ force: X }, { moment: Y }, { moment: Z }];
    // Pinned, the beam's bearing on the gusset is taken in line with the bolt along the beam, so
    // the two form no couple against the frame turning along the beam: that couple needs the bolt
    // to bear up or down in its oversize hole. Rigid, the bearing is where it is.
    const atBearing = fromTop(f.plane.bearing, pinned ? f.x : f.bearingX);
    members.push(
      {
        id: `${f.name}-gusset-front`,
        start: `${f.name}-front-gusset`,
        end: top,
        section: sections.gusset,
        reference: Z,
        offsets: { start: along(f.gussetX), end: atBearing },
        releases: { start: aboutBolts, end: bearing },
      },
      {
        id: `${f.name}-gusset-back`,
        start: top,
        end: `${f.name}-back-gusset`,
        section: sections.gusset,
        reference: Z,
        offsets: { start: atBearing, end: along(f.gussetX) },
        releases: { start: bearing, end: aboutBolts },
      },
    );
  }
  // The beam along its axis, through the frames' bolts, the hangers, and its middle.
  const stations = [
    ...g.frames.map((f) => ({ id: `${f.name}-top`, x: f.x })),
    ...g.hangersX.map((x, i) => ({ id: `hanger-${i + 1}`, x })),
  ];
  if (!stations.some((s) => Math.abs(s.x - g.middleX) < 1e-9))
    stations.push({ id: 'middle', x: g.middleX });
  for (const s of stations)
    if (!jointList.some((j) => j.id === s.id))
      jointList.push({ id: s.id, x: s.x, y: g.beam.y, z: g.beam.z });
  stations.sort((a, b) => a.x - b.x);
  stations.slice(1).forEach((s, i) => {
    members.push({
      id: `beam-${i + 1}`,
      start: (stations[i] as { id: string }).id,
      end: s.id,
      section: sections.beam,
      reference: Z,
    });
  });
  return { joints: jointList, members, supports: supportMap, loads };
}

/** The beam joint nearest the middle, where the load along the beam goes. */
export function middleJoint(g: SetGeometry): string {
  const hanger = g.hangersX.findIndex((x) => Math.abs(x - g.middleX) < 1e-9);
  return hanger >= 0 ? `hanger-${hanger + 1}` : 'middle';
}

export const ASSUMPTIONS = [
  "The whole swing set: both A-frames and the beam, in the spec's coordinates (x along the beam, y front to back, z up).",
  'Linear elastic, small displacements, Euler–Bernoulli members: shear deformation and torsional warping are left out (McGuire et al., Section 4.6.1). No second-order (P-Δ) effects and no buckling.',
  "Members are prismatic, on their gross sections. E is from Table 4B for the species and grade entered for each member, with wet service, C_t = 1.0, and incising where entered, as in step 2. G is E times the ratio stated with each section. J is the Wood Handbook's approximation for a rectangle, with φ read from its Figure 9–9. A built-up beam's plies bend together about the strong axis; across it and in torsion each ply is taken on its own.",
  "The beam runs along its centerline at the leg-to-beam bolts' height, between the frames' bolts, through the hangers. The overhangs past the frames carry no load and are left out; their weight is in the half of the beam's weight each frame carries. The beam's cross-section is taken as rigid across its depth and over the short length from each bolt to the gusset's bearing, so each frame's legs and gusset join the beam's axis by rigid links (McGuire et al., Section 13.5.2, extended to 3D).",
  "Legs run along their centerlines, at the middle of their thickness along the beam, with joints at the gusset's and crossbar's bolt groups and the ground, as in step 2. The crossbar and gusset lie in their own planes on the frame's outside face; each bolt group joins them to the leg's centerline by a rigid link along the bolts.",
  "Bolted joints are run pinned and rigid; the real joint lies between them. Pinned: the leg-to-beam bolt is a single bolt, and each leg turns freely on it in every direction (step 2 let it turn in the frame's plane; along the beam this is turning about the bolt's own axis, the frame leaning against the beam). Each crossbar and gusset joint turns freely about its bolts' axis, along the beam, which is step 2's in-plane pin; its two bolts, spread across the board, hold the faces together against the other two rotations. Rigid: nothing turns. The legs are continuous in both.",
  'Where the beam bears on the gusset differs between the two cases. The gusset is on the frame\'s outside face, so the beam bears on it a short way along the beam from the bolt (2.5 in the worked example). With the beam held down at the bolt and up at the gusset, the two would form a couple that stops the frame turning against the beam along the beam, but only once the bolt bears up or down in its hole, which is 1/16" oversize: the spec takes the gusset as what the beam meets first. Pinned, the bearing is taken in line with the bolt, so there is no couple. Rigid, it is where it is.',
  "The gusset is not fastened to the beam: it bears under it. It carries the beam's weight, its push toward the front or back, and its turning in the frame's plane, as in step 2, and nothing along the beam or about any other axis; no friction is counted.",
  "Swing loads are the uplift check's (both swings at the same chain angle φ, each rider centered, half the chain tension at each hanger), applied at the hangers on the beam's underside and carried to the beam's axis with the moment their push makes about it. The beam shares them between the frames, which differs slightly from the uplift check's share by the beam's span between the gussets when the riders differ. Half the beam's whole weight is at each frame's bolt. The legs', crossbars', and gussets' own weight and the frame's inertia are left out.",
  "No load along the beam is applied from a source. The swing loads act in the A-frames' planes (spec, Structural model, Uplift at the feet), and neither the spec nor any source read for this exploration gives a load along the beam for a swing set (wind, a rider pushing on a leg, a swing twisting on its chains). So the frame's stiffness along the beam is reported instead: how far each frame's top moves along the beam per pound of load along the beam, applied at the beam's middle. Multiplying it by a load gives a sway; no sway limit is assumed.",
  'Out of scope: connection capacity, soil, sliding, whole-frame buckling, and dynamics.',
];

const MECHANISM_ALONG_THE_BEAM =
  "Mechanism along the beam: with every bolted joint pinned and the feet free to turn on their pads, each A-frame can lean along the beam, turning about the line through its feet, while the beam moves along its length, so no sway is given. Holding the beam along its length makes the same frame stable, which shows this is the way it moves. On level ground nothing strains at all. On sloped ground the line through the feet is not level, so leaning also turns the beam a little in plan and bends it sideways; that stiffness is so small that the solver reads it as a mechanism. What holds the real frame along the beam is how tightly the bolts clamp, the anchors' grip on the legs, and any bracing along the beam, none of which this model has a value for.";

export function swingSetAnalysis(output: Output, inputs: SwingSetInputs): SwingSetReport {
  const missing = (Object.keys(INPUT_LABELS) as (keyof typeof INPUT_LABELS)[])
    .filter((key) => inputs[key] === undefined)
    .map((key) => INPUT_LABELS[key]);
  if (missing.length > 0) return { heading: HEADING, status: 'input-needed', missing };
  const v = inputs as Required<SwingSetInputs>;
  const p = output.params;
  const part = (id: string) => {
    const found = output.parts.find((x) => x.id === id);
    if (!found) throw new Error(`The plan has no ${id}.`);
    return found.stock;
  };
  const beamPart = part('beam');
  const planes = {
    leg: section('legs', p.legStock, part('leg-back'), v.legSpeciesGrade, v.legIncised),
    crossbar: section(
      'crossbar',
      p.crossbarStock,
      part('crossbar'),
      v.crossbarSpeciesGrade,
      v.crossbarIncised,
    ),
    gusset: section('gusset', p.gussetStock, part('gusset'), v.gussetSpeciesGrade, v.gussetIncised),
    // The beam stands on edge: its depth is vertical, its breadth all its plies.
    beam: section(
      'beam',
      p.beamStock,
      { width: beamPart.width, thickness: beamPart.thickness * p.beamPlies },
      v.beamSpeciesGrade,
      v.beamIncised,
    ),
  };
  for (const s of Object.values(planes)) {
    if (typeof s === 'string') return { heading: HEADING, status: 'not-computed', reason: s };
  }
  const { ratio, basis } = v.shearModulus;
  if (!(ratio > 0 && ratio < 1)) {
    return {
      heading: HEADING,
      status: 'not-computed',
      reason: `The shear modulus ratio ${ratio} is not between 0 and 1.`,
    };
  }
  const sections = {
    leg: spaceSection(planes.leg as MemberSection, ratio, basis),
    crossbar: spaceSection(planes.crossbar as MemberSection, ratio, basis),
    gusset: spaceSection(planes.gusset as MemberSection, ratio, basis),
    beam: spaceSection(planes.beam as MemberSection, ratio, basis, p.beamPlies),
  };
  const g = setGeometry(output);
  if (typeof g === 'string') return { heading: HEADING, status: 'not-computed', reason: g };
  const w = swingSetAFrame.beamWeightPerInch(output, v.beamSpeciesGrade, v.beamMoistureContent);
  if (w === null) {
    return {
      heading: HEADING,
      status: 'not-computed',
      reason: `No design values are entered for the beam's species and grade in ${p.beamStock}, so its weight on the frame is not known.`,
    };
  }
  const uplift = swingSetAFrame.upliftFeet(output, v.riderWeights, v.maxSwingAngle, w);
  const phiOf = (foot: Side) => {
    const f = uplift.feet.find((x) => x.frame === 'left' && x.foot === foot);
    if (!f) throw new Error(`No uplift for the ${foot} foot.`);
    return f.phi;
  };
  const theta = (v.maxSwingAngle * Math.PI) / 180;
  const C = v.dynamicFactor;
  const pads = p.burialDepth === 0;

  const swingLoads = (phiDeg: number, toward: number): JointLoad3[] => {
    const phi = (phiDeg * Math.PI) / 180;
    const factor = C * (3 * Math.cos(phi) - 2 * Math.cos(theta));
    const r = g.hangerZ - g.beam.z;
    const hangers = g.hangersX.map((_, i) => {
      // Two hangers per swing, left swing first (spec, Swings).
      const T = factor * (v.riderWeights[i < 2 ? 0 : 1] as number);
      const fy = (toward * T * Math.sin(phi)) / 2;
      const fz = (-T * Math.cos(phi)) / 2;
      // r × F with r = (0, 0, r) from the beam's axis down to the hanger.
      return { joint: `hanger-${i + 1}`, fy, fz, mx: -r * fy };
    });
    const weight = g.frames.map((f) => ({ joint: `${f.name}-top`, fz: -uplift.D }));
    return [...hangers, ...weight];
  };

  const loadCases: {
    name: string;
    phi: number | null;
    lifting?: Side;
    loads: JointLoad3[];
  }[] = [
    { name: ALONG_THE_BEAM, phi: null, loads: [{ joint: middleJoint(g), fx: 1 }] },
    { name: 'Bottom of the arc', phi: 0, loads: swingLoads(0, 1) },
    {
      name: 'Pushed toward the front, where the back foot lifts most',
      phi: phiOf('back'),
      lifting: 'back',
      loads: swingLoads(phiOf('back'), -1),
    },
    {
      name: 'Pushed toward the back, where the front foot lifts most',
      phi: phiOf('front'),
      lifting: 'front',
      loads: swingLoads(phiOf('front'), 1),
    },
  ];

  const both = (s: Record<Side, Support3>) => ({ left: s, right: s });
  const cases: SwingSetCase[] = [];
  for (const load of loadCases) {
    const supportCases: {
      name: string;
      supports: Record<FrameName, Record<Side, Support3>>;
      note: string;
    }[] = pads
      ? [
          {
            name: 'Both feet pinned on their pads',
            supports: both({ back: { kind: 'pinned' }, front: { kind: 'pinned' } }),
            note: "Each foot is pinned on its pad where the leg's centerline meets the ground: held from moving in every direction by its anchor, free to turn.",
          },
          ...(load.lifting
            ? [
                {
                  name: `The lifting ${load.lifting} feet released`,
                  supports: both({
                    [load.lifting]: {
                      kind: 'restraints',
                      x: false,
                      y: false,
                      z: true,
                      rx: false,
                      ry: false,
                      rz: false,
                    },
                    [load.lifting === 'back' ? 'front' : 'back']: { kind: 'pinned' },
                  } as Record<Side, Support3>),
                  note: `Each ${load.lifting} foot is lifting, so it bears nothing and has no friction: it is held only up and down by its anchor, and the other foot of each frame is pinned.`,
                },
              ]
            : []),
        ]
      : [
          {
            name: 'Both feet fixed at grade',
            supports: both({ back: { kind: 'fixed' }, front: { kind: 'fixed' } }),
            note: 'Each buried leg is fixed at grade, where its centerline meets the ground; the leg below grade is left out. Soil near the surface gives, so the real fixity is lower and the real point of fixity is below grade.',
          },
        ];
    for (const sc of supportCases) {
      for (const joints of ['pinned', 'rigid'] as const) {
        const frame = buildSwingSet(g, sections, joints, sc.supports, load.loads);
        cases.push({
          heading: HEADING,
          load: load.name,
          supports: sc.name,
          joints,
          phi: load.phi,
          loads: load.loads,
          assumptions: [...ASSUMPTIONS, sc.note],
          result: run(frame, g),
        });
      }
    }
  }
  return {
    heading: HEADING,
    status: 'computed',
    sections,
    geometry: g,
    assumptions: ASSUMPTIONS,
    cases,
  };
}

function run(frame: Frame3, g: SetGeometry): SwingSetCase['result'] {
  const a = analyze3(frame);
  if (a.kind === 'solved') {
    const sway = (name: FrameName) => a.displacements[`${name}-top`]?.x ?? Number.NaN;
    return { kind: 'solved', analysis: a, sway: { left: sway('left'), right: sway('right') } };
  }
  // Is it the frame moving along the beam? Hold the beam along its length and look again.
  const held = analyze3({
    ...frame,
    supports: {
      ...frame.supports,
      [middleJoint(g)]: {
        kind: 'restraints',
        x: true,
        y: false,
        z: false,
        rx: false,
        ry: false,
        rz: false,
      },
    },
  });
  if (held.kind === 'solved')
    return { kind: 'mechanism-along-beam', message: MECHANISM_ALONG_THE_BEAM };
  return { kind: 'mechanism', message: a.message };
}
