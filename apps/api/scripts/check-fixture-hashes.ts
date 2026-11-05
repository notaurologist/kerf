import { execFileSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changesFromBase, hashesFile, readHashes } from './snapshot-fixtures.ts';

// Fails when a fixture hash the base commit records was changed or removed (decision 0014). The
// test beside the fixtures compares them with the hash file in the same commit, so it cannot see
// a fixture edited together with its hash. CI passes the base: a pull request's base branch, or
// the commit main pointed to before a push.
//   pnpm --filter @kerf/api check-fixture-hashes <base-ref>

const base = process.argv[2];
if (!base) {
  console.error('Name the commit to compare with, such as origin/main.');
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const path = relative(root, hashesFile).split('\\').join('/');
let committed: string;
try {
  committed = execFileSync('git', ['-C', root, 'show', `${base}:${path}`], { encoding: 'utf8' });
} catch {
  console.error(`Could not read ${path} at ${base}. Fetch that commit first.`);
  process.exit(1);
}

const problems = changesFromBase(JSON.parse(committed), readHashes());
if (problems.length > 0) {
  console.error(
    `Fixture hashes differ from ${base}. A version's fixture is never rewritten; bump the ` +
      "template's version and run write-snapshot-fixture instead.",
  );
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(`Every fixture hash at ${base} is unchanged.`);
