import type { SwingSetParams } from './params.ts';
import type { SwingSetStructuralInputs } from './structural.ts';

// Worked examples from docs/templates/swing-set-a-frame.md. They write each snapshot shape
// version's fixture and test that generated snapshots still have that shape (decision 0014), so
// together they reach every optional part of the output: complete and missing structural inputs,
// solid and built-up beams, buried legs and pads.

export const WORKED_EXAMPLE: SwingSetParams = {
  beamLength: 120,
  beamHeight: 96,
  splay: { kind: 'angle', degrees: 20 },
  beamStock: '4x6',
  beamPlies: 1,
  legStock: '4x4',
  crossbarStock: '2x6',
  crossbarHeight: 40,
  gussetStock: '2x8',
  frameInset: 12,
  groundSlope: 1,
  burialDepth: 24,
  swings: { centers: [40, 80], hangerSpacing: 20, seatWidth: 20, seatHeight: 16 },
  hardware: {
    legBoltDiameter: 0.5,
    crossbarBolts: { diameter: 0.5, perJoint: 2 },
    gussetBolts: { diameter: 0.5, perJoint: 2 },
  },
};

const allInputs: SwingSetStructuralInputs = {
  beamSpeciesGrade: 'southern-pine-no2',
  beamIncised: false,
  beamMoistureContent: 30,
  riderWeights: [150, 150],
  maxSwingAngle: 60,
  dynamicFactor: 2,
  deflectionLimit: 240,
  hangerRating: 1200,
};

export const EXAMPLES: readonly {
  name: string;
  start?: string;
  params: SwingSetParams;
  structuralInputs: SwingSetStructuralInputs;
}[] = [
  {
    name: 'Worked example, every input entered',
    start: "The spec's worked example: one beam, two swings, legs buried",
    params: WORKED_EXAMPLE,
    structuralInputs: allInputs,
  },
  { name: 'Worked example, no structural inputs', params: WORKED_EXAMPLE, structuralInputs: {} },
  {
    name: 'Two-ply 2x6 beam on pads, level ground, footprint depth',
    start: 'A two-ply 2x6 beam, legs on pads, level ground',
    params: {
      ...WORKED_EXAMPLE,
      beamStock: '2x6',
      beamPlies: 2,
      groundSlope: 0,
      burialDepth: 0,
      splay: { kind: 'footprint', depth: 80 },
      hardware: {
        ...WORKED_EXAMPLE.hardware,
        plyBolts: { diameter: 0.5, count: 6 },
        anchorsPerFoot: 1,
      },
    },
    structuralInputs: allInputs,
  },
];
