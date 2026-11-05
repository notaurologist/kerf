import { writeFileSync } from 'node:fs';
import {
  BASELINE,
  BOUNDS,
  benchmarkInstances,
  exact,
  formatReport,
  formatWorkLimits,
  runMethods,
  WORK_LIMIT,
} from '../src/index.ts';

// Writes the benchmark report the write-up quotes: every method on every instance, and the exact
// method at each work limit.
// Usage: pnpm --filter @kerf/cutting report [sweep draws per template, default 200]

const sweepCount = Number(process.argv[2] ?? 200);
const LIMITS = [3e6, 10e6, 15e6, 20e6, 25e6, 30e6, 100e6];
const limits = [...new Set([...LIMITS, WORK_LIMIT])]
  .sort((a, b) => a - b)
  .map((limit) => ({ limit, method: exact(limit) }));
const rows = runMethods(
  benchmarkInstances({ sweepCount, seed: 544 }),
  [BASELINE, ...limits.map((l) => l.method)],
  BOUNDS,
);
const chosen = limits.find((l) => l.limit === WORK_LIMIT)?.method ?? exact(WORK_LIMIT);
const path = new URL('../report.md', import.meta.url);
writeFileSync(
  path,
  formatReport(rows, [BASELINE, chosen], [formatWorkLimits(rows, BASELINE, limits)]),
);
console.log(`Wrote ${rows.length} instances to ${path.pathname}`);
