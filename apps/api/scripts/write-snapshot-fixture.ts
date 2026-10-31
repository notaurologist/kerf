import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSnapshot, findTemplate } from '@kerf/core';

// Writes the fixture for a template's current version (decision 0014): its worked examples as
// snapshots, stored as JSON the way Postgres holds them. Run once each time a template's version
// is bumped; an existing fixture is never overwritten, because it stands for projects already
// stored by that version.
//   pnpm --filter @kerf/api write-snapshot-fixture <template-id>

const id = process.argv[2] ?? '';
const template = findTemplate(id);
if (!template) {
  console.error(`No template has the ID "${id}".`);
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const file = join(
  root,
  'packages/core/src/templates',
  template.id,
  'snapshots',
  `v${template.version}.json`,
);
if (existsSync(file)) {
  console.error(`${file} exists. Fixtures are never rewritten; bump the template version instead.`);
  process.exit(1);
}

const snapshots = template.examples.map((example) => {
  const result = createSnapshot(template, example.params, example.structuralInputs);
  if (!result.ok) throw new Error(`${example.name}: ${JSON.stringify(result.issues)}`);
  return result.output;
});
writeFileSync(file, `${JSON.stringify(snapshots, null, 2)}\n`);
console.log(`Wrote ${file}`);
