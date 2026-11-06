// Prints the exploratory 3D analysis of the whole swing set for the spec's worked example, buried
// and on pads, with the structural inputs of its worked examples 4 and 5.
// Run with: pnpm --filter @kerf/frame swing-set

import { swingSetAFrame } from '@kerf/core';
import { SOUTHERN_PINE_SHEAR_RATIOS, shearRatio } from '../src/space/torsion.ts';
import {
  ALONG_THE_BEAM,
  type SwingSetInputs,
  type SwingSetReport,
  swingSetAnalysis,
} from '../src/swingSet.ts';

// G/E: the lowest √(G_LR·G_LT)/E_L of the Southern Pine species Wood Handbook Table 5–1 lists.
const lowest = [...SOUTHERN_PINE_SHEAR_RATIOS].sort((a, b) => shearRatio(a) - shearRatio(b))[0];
if (!lowest) throw new Error('No shear ratios.');
const highest = [...SOUTHERN_PINE_SHEAR_RATIOS].sort((a, b) => shearRatio(b) - shearRatio(a))[0];
if (!highest) throw new Error('No shear ratios.');
const ratio = (row: typeof lowest) => ({
  ratio: shearRatio(row),
  basis: `√(G_LR·G_LT)/E_L for ${row.species} pine, Wood Handbook FPL-GTR-282 Table 5–1, p. 5–2, and Eq. 9–9, p. 9–5`,
});

const INPUTS: SwingSetInputs = {
  riderWeights: [150, 150],
  maxSwingAngle: 60,
  dynamicFactor: 2,
  beamSpeciesGrade: 'southern-pine-no2',
  beamIncised: false,
  beamMoistureContent: 30,
  legSpeciesGrade: 'southern-pine-no2',
  legIncised: false,
  crossbarSpeciesGrade: 'southern-pine-no2',
  crossbarIncised: false,
  gussetSpeciesGrade: 'southern-pine-no2',
  gussetIncised: false,
  shearModulus: ratio(lowest),
};

const PADS = {
  ...swingSetAFrame.WORKED_EXAMPLE,
  burialDepth: 0,
  hardware: { ...swingSetAFrame.WORKED_EXAMPLE.hardware, anchorsPerFoot: 1, anchorRating: 500 },
};

const RUNS = [
  {
    title: 'Worked example, legs buried 24", riders 150 and 150 lb',
    params: swingSetAFrame.WORKED_EXAMPLE,
    inputs: INPUTS,
  },
  {
    title: 'Worked example on pads, riders 200 and 80 lb (structural example 4)',
    params: PADS,
    inputs: { ...INPUTS, riderWeights: [200, 80] as [number, number] },
  },
];

const n = (x: number, digits = 2) =>
  x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function print(title: string, report: SwingSetReport): void {
  console.log(`\n${report.heading}\n${title}\n`);
  if (report.status === 'input-needed') {
    console.log(`Input needed: ${report.missing.join(', ')}`);
    return;
  }
  if (report.status === 'not-computed') {
    console.log(`Not computed: ${report.reason}`);
    return;
  }
  for (const [name, s] of Object.entries(report.sections)) {
    console.log(
      `${name}: ${s.nominal}, ${n(s.depth, 3)} by ${n(s.breadth, 3)}; E ${n(s.e, 0)} psi, G ${n(s.g, 0)} psi, Iz ${n(s.iz, 3)}, Iy ${n(s.iy, 3)}, J ${n(s.j, 3)} in⁴. ${s.basis}`,
    );
  }
  for (const f of report.geometry.frames) {
    console.log(
      `${f.name} frame: legs' centerline at x = ${n(f.x, 3)}, crossbar and gusset at x = ${n(f.crossbarX, 3)}, gusset bearing at x = ${n(f.bearingX, 3)}`,
    );
  }
  console.log('\nAssumptions:');
  for (const a of report.assumptions) console.log(`- ${a}`);
  let last = '';
  for (const c of report.cases) {
    const head = `${c.load}${c.phi === null ? '' : ` (φ = ${n(c.phi)}°)`}`;
    if (head !== last) console.log(`\n${head}`);
    last = head;
    console.log(`  ${c.supports}, joints ${c.joints}: ${c.assumptions.at(-1)}`);
    const r = c.result;
    if (r.kind !== 'solved') {
      console.log(`    ${r.message}`);
      continue;
    }
    if (c.load === ALONG_THE_BEAM) {
      console.log(
        `    each frame's top moves ${n(r.sway.left, 6)} in (left) and ${n(r.sway.right, 6)} in (right) along the beam per pound; ${n(1 / r.sway.left, 1)} lb per inch`,
      );
    } else {
      console.log(
        `    each frame's top moves ${n(r.sway.left, 6)} in (left) and ${n(r.sway.right, 6)} in (right) along the beam`,
      );
    }
    for (const [id, f] of Object.entries(r.analysis.reactions)) {
      console.log(
        `    ${id}: Fx ${n(f.fx, c.load === ALONG_THE_BEAM ? 4 : 2)} lb, Fy ${n(f.fy)} lb, Fz ${n(f.fz)} lb`,
      );
    }
  }
}

for (const run of RUNS) {
  const made = swingSetAFrame.generate(run.params);
  if (!made.ok) throw new Error(made.issues.map((i) => i.message).join('; '));
  print(run.title, swingSetAnalysis(made.output, run.inputs));
}

// How much G moves the sway: the same stiffness case with the highest ratio Table 5–1 lists.
console.log(`\nWith G from ${highest.species} pine instead of ${lowest.species}:`);
for (const run of RUNS) {
  const made = swingSetAFrame.generate(run.params);
  if (!made.ok) throw new Error(made.issues.map((i) => i.message).join('; '));
  const a = swingSetAnalysis(made.output, run.inputs);
  const b = swingSetAnalysis(made.output, { ...run.inputs, shearModulus: ratio(highest) });
  if (a.status !== 'computed' || b.status !== 'computed') continue;
  a.cases.forEach((c, i) => {
    const other = b.cases[i];
    if (c.load !== ALONG_THE_BEAM || c.result.kind !== 'solved' || other?.result.kind !== 'solved')
      return;
    console.log(
      `  ${run.title}, ${c.supports}, joints ${c.joints}: ${n(c.result.sway.left, 6)} and ${n(other.result.sway.left, 6)} in per pound`,
    );
  });
}
