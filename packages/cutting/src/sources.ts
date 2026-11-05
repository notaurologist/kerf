import { type Part, recordCabinet, swingSetAFrame, workbench } from '@kerf/core';
import { type Instance, instancesFromParts } from './instance.ts';
import { type Random, seeded } from './random.ts';

// Where the benchmark's instances come from: every template's worked examples, and a seeded sweep
// of each template's parameters drawn as core's sweep tests draw them (`templates/*/sweep.test.ts`
// in core). The draws are copied here because those tests keep them private; a draw that drifts
// from core's still gives valid instances, only different ones.

export interface Sourced {
  /** Where the instance came from, such as "workbench / sweep 12". */
  source: string;
  instance: Instance;
}

interface TemplateSource {
  id: string;
  examples: readonly { name: string; params: unknown; structuralInputs: unknown }[];
  /** The parts of a plan the parameters make, or undefined when the template refuses them. */
  parts(params: unknown, structuralInputs: unknown): readonly Part[] | undefined;
  sample(random: Random): { params: unknown; structuralInputs: unknown };
}

const DIAMETERS = [0.375, 0.5, 0.625, 0.75] as const;

const swing = swingSetAFrame.definition;
const swingWorked = swing.examples[0];
const cabinet = recordCabinet.definition;
const cabinetWorked = cabinet.examples[0];
const bench = workbench.definition;
const benchWorked = bench.examples[0];
if (!swingWorked || !cabinetWorked || !benchWorked) throw new Error('No worked example');

const TEMPLATES: readonly TemplateSource[] = [
  {
    id: swing.id,
    examples: swing.examples,
    parts(params, inputs) {
      const p = swing.params.safeParse(params);
      const s = swing.structuralInputs.safeParse(inputs);
      if (!p.success || !s.success) return undefined;
      const made = swing.generate(p.data, s.data);
      return made.ok ? made.output.design.parts : undefined;
    },
    sample(r) {
      const p = swingWorked.params;
      const beamLength = r.between(48, 240);
      const beamHeight = r.between(60, 144);
      const builtUp = r.chance(0.4);
      const burialDepth = r.chance(0.3) ? 0 : r.between(0, 48);
      const mounting = r.pick(['vertical', 'horizontal', 'none'] as const);
      return {
        structuralInputs: swingWorked.structuralInputs,
        params: {
          ...p,
          beamLength,
          beamHeight,
          splay: r.chance(0.7)
            ? { kind: 'angle', degrees: r.between(5, 35) }
            : { kind: 'footprint', depth: r.between(40, 220) },
          beamStock: builtUp
            ? r.pick(['2x6', '2x8', '2x10'])
            : r.pick(['4x6', '4x8', '6x6', '6x8']),
          beamPlies: builtUp ? r.int(2, 3) : 1,
          legStock: r.pick(['4x4', '4x6', '6x6']),
          crossbarStock: r.pick(['2x4', '2x6', '2x8']),
          crossbarHeight: r.between(12, beamHeight - 12),
          gussetStock: r.pick(['2x6', '2x8', '2x10']),
          frameInset: r.between(0, 24),
          groundSlope: r.between(-3, 3),
          burialDepth,
          swings: {
            ...p.swings,
            centers: [r.between(0.25, 0.45) * beamLength, r.between(0.55, 0.75) * beamLength],
            hangerSpacing: r.between(12, 24),
          },
          hardware: {
            ...p.hardware,
            legBoltDiameter: r.pick(DIAMETERS),
            crossbarBolts: { diameter: r.pick(DIAMETERS), perJoint: r.int(1, 4) },
            gussetBolts: { diameter: r.pick(DIAMETERS), perJoint: r.int(1, 4) },
            ...(builtUp ? { plyBolts: { diameter: r.pick(DIAMETERS), count: r.int(4, 12) } } : {}),
            ...(burialDepth === 0 ? { anchorsPerFoot: r.int(1, 4) } : {}),
            hangerMounting:
              mounting === 'vertical'
                ? { kind: 'vertical-bolt', diameter: r.pick(DIAMETERS) }
                : mounting === 'horizontal'
                  ? {
                      kind: 'horizontal-bolts',
                      diameter: r.pick(DIAMETERS),
                      perHanger: r.int(1, 4),
                      holeHeight: r.between(1, 4),
                    }
                  : undefined,
          },
        },
      };
    },
  },
  {
    id: cabinet.id,
    examples: cabinet.examples,
    parts(params, inputs) {
      const p = cabinet.params.safeParse(params);
      const s = cabinet.structuralInputs.safeParse(inputs);
      if (!p.success || !s.success) return undefined;
      const made = cabinet.generate(p.data, s.data);
      return made.ok ? made.output.design.parts : undefined;
    },
    sample(r) {
      const p = cabinetWorked.params;
      const boardThickness = r.between(0.75, 1.25);
      const legSize = r.between(1, 3);
      return {
        structuralInputs: cabinetWorked.structuralInputs,
        params: {
          ...p,
          width: r.between(30, 72),
          bayHeight: r.between(12, 18),
          caseDepth: r.between(13, 20),
          bays: r.int(2, 4),
          panelThickness: r.between(0.625, Math.min(1, boardThickness)),
          dadoDepth: r.between(0.0625, 0.5),
          stoppedSetback: r.between(0.0625, 2),
          endOverhang: r.between(0, 2),
          frontOverhang: r.between(0, 2),
          legShowing: r.between(2, 12),
          apronHeight: r.between(1.5, 5),
          legStock: { ...p.legStock, size: legSize },
          footSize: r.between(0.0625, legSize),
          apronSetback: r.between(0, 1),
          tenonThickness: r.between(0.0625, 0.5),
          tenonLength: r.between(0.0625, 1.5),
          doors: r.pick(['sliding', 'none'] as const),
          door: {
            clearance: r.between(0, 0.125),
            land: r.between(0.125, 0.5),
            bottomDepth: r.between(0.125, 0.5),
            topDepth: r.between(0.25, 1),
            overlap: r.between(0, 2),
            frameWidth: r.between(1.5, 4),
            grooveDepth: r.between(0.25, 0.5),
          },
          railHeight: r.between(2, 4),
          board: { ...p.board, thickness: boardThickness, width: r.between(3.5, 7.25) },
        },
      };
    },
  },
  {
    id: bench.id,
    examples: bench.examples,
    parts(params, inputs) {
      const p = bench.params.safeParse(params);
      const s = bench.structuralInputs.safeParse(inputs);
      if (!p.success || !s.success) return undefined;
      const made = bench.generate(p.data, s.data);
      return made.ok ? made.output.design.parts : undefined;
    },
    sample(r) {
      const caseThickness = r.between(0.625, 0.75);
      const legSize = r.between(2.5, 4);
      return {
        structuralInputs: benchWorked.structuralInputs,
        params: {
          ...benchWorked.params,
          height: r.between(28, 42),
          topLength: r.between(36, 96),
          topDepth: r.between(14, 30),
          topThickness: r.between(1.5, 4),
          overhangEnds: r.between(2, 12),
          overhangFront: r.between(0, 3),
          overhangBack: r.between(0, 3),
          legSize,
          footHeight: r.between(2, 4),
          footPast: r.between(0, 3),
          lowRailHeight: r.between(2, 5),
          endRailHeight: r.between(2, 5),
          railThickness: r.between(1, legSize),
          caseThickness,
          dadoDepth: r.between(0.0625, caseThickness / 2),
          stopSetback: r.between(0.0625, 1),
          drawerBand: r.between(6, 14),
          upperOpening: r.between(2, 5),
          chopThickness: r.between(1.5, 3),
        },
      };
    },
  },
];

/** One plan's parts, from an example or a sweep draw. */
export interface Drawn {
  /** Such as "workbench / sweep 12". */
  source: string;
  parts: readonly Part[];
}

/**
 * Every template's examples, then `sweepCount` seeded draws per template. Parameters a template
 * refuses are skipped, as a sweep skips them.
 */
export function templatePlans({ sweepCount, seed }: { sweepCount: number; seed: number }): Drawn[] {
  const out: Drawn[] = [];
  for (const t of TEMPLATES) {
    for (const e of t.examples) {
      const parts = t.parts(e.params, e.structuralInputs);
      if (parts) out.push({ source: `${t.id} / ${e.name}`, parts });
    }
    const random = seeded(seed);
    for (let i = 0; i < sweepCount; i++) {
      const drawn = t.sample(random);
      const parts = t.parts(drawn.params, drawn.structuralInputs);
      if (parts) out.push({ source: `${t.id} / sweep ${i}`, parts });
    }
  }
  return out;
}

/** Two instances with the same lengths, allowances, and piece lengths need the same boards. */
function instanceKey(instance: Instance): string {
  return JSON.stringify([
    instance.lengths,
    instance.kerf,
    instance.trimPerEnd,
    instance.pieces.map((p) => p.length).sort((a, b) => a - b),
  ]);
}

/**
 * The benchmark's instances: each plan's stocks from `templatePlans`. An instance the same as one
 * already listed is left out, so a stock that no parameter changes counts once.
 */
export function benchmarkInstances(options: { sweepCount: number; seed: number }): Sourced[] {
  const out: Sourced[] = [];
  const keys = new Set<string>();
  for (const { source, parts } of templatePlans(options)) {
    for (const instance of instancesFromParts(parts)) {
      const key = instanceKey(instance);
      if (keys.has(key)) continue;
      keys.add(key);
      out.push({ source: `${source}, ${instance.nominal}`, instance });
    }
  }
  return out;
}
