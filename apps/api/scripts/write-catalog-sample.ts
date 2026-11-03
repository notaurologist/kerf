import { writeFileSync } from 'node:fs';
import { catalogSample, catalogSampleFile } from './catalog-sample.ts';

// Rewrites the design system catalog's sample values from core. Run it when the catalog sample
// test reports the committed file differs, which follows a template version bump. The file is left
// out of Biome, since it grew past Biome's 1 MB limit.
//   pnpm --filter @kerf/api write-catalog-sample

writeFileSync(catalogSampleFile, `${JSON.stringify(catalogSample(), null, 2)}\n`);
console.log(`Wrote ${catalogSampleFile}`);
