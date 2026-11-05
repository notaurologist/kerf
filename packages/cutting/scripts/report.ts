import { writeFileSync } from 'node:fs';
import { BASELINE, BOUNDS, benchmarkInstances, formatReport, runMethods } from '../src/index.ts';

// Writes the benchmark report the write-up quotes: every method on every instance.
// Usage: pnpm --filter @kerf/cutting report [sweep draws per template, default 200]

const sweepCount = Number(process.argv[2] ?? 200);
const methods = [BASELINE];
const rows = runMethods(benchmarkInstances({ sweepCount, seed: 544 }), methods, BOUNDS);
const path = new URL('../report.md', import.meta.url);
writeFileSync(path, formatReport(rows, methods));
console.log(`Wrote ${rows.length} instances to ${path.pathname}`);
