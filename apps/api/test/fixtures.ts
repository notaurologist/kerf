import { swingSetAFrame, type TemplateDefinition } from '@kerf/core';
import { z } from 'zod';

// The swing-set worked example (docs/templates/swing-set-a-frame.md) and its structural inputs.

export const swingSetParams = {
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

export const swingSetInputs = {
  beamSpeciesGrade: 'southern-pine-no2',
  beamIncised: false,
  beamMoistureContent: 30,
  riderWeights: [150, 150],
  maxSwingAngle: 60,
  dynamicFactor: 2,
  deflectionLimit: 240,
  hangerRating: 1200,
};

const swingSet = swingSetAFrame.definition as TemplateDefinition;

// A made-up next shape of the swing-set snapshot that renames outputs.cutList to outputs.cuts,
// with its upgrade (decision 0014).
export const nextShape: TemplateDefinition = {
  ...swingSet,
  snapshotVersion: swingSet.snapshotVersion + 1,
  outputs: z.looseObject({ cuts: z.array(z.object({ length: z.string() }).loose()) }),
  // Its plan reads the renamed field, as a real next shape's would.
  plan: (outputs) => {
    const { cuts, ...rest } = outputs as { cuts: unknown };
    return swingSet.plan({ ...rest, cutList: cuts });
  },
  snapshotUpgrades: {
    ...swingSet.snapshotUpgrades,
    [swingSet.snapshotVersion]: (s) => {
      const { cutList, ...outputs } = s.outputs as { cutList: unknown };
      return { ...s, outputs: { ...outputs, cuts: cutList } };
    },
  },
};
