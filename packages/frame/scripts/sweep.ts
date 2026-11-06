// Runs the exploratory frame analysis over the swing set's worked examples and its seeded sweep,
// and writes the report the write-up quotes.
// Run with: pnpm --filter @kerf/frame sweep

import { writeFileSync } from 'node:fs';
import { SOUTHERN_PINE_SHEAR_RATIOS, shearRatio } from '../src/space/torsion.ts';
import { runSweep } from '../src/sweep.ts';
import { sweepMarkdown } from '../src/sweepReport.ts';

const REPORT = new URL('../../../docs/explorations/frame-analysis-sweep.md', import.meta.url);

// G/E: the lowest √(G_LR·G_LT)/E_L of the Southern Pine species Wood Handbook Table 5–1 lists, as
// step 4's script takes it.
const lowest = [...SOUTHERN_PINE_SHEAR_RATIOS].sort((a, b) => shearRatio(a) - shearRatio(b))[0];
if (!lowest) throw new Error('No shear ratios.');

const run = runSweep({
  shearModulus: {
    ratio: shearRatio(lowest),
    basis: `√(G_LR·G_LT)/E_L for ${lowest.species} pine, Wood Handbook FPL-GTR-282 Table 5–1, p. 5–2, and Eq. 9–9, p. 9–5`,
  },
  crossbarAndGusset: 'as the legs',
});
writeFileSync(REPORT, sweepMarkdown(run));
console.log(`Wrote ${REPORT.pathname}`);
