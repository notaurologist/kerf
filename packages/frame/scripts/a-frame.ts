// Prints the exploratory A-frame analysis for the swing set's worked example (spec, Worked
// example), buried and on pads, with the structural inputs of its worked examples 4 and 5.
// Run with: pnpm --filter @kerf/frame a-frame

import { swingSetAFrame } from '@kerf/core';
import { type AFrameInputs, type AFrameReport, aFrameAnalysis } from '../src/aFrame.ts';

const INPUTS: AFrameInputs = {
  riderWeights: [150, 150],
  maxSwingAngle: 60,
  dynamicFactor: 2,
  beamSpeciesGrade: 'southern-pine-no2',
  beamMoistureContent: 30,
  legSpeciesGrade: 'southern-pine-no2',
  legIncised: false,
  crossbarSpeciesGrade: 'southern-pine-no2',
  crossbarIncised: false,
  gussetSpeciesGrade: 'southern-pine-no2',
  gussetIncised: false,
};

const RUNS = [
  {
    title: 'Worked example, legs buried 24", riders 150 and 150 lb',
    params: swingSetAFrame.WORKED_EXAMPLE,
    inputs: INPUTS,
  },
  {
    title: 'Worked example on pads, riders 200 and 80 lb (structural example 4)',
    params: {
      ...swingSetAFrame.WORKED_EXAMPLE,
      burialDepth: 0,
      hardware: { ...swingSetAFrame.WORKED_EXAMPLE.hardware, anchorsPerFoot: 1, anchorRating: 500 },
    },
    inputs: { ...INPUTS, riderWeights: [200, 80] as [number, number] },
  },
];

const n = (x: number, digits = 2) =>
  x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function print(title: string, report: AFrameReport): void {
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
      `${name}: ${s.nominal}, ${n(s.depth, 3)} deep in the plane, ${s.basis} = ${n(s.e, 0)} psi`,
    );
  }
  console.log('\nAssumptions:');
  for (const a of report.assumptions) console.log(`- ${a}`);
  let last = '';
  for (const c of report.cases) {
    const head = `${c.frame} frame. ${c.load} (φ = ${n(c.phi)}°): at the bolt's center Fx ${n(c.applied.fx)} lb, Fy ${n(c.applied.fy)} lb, M ${n(c.applied.moment)} in-lb`;
    if (head !== last) console.log(`\n${head}`);
    last = head;
    console.log(`  ${c.supports}, joints ${c.joints}: ${c.assumptions.at(-1)}`);
    const a = c.analysis;
    if (a.kind === 'mechanism') {
      console.log(`    ${a.message}`);
      continue;
    }
    for (const foot of ['back-foot', 'front-foot']) {
      const r = a.reactions[foot];
      if (r) console.log(`    ${foot}: Rx ${n(r.fx)} lb, Ry ${n(r.fy)} lb, M ${n(r.moment)} in-lb`);
    }
    for (const side of ['back', 'front']) {
      const segs = Object.entries(a.memberForces).filter(([id]) => id.startsWith(`${side}-leg`));
      const axial = segs.map(([, f]) => n(f.start.axial)).join(', ');
      const moment = Math.max(
        ...segs.flatMap(([, f]) => [Math.abs(f.start.moment), Math.abs(f.end.moment)]),
      );
      console.log(
        `    ${side} leg compression, top to foot: ${axial} lb; largest moment ${n(moment)} in-lb`,
      );
    }
    const cb = a.memberForces.crossbar;
    const gf = a.memberForces['gusset-front'];
    const gb = a.memberForces['gusset-back'];
    if (cb && gf && gb)
      console.log(
        `    crossbar tension ${n(-cb.start.axial)} lb; gusset tension ${n(-gf.start.axial)} (front half), ${n(-gb.start.axial)} (back half) lb; gusset moment under the beam ${n(gf.end.moment)} in-lb`,
      );
    const top = a.displacements.top;
    if (top)
      console.log(
        `    the beam moves ${n(top.x, 4)} in toward the back, ${n(top.y, 4)} in up, and turns ${n(top.rotation ?? 0, 6)} rad`,
      );
  }
}

for (const run of RUNS) {
  const made = swingSetAFrame.generate(run.params);
  if (!made.ok) throw new Error(made.issues.map((i) => i.message).join('; '));
  print(run.title, aFrameAnalysis(made.output, run.inputs));
}
