import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSnapshot, findTemplate } from '@kerf/core';
import {
  fixtureFolder,
  hashesFile,
  hashOf,
  readHashes,
  shownFolder,
  shownFor,
} from './snapshot-fixtures.ts';

// Writes the fixture for a template's current version (decision 0014): its worked examples as
// snapshots, stored as JSON the way Postgres holds them, and what those plans show when read. It
// replaces the previous version's copy of what plans show, and records the hash of both files.
// Run once each time a template's version is bumped; a version already written is never written
// again, because its fixture stands for projects already stored by that version.
//   pnpm --filter @kerf/api write-snapshot-fixture <template-id>

const id = process.argv[2] ?? '';
const template = findTemplate(id);
if (!template) {
  console.error(`No template has the ID "${id}".`);
  process.exit(1);
}

const folder = fixtureFolder(template.id);
const name = `v${template.version}.json`;
const file = join(folder, name);
const hashes = readHashes();
if (existsSync(file) || hashes[template.id]?.[name]) {
  console.error(
    `${file} was already written. Fixtures are never rewritten; bump the template version instead.`,
  );
  process.exit(1);
}

const snapshots = template.examples.map((example) => {
  const result = createSnapshot(template, example.params, example.structuralInputs);
  if (!result.ok) throw new Error(`${example.name}: ${JSON.stringify(result.issues)}`);
  return result.output;
});
writeFileSync(file, `${JSON.stringify(snapshots, null, 2)}\n`);

const shownIn = shownFolder(template.id);
rmSync(shownIn, { recursive: true, force: true });
mkdirSync(shownIn);
const shown = join(shownIn, name);
const stored = JSON.parse(JSON.stringify(snapshots));
writeFileSync(shown, `${JSON.stringify(shownFor(template, stored), null, 2)}\n`);

const kept = Object.entries(hashes[template.id] ?? {}).filter(([f]) => !f.startsWith('shown/'));
hashes[template.id] = Object.fromEntries([
  ...kept,
  [name, hashOf(file)],
  [`shown/${name}`, hashOf(shown)],
]);
writeFileSync(hashesFile, `${JSON.stringify(hashes, null, 2)}\n`);
console.log(`Wrote ${file} and ${shown}, and their hashes in ${hashesFile}`);
