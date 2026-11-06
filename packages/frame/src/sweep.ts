// The whole swing set's frame analysis over the template's worked examples and its seeded sweep
// (exploration #545, step 5). Every instance is counted: one the analysis cannot handle is
// reported with its reason, and a case that is a mechanism is reported as one, with no numbers.
// Numbers are kept exact here; rounding belongs to `sweepMarkdown`.

import { swingSetAFrame } from '@kerf/core';
import { SWEEPS, seeded } from '@kerf/core/sweeps';
import { HEADING, type JointModel } from './aFrame.ts';
import {
  ALONG_THE_BEAM,
  type SwingSetCase,
  type SwingSetInputs,
  swingSetAnalysis,
} from './swingSet.ts';

type Output = swingSetAFrame.SwingSetOutput;
type SwingSetStructuralInputs = swingSetAFrame.SwingSetStructuralInputs;
const JOINTS: readonly JointModel[] = ['pinned', 'rigid'];

/**
 * The comparison tolerances, fixed before the sweep is run. A leg's axial load differs from core's
 * P when |frame − P| / P is over LEG_TOLERANCE. A foot's pull differs from core's uplift when
 * |frame − core| is over the larger of UPLIFT_TOLERANCE·|core| and UPLIFT_FLOOR pounds; the floor
 * keeps a foot that is barely lifting or barely held down from reading as a large relative change.
 */
export const LEG_TOLERANCE = 0.01;
export const UPLIFT_TOLERANCE = 0.01;
export const UPLIFT_FLOOR = 1;

/** What the analysis needs beyond core's structural inputs, and where each comes from. */
export interface FrameOnlyInputs {
  shearModulus: { ratio: number; basis: string };
  /** The crossbar and gusset take the legs' species, grade, and incising: core asks for none. */
  crossbarAndGusset: 'as the legs';
}

export interface Where {
  /** The instance's name: an example's, or "draw n". */
  instance: string;
  splay: number;
  beamHeight: number;
  burialDepth: number;
  crossbarHeight: number;
  beamLength: number;
  /** Inches per foot, falling toward the front. */
  groundSlope: number;
  legStock: string;
  beamStock: string;
  beamPlies: number;
}

/** A largest value and where in the frame it is. */
export interface Peak {
  value: number;
  /** The member or foot, and the load and support case. */
  at: string;
}

export interface JointResult {
  /**
   * Each frame's top along the beam per pound along the beam, inches per pound, the larger of
   * the two frames; or why there is none.
   */
  sway: { kind: 'solved'; perPound: number } | { kind: 'mechanism-along-beam' | 'mechanism' };
  /** Over the swing load cases that solved; null when none did. */
  compression: Peak | null;
  tension: Peak | null;
  moment: Peak | null;
  footDown: Peak | null;
  footUplift: Peak | null;
  footHorizontal: Peak | null;
  footMoment: Peak | null;
  /** Swing load cases solved, and those that are mechanisms, by kind. */
  solvedCases: number;
  mechanismCases: { alongBeam: number; other: string[] };
  /**
   * Pinned on pads only: the stiffness along the beam, lb/in, where the solver returned one
   * though the frame is the mechanism along the beam; null where it read a mechanism.
   */
  residual: number | null;
}

interface LegComparison {
  supports: string;
  joints: JointModel;
  /** Core's P and the largest compression in a leg below its crossbar, bottom of the arc. */
  core: number;
  frame: number;
  at: string;
  relative: number;
  over: boolean;
}

/**
 * The push toward the front or back, which core's P leaves out: the largest compression in a leg
 * below its crossbar in that load case, against P.
 */
interface PushComparison {
  supports: string;
  joints: JointModel;
  load: string;
  core: number;
  frame: number;
  at: string;
  relative: number;
}

/**
 * The frame against core's leg check (template version 43): the larger of P and the frame's push
 * load on a leg, against the larger of P and core's push load N, both at core's chain angle for
 * that leg. `relative` is frame over core less 1, so a positive value is the statics reading low.
 */
interface LegCheckComparison {
  supports: string;
  joints: JointModel;
  load: string;
  P: number;
  N: number;
  frame: number;
  at: string;
  relative: number;
}

interface UpliftComparison {
  foot: string;
  joints: JointModel;
  /** The foot's pull, pounds: core's C·S − D·c_v and the frame's with that foot released. */
  core: number;
  frame: number;
  difference: number;
  over: boolean;
}

export type Instance =
  | { kind: 'rejected'; instance: string; reason: string }
  | { kind: 'refused'; instance: string; reason: string; detail: string }
  | { kind: 'input-needed'; instance: string; reason: string }
  | { kind: 'not-computed'; instance: string; reason: string }
  | { kind: 'threw'; instance: string; reason: string }
  | {
      kind: 'analyzed';
      where: Where;
      pads: boolean;
      joints: Record<JointModel, JointResult>;
      legs: LegComparison[];
      pushes: PushComparison[];
      /** The push at core's own chain angle, against core's leg check. */
      legCheck: LegCheckComparison[];
      /** Empty for buried legs, which core gives no uplift check. */
      uplift: UpliftComparison[];
    };

function whereOf(instance: string, output: Output): Where {
  const p = output.params;
  return {
    instance,
    splay: output.geometry.splay,
    beamHeight: p.beamHeight,
    burialDepth: p.burialDepth,
    crossbarHeight: p.crossbarHeight,
    beamLength: p.beamLength,
    groundSlope: p.groundSlope,
    legStock: p.legStock,
    beamStock: p.beamStock,
    beamPlies: p.beamPlies,
  };
}

/** The frame's inputs: core's structural inputs, with what only the frame needs. */
function frameInputs(
  inputs: Partial<SwingSetStructuralInputs>,
  extra: FrameOnlyInputs,
): SwingSetInputs {
  return {
    riderWeights: inputs.riderWeights,
    maxSwingAngle: inputs.maxSwingAngle,
    dynamicFactor: inputs.dynamicFactor,
    beamSpeciesGrade: inputs.beamSpeciesGrade,
    beamIncised: inputs.beamIncised,
    beamMoistureContent: inputs.beamMoistureContent,
    legSpeciesGrade: inputs.legSpeciesGrade,
    legIncised: inputs.legIncised,
    crossbarSpeciesGrade: inputs.legSpeciesGrade,
    crossbarIncised: inputs.legIncised,
    gussetSpeciesGrade: inputs.legSpeciesGrade,
    gussetIncised: inputs.legIncised,
    shearModulus: extra.shearModulus,
  };
}

const larger = (a: Peak | null, value: number, at: string): Peak | null =>
  a === null || value > a.value ? { value, at } : a;

const caseName = (c: SwingSetCase) =>
  `${c.load}${c.phi === null ? '' : ` (φ = ${c.phi.toFixed(2)}°)`}; ${c.supports}`;

/**
 * With every bolted joint pinned and the feet pinned on pads, each A-frame leans along the beam
 * about the line through its feet (step 4; the owner's decision on #735). On sloped ground the
 * beam bending sideways leaves a stiffness so small that the solver sometimes reads it as a
 * mechanism and sometimes returns numbers, depending on where its pivots fall against the
 * mechanism threshold. Every such case is reported as the mechanism, and any stiffness the solver
 * returned is kept apart as the residual.
 */
const leansOnPads = (pads: boolean, joints: JointModel) => pads && joints === 'pinned';

function jointResult(cases: SwingSetCase[], joints: JointModel, pads: boolean): JointResult {
  const mine = cases.filter((c) => c.joints === joints);
  const along = mine.find((c) => c.load === ALONG_THE_BEAM);
  if (!along) throw new Error('No case along the beam.');
  const perPound =
    along.result.kind === 'solved'
      ? Math.max(Math.abs(along.result.sway.left), Math.abs(along.result.sway.right))
      : null;
  const leans = leansOnPads(pads, joints);
  const sway: JointResult['sway'] = leans
    ? { kind: 'mechanism-along-beam' }
    : perPound !== null
      ? { kind: 'solved', perPound }
      : { kind: along.result.kind === 'mechanism-along-beam' ? along.result.kind : 'mechanism' };
  const r: JointResult = {
    sway,
    compression: null,
    tension: null,
    moment: null,
    footDown: null,
    footUplift: null,
    footHorizontal: null,
    footMoment: null,
    solvedCases: 0,
    mechanismCases: { alongBeam: 0, other: [] },
    residual: leans && perPound !== null ? 1 / perPound : null,
  };
  for (const c of mine) {
    if (c.load === ALONG_THE_BEAM) continue;
    if (c.result.kind === 'mechanism-along-beam' || leans) {
      r.mechanismCases.alongBeam++;
      continue;
    }
    if (c.result.kind === 'mechanism') {
      r.mechanismCases.other.push(`${caseName(c)}: ${c.result.message}`);
      continue;
    }
    r.solvedCases++;
    const name = caseName(c);
    const a = c.result.analysis;
    for (const [id, f] of Object.entries(a.memberForces)) {
      // No member loads, so the axial force is the same along the member: compression reads as a
      // positive axial force at its start.
      const at = `${id}, ${name}`;
      if (f.start.axial > 0) r.compression = larger(r.compression, f.start.axial, at);
      if (f.start.axial < 0) r.tension = larger(r.tension, -f.start.axial, at);
      for (const end of [f.start, f.end])
        r.moment = larger(r.moment, Math.hypot(end.my, end.mz), at);
    }
    for (const [id, f] of Object.entries(a.reactions)) {
      const at = `${id}, ${name}`;
      if (f.fz > 0) r.footDown = larger(r.footDown, f.fz, at);
      if (f.fz < 0) r.footUplift = larger(r.footUplift, -f.fz, at);
      r.footHorizontal = larger(r.footHorizontal, Math.hypot(f.fx, f.fy), at);
      const m = Math.hypot(f.mx, f.my, f.mz);
      if (m > 0) r.footMoment = larger(r.footMoment, m, at);
    }
  }
  return r;
}

/** The largest compression in a leg's lowest member, which runs from its crossbar to its foot. */
function lowestLegCompression(forces: Record<string, { start: { axial: number } }>): Peak {
  let largest: Peak | null = null;
  for (const id of Object.keys(forces)) {
    const m = /^(left|right)-(back|front)-leg-(\d+)$/.exec(id);
    if (!m) continue;
    const next = `${m[1]}-${m[2]}-leg-${Number(m[3]) + 1}`;
    if (next in forces) continue;
    largest = larger(largest, forces[id]?.start.axial ?? Number.NaN, id);
  }
  if (!largest) throw new Error('No legs.');
  return largest;
}

/** The frame's and core's sourced checks side by side for one plan. */
function comparisons(
  output: Output,
  inputs: SwingSetInputs,
  cases: SwingSetCase[],
): { legs: LegComparison[]; pushes: PushComparison[]; uplift: UpliftComparison[] } {
  const v = inputs as Required<SwingSetInputs>;
  const pads = output.params.burialDepth === 0;
  const w = swingSetAFrame.beamWeightPerInch(output, v.beamSpeciesGrade, v.beamMoistureContent);
  if (w === null) throw new Error('No beam weight, though the frame analysis computed.');
  const k = swingSetAFrame.pendulumFactor(v.maxSwingAngle);
  const perHanger = v.riderWeights.flatMap((W) => [(W * k) / 2, (W * k) / 2]);
  const leg = swingSetAFrame.legAxialLoad(output, perHanger, w);
  const P = v.dynamicFactor * leg.factored + leg.unfactored;

  const legs: LegComparison[] = [];
  const pushes: PushComparison[] = [];
  for (const c of cases) {
    if (c.phi === null || c.result.kind !== 'solved' || leansOnPads(pads, c.joints)) continue;
    const largest = lowestLegCompression(c.result.analysis.memberForces);
    const relative = (largest.value - P) / P;
    if (c.phi !== 0) {
      pushes.push({
        supports: c.supports,
        joints: c.joints,
        load: c.load,
        core: P,
        frame: largest.value,
        at: largest.at,
        relative,
      });
      continue;
    }
    legs.push({
      supports: c.supports,
      joints: c.joints,
      core: P,
      frame: largest.value,
      at: largest.at,
      relative,
      over: !(Math.abs(relative) <= LEG_TOLERANCE),
    });
  }

  const uplift: UpliftComparison[] = [];
  if (pads) {
    const { feet } = swingSetAFrame.upliftFeet(output, v.riderWeights, v.maxSwingAngle, w);
    for (const f of feet) {
      const core = v.dynamicFactor * f.S - f.held;
      for (const joints of JOINTS) {
        const c = cases.find(
          (x) => x.supports === `The lifting ${f.foot} feet released` && x.joints === joints,
        );
        if (c?.result.kind !== 'solved' || leansOnPads(pads, joints)) continue;
        const fz = c.result.analysis.reactions[`${f.frame}-${f.foot}-foot`]?.fz ?? Number.NaN;
        const difference = -fz - core;
        uplift.push({
          foot: `${f.frame} frame, ${f.foot} foot`,
          joints,
          core,
          frame: -fz,
          difference,
          over: !(
            Math.abs(difference) <= Math.max(UPLIFT_TOLERANCE * Math.abs(core), UPLIFT_FLOOR)
          ),
        });
      }
    }
  }
  return { legs, pushes, uplift };
}

/** The frame's push cases at the leg check's chain angle, against the leg check's load. */
function legCheckComparisons(
  output: Output,
  inputs: SwingSetInputs,
  cases: SwingSetCase[],
): LegCheckComparison[] {
  const v = inputs as Required<SwingSetInputs>;
  const pads = output.params.burialDepth === 0;
  const w = swingSetAFrame.beamWeightPerInch(output, v.beamSpeciesGrade, v.beamMoistureContent);
  if (w === null) throw new Error('No beam weight, though the frame analysis computed.');
  const k = swingSetAFrame.pendulumFactor(v.maxSwingAngle);
  const perHanger = v.riderWeights.flatMap((W) => [(W * k) / 2, (W * k) / 2]);
  const shared = swingSetAFrame.legAxialLoad(output, perHanger, w);
  const P = v.dynamicFactor * shared.factored + shared.unfactored;
  const cosA = Math.cos((output.geometry.splay * Math.PI) / 180);
  const out: LegCheckComparison[] = [];
  for (const c of cases) {
    if (c.phi === null || c.phi === 0) continue;
    if (c.result.kind !== 'solved' || leansOnPads(pads, c.joints)) continue;
    const leg = c.load.startsWith('Pushed toward the back') ? 'back' : 'front';
    const push = swingSetAFrame.legPush(output, v.riderWeights, v.maxSwingAngle, leg);
    // N = (C·S + R_w·c_v) / cos α (core, Legs).
    const N = (v.dynamicFactor * push.swing + shared.Rw * push.cv) / cosA;
    const largest = lowestLegCompression(c.result.analysis.memberForces);
    out.push({
      supports: c.supports,
      joints: c.joints,
      load: c.load,
      P,
      N,
      frame: largest.value,
      at: largest.at,
      relative: Math.max(P, largest.value) / Math.max(P, N) - 1,
    });
  }
  return out;
}

function legCheckCases(output: Output, frame: SwingSetInputs): SwingSetCase[] {
  const report = swingSetAnalysis(output, frame, 'leg-check');
  if (report.status !== 'computed') throw new Error('The leg-check push cases did not compute.');
  return report.cases.filter((c) => c.phi !== null && c.phi !== 0);
}

/** One generated plan through the frame analysis, with every outcome kept. */
function analyzeInstance(
  instance: string,
  output: Output,
  inputs: Partial<SwingSetStructuralInputs>,
  extra: FrameOnlyInputs,
): Instance {
  try {
    const frame = frameInputs(inputs, extra);
    const report = swingSetAnalysis(output, frame);
    if (report.status === 'input-needed') {
      return { kind: 'input-needed', instance, reason: report.missing.join(', ') };
    }
    if (report.status === 'not-computed') {
      return { kind: 'not-computed', instance, reason: report.reason };
    }
    const pads = output.params.burialDepth === 0;
    return {
      kind: 'analyzed',
      where: whereOf(instance, output),
      pads,
      joints: {
        pinned: jointResult(report.cases, 'pinned', pads),
        rigid: jointResult(report.cases, 'rigid', pads),
      },
      ...comparisons(output, frame, report.cases),
      legCheck: legCheckComparisons(output, frame, legCheckCases(output, frame)),
    };
  } catch (error) {
    return {
      kind: 'threw',
      instance,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/** A drawn or written parameter set, through the schemas and the template, then the analysis. */
function analyzeDrawn(
  instance: string,
  drawn: { params: unknown; structuralInputs: unknown },
  extra: FrameOnlyInputs,
): Instance {
  const def = swingSetAFrame.definition;
  const params = def.params.safeParse(drawn.params);
  const inputs = def.structuralInputs.safeParse(drawn.structuralInputs);
  if (!params.success || !inputs.success) {
    const [issue] = (params.success ? inputs : params).error?.issues ?? [];
    const path = issue?.path ?? [];
    const value = path.reduce<unknown>(
      (at, key) => (at as Record<PropertyKey, unknown> | undefined)?.[key as PropertyKey],
      params.success ? drawn.structuralInputs : drawn.params,
    );
    return {
      kind: 'rejected',
      instance,
      reason: `The ${params.success ? 'structural inputs' : 'parameters'} schema rejects ${path.join('.')} = ${JSON.stringify(value)}`,
    };
  }
  const made = swingSetAFrame.generate(params.data);
  if (!made.ok) {
    const codes = [...new Set(made.issues.map((i) => i.code))].sort();
    return {
      kind: 'refused',
      instance,
      reason: `The template refuses it: ${codes.join(', ')}`,
      detail: made.issues.map((i) => i.message).join(' '),
    };
  }
  return analyzeInstance(instance, made.output, inputs.data, extra);
}

export interface SweepRun {
  heading: typeof HEADING;
  templateVersion: number;
  seed: number;
  count: number;
  extra: FrameOnlyInputs;
  examples: Instance[];
  draws: Instance[];
}

/**
 * The worked examples, then the first `count` draws of the template's sweep from its seed (all of
 * them by default), drawn the way core's sweep draws them, so draw n here is draw n there.
 */
export function runSweep(extra: FrameOnlyInputs, count?: number): SweepRun {
  const plan = SWEEPS[swingSetAFrame.definition.id];
  if (!plan) throw new Error('The swing set has no sweep.');
  const n = count ?? plan.count;
  const random = seeded(plan.seed);
  const examples = swingSetAFrame.EXAMPLES.map((e) => analyzeDrawn(`Example: ${e.name}`, e, extra));
  const draws: Instance[] = [];
  for (let i = 0; i < n; i++) draws.push(analyzeDrawn(`draw ${i}`, plan.sample(random), extra));
  return {
    heading: HEADING,
    templateVersion: swingSetAFrame.definition.version,
    seed: plan.seed,
    count: n,
    extra,
    examples,
    draws,
  };
}
