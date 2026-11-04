import type { WorkbenchParams } from './params.ts';
import type { WorkbenchStructuralInputs } from './structural.ts';

// Worked examples from docs/templates/workbench.md. The owner's sizes come from their photo; the
// slides', hinge's, and vise screws' figures are illustrative until the owner enters theirs, as
// are the cherry, the weight on the top, and the deflection limit. The boards are 4/4 hardwood
// surfaced two sides, 13/16" thick (Wood Handbook, Table 6-4).

export const WORKED_EXAMPLE = {
  height: 34.125,
  topLength: 61.875,
  topDepth: 17.625,
  topThickness: 2.5,
  overhangEnds: 5,
  overhangFront: 0,
  overhangBack: 1,
  legSize: 3,
  footHeight: 3,
  footPast: 1,
  lowRailHeight: 3,
  endRailHeight: 3,
  railThickness: 1.5,
  railTenon: { thickness: 0.5, length: 1.75, shoulder: 0.25 },
  legTenon: { thickness: 1, shoulder: 0.25, footLength: 1.75 },
  caseThickness: 0.75,
  dadoDepth: 0.1875,
  stopSetback: 0.5,
  drawerBand: 10,
  upperOpening: 3.25,
  back: { grooveWidth: 0.25, grooveDepth: 0.375, inset: 0.375, shelfGap: 0.0625 },
  slides: { sideClearance: 0.5, shortest: 10, longest: 28, step: 2 },
  drawer: {
    boxThickness: 0.5,
    bottomThickness: 0.5,
    frontThickness: 0.75,
    frontGap: 0.0625,
    clearance: 0.25,
    groove: { width: 0.25, depth: 0.25, up: 0.25 },
    slope: 8,
  },
  door: {
    gap: 0.0625,
    frameWidth: 2,
    grooveWidth: 0.25,
    grooveDepth: 0.375,
    hingeFromEnd: 3,
    // A 35 mm cup (Striegler, Fine Homebuilding 213); the rest made up for the example.
    hinge: {
      cupDiameter: 35 / 25.4,
      cupDepth: 0.5,
      cupFromEdge: 0.1875,
      plateSetback: 0.625,
      plateScrews: 2,
      plateScrewSpacing: 1.25,
      minThickness: 0.625,
      maxThickness: 1,
    },
  },
  chopThickness: 2.5,
  vise: {
    face: {
      height: 14,
      screwBelow: 4,
      screw: {
        screwHole: 1.125,
        maxOpening: 8,
        guides: 1,
        guideHole: 0.875,
        guideFromScrew: 5,
        mountingScrews: 4,
      },
    },
    end: {
      blockHeight: 3.5,
      screw: {
        screwHole: 1.125,
        maxOpening: 8,
        guides: 2,
        guideHole: 0.875,
        guideFromScrew: 4,
        mountingScrews: 4,
      },
    },
    dogs: { diameter: 0.75, spacing: 4, fromFront: 2, stopShort: 0.25 },
  },
  board: { source: 'store', thickness: 0.8125, width: 5.5, lengths: [6, 8, 10] },
  allowances: { jointPerEdge: 0.0625, rip: 0.5, trimPerEnd: 1, flatten: 0.0625 },
  kerf: 0.125,
} satisfies WorkbenchParams;

export const CHERRY: WorkbenchStructuralInputs = {
  species: 'black-cherry',
  orientation: 'flatsawn',
  moisture: { low: 6, high: 10 },
  topLoad: 300,
  deflectionLimit: 144,
};

export const EXAMPLES: readonly {
  name: string;
  start?: string;
  params: WorkbenchParams;
  structuralInputs: WorkbenchStructuralInputs;
}[] = [
  {
    name: 'Worked example, every input entered',
    start: "The spec's worked example: the owner's bench, 64-3/8 long with its vises closed",
    params: WORKED_EXAMPLE,
    structuralInputs: CHERRY,
  },
  { name: 'Worked example, no structural inputs', params: WORKED_EXAMPLE, structuralInputs: {} },
  {
    name: 'Edge of range: the tallest bench, with a 4" top',
    params: { ...WORKED_EXAMPLE, height: 42, topThickness: 4 },
    structuralInputs: CHERRY,
  },
];
