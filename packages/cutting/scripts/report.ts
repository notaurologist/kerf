import { writeFileSync } from 'node:fs';
import {
  BASELINE,
  BOUNDS,
  benchmarkInstances,
  exact,
  formatReport,
  runMethods,
} from '../src/index.ts';

// Writes the benchmark report the write-up quotes: every method on every instance.
// Usage: pnpm --filter @kerf/cutting report [sweep draws per template, default 200] [ms per instance for the exact method, default 5000]

const sweepCount = Number(process.argv[2] ?? 200);
const methods = [BASELINE, exact(Number(process.argv[3] ?? 5000))];
const rows = runMethods(benchmarkInstances({ sweepCount, seed: 544 }), methods, BOUNDS);
const path = new URL('../report.md', import.meta.url);
writeFileSync(path, formatReport(rows, methods));
console.log(`Wrote ${rows.length} instances to ${path.pathname}`);
