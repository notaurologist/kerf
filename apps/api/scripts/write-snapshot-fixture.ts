import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSnapshot, findTemplate } from '@kerf/core';
import { SWEEPS, sweep, sweepDigest } from '@kerf/core/sweeps';
import {
  CURRENT_ONLY,
  fixtureFolder,
  hashesFile,
  hashOf,
  readHashes,
  shownFolder,
  shownFor,
  sweepsFolder,
} from './snapshot-fixtures.ts';

// Writes the fixture for a template's current version (decision 0014): its worked examples as
// snapshots, stored as JSON the way Postgres holds them, what those plans show when read, and a
// digest of what its seeded sweep generates. It replaces the previous version's copies of the
// last two, and records the hash of all three files.
// Run once each time a template's version is bumped; a version already written is never written
// again, because its fixture stands for projects already stored by that version.
//   pnpm --filter @kerf/api write-snapshot-fixture <template-id>

const id = process.argv[2] ?? '';
const template = findTemplate(id);
const plan = SWEEPS[id];
if (!template || !plan) {
  console.error(
    `No template has the ID "${id}", or it has no sweep in SWEEPS (templates/index.ts).`,
  );
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

/** Writes a file kept for the current version only, removing the previous version's. */
function replace(folder: string, content: unknown) {
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(folder);
  const written = join(folder, name);
  writeFileSync(written, `${JSON.stringify(content, null, 2)}\n`);
  return written;
}

const stored = JSON.parse(JSON.stringify(snapshots));
const shown = replace(shownFolder(template.id), shownFor(template, stored));

const swept = sweep(template, plan);
if (swept.failures.length > 0) {
  console.error(
    `The sweep failed, so its digest was not written:\n  ${swept.failures.join('\n  ')}`,
  );
  process.exit(1);
}
const digest = replace(sweepsFolder(template.id), sweepDigest(template, plan, swept));

const kept = Object.entries(hashes[template.id] ?? {}).filter(
  ([f]) => !CURRENT_ONLY.some((folder) => f.startsWith(folder)),
);
hashes[template.id] = Object.fromEntries([
  ...kept,
  [name, hashOf(file)],
  [`shown/${name}`, hashOf(shown)],
  [`sweeps/${name}`, hashOf(digest)],
]);
writeFileSync(hashesFile, `${JSON.stringify(hashes, null, 2)}\n`);
console.log(`Wrote ${file}, ${shown}, and ${digest}, and their hashes in ${hashesFile}`);
