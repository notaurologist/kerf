import type { RecordCabinetParams } from './params.ts';
import type { RecordCabinetStructuralInputs } from './structural.ts';

// Worked examples from docs/templates/record-cabinet.md. The largest item on the top and the
// weight on it are illustrative. The boards are 4/4 hardwood surfaced two sides, 13/16" thick (Wood Handbook,
// Table 6-4), which flattens to the 3/4" panels; the allowances are the values the starting
// questions suggest. The moisture range is the Wood Handbook's for individual pieces indoors
// (Table 13-2).

export const WORKED_EXAMPLE = {
  width: 54,
  bayHeight: 13.25,
  caseDepth: 17,
  bays: 3,
  panelThickness: 0.75,
  dadoDepth: 0.1875,
  stoppedSetback: 0.5,
  endOverhang: 0.75,
  frontOverhang: 0.75,
  legShowing: 5,
  apronHeight: 2.5,
  legStock: { size: 1.5, lengths: [3, 4] },
  footSize: 1,
  apronSetback: 0.125,
  tenonThickness: 0.25,
  tenonLength: 1,
  doors: 'sliding',
  door: {
    clearance: 0.0625,
    land: 0.25,
    bottomDepth: 0.25,
    topDepth: 0.5625,
    overlap: 0.5,
    frameWidth: 2,
    grooveDepth: 0.375,
  },
  railHeight: 3,
  jacket: 12.375,
  topItem: { width: 16.5, depth: 13.5, height: 15 },
  board: { source: 'store', thickness: 0.8125, width: 5.5, lengths: [4, 6, 8] },
  allowances: { jointPerEdge: 0.0625, rip: 0.5, trimPerEnd: 1, flatten: 0.0625 },
} satisfies RecordCabinetParams;

const cherry: RecordCabinetStructuralInputs = {
  species: 'black-cherry',
  orientation: 'flatsawn',
  moisture: { low: 6, high: 10 },
  recordLoad: 40,
  topLoad: 35,
  deflectionLimit: 144,
};

const EDGE_EXAMPLE: RecordCabinetParams = {
  ...WORKED_EXAMPLE,
  width: 30,
  bayHeight: 15,
  caseDepth: 13,
  bays: 2,
  panelThickness: 1,
  dadoDepth: 0.25,
  endOverhang: 1,
  frontOverhang: 1,
  legShowing: 3,
  apronHeight: 2,
  legStock: { size: 1.75, lengths: [3] },
  footSize: 1.25,
  apronSetback: 0,
  tenonThickness: 0.375,
  tenonLength: 1.25,
  // Too shallow for records behind the tracks, so the edge of range has no doors.
  doors: 'none',
  topItem: { width: 15, depth: 13, height: 15 },
  // 5/4 surfaced two sides is 1-1/16" (Wood Handbook, Table 6-4), which flattens to 1".
  board: { source: 'store', thickness: 1.0625, width: 5.5, lengths: [4, 6, 8] },
};

export const EXAMPLES: readonly {
  name: string;
  start?: string;
  params: RecordCabinetParams;
  structuralInputs: RecordCabinetStructuralInputs;
}[] = [
  {
    name: 'Worked example, every input entered',
    start: "The spec's worked example: three bays under a window",
    params: WORKED_EXAMPLE,
    structuralInputs: cherry,
  },
  { name: 'Worked example, no structural inputs', params: WORKED_EXAMPLE, structuralInputs: {} },
  {
    name: 'Edge of range: two bays, 1" walnut panels',
    params: EDGE_EXAMPLE,
    structuralInputs: { ...cherry, species: 'black-walnut' },
  },
];
