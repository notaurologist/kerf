import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { catalogSample, catalogSampleFile } from './catalog-sample.ts';

// Rewrites the design system catalog's sample values from core, formatted as Biome checks them.
// Run it when the catalog sample test reports the committed file differs, which follows a template
// version bump.
//   pnpm --filter @kerf/api write-catalog-sample

writeFileSync(catalogSampleFile, `${JSON.stringify(catalogSample(), null, 2)}\n`);
execFileSync('pnpm', ['exec', 'biome', 'format', '--write', catalogSampleFile], {
  stdio: 'inherit',
});
console.log(`Wrote ${catalogSampleFile}`);
