import type { RecordCabinetParams } from './params.ts';
import type { RecordCabinetStructuralInputs } from './structural.ts';

// Worked examples from docs/templates/record-cabinet.md. The turntable's size and weight are
// illustrative, since the owner has not bought it; the speaker is the Sonos Five as Sonos lists it
// (spec, [S1]). The boards are 4/4 hardwood surfaced two sides, 13/16" thick (Wood Handbook,
// Table 6-4), which flattens to the 3/4" panels; the allowances are the values the starting
// questions suggest. The moisture range is the Wood Handbook's for individual pieces indoors
// (Table 13-2).

export const WORKED_EXAMPLE: RecordCabinetParams = {
  width: 54,
  height: 20,
  caseDepth: 15,
  bays: 3,
  panelThickness: 0.75,
  dadoDepth: 0.1875,
  stoppedSetback: 0.5,
  endOverhang: 0.75,
  frontOverhang: 0.75,
  shelfHeight: 5.25,
  cutoutHeight: 4,
  footWidth: 2.5,
  railHeight: 3,
  jacket: 12.375,
  turntable: { width: 16.5, depth: 13.5, lidHeight: 15 },
  speaker: { width: 14.33, height: 7.99, depth: 6.06, place: 'top' },
  board: { source: 'store', thickness: 0.8125, width: 5.5, lengths: [4, 6, 8] },
  allowances: { jointPerEdge: 0.0625, rip: 0.5, trimPerEnd: 1, flatten: 0.0625 },
};

const cherry: RecordCabinetStructuralInputs = {
  species: 'black-cherry',
  orientation: 'flatsawn',
  moisture: { low: 6, high: 10 },
  recordLoad: 40,
  turntableWeight: 20,
  speakerWeight: 13.89,
  deflectionLimit: 144,
};

export const EDGE_EXAMPLE: RecordCabinetParams = {
  ...WORKED_EXAMPLE,
  width: 30,
  height: 30,
  caseDepth: 13,
  bays: 2,
  panelThickness: 1,
  dadoDepth: 0.25,
  endOverhang: 1,
  frontOverhang: 1,
  shelfHeight: 10,
  cutoutHeight: 8,
  footWidth: 3,
  turntable: { width: 15, depth: 13, lidHeight: 15 },
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
    start: "The spec's worked example: three bays under a window, the speaker on top",
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
