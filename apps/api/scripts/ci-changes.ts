import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { needsChecks, root } from '../test/ciPaths.ts';

// Decides whether CI runs its checks for a change: not when it touches only Markdown or docs/
// (CHECKED_PATHS, decision 0010). The job always starts, so main's required check reports on
// every pull request, and its steps run only when this says so. Runs before pnpm install, so it
// uses nothing outside Node. When the changed files cannot be listed, the checks run.
//   node apps/api/scripts/ci-changes.ts <base-ref>

const base = process.argv[2];
let paths: string[] = [];
if (base) {
  try {
    paths = execFileSync('git', ['-C', root, 'diff', '--name-only', base, 'HEAD'], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter((line) => line !== '');
  } catch {
    console.log(`Could not list the files changed since ${base}; running every check.`);
  }
} else {
  console.log('No base commit given; running every check.');
}

const run = needsChecks(paths);
const files = `${paths.length} changed file${paths.length === 1 ? '' : 's'}`;
console.log(
  run
    ? paths.length === 0
      ? 'No changed files listed; running every check.'
      : `Running the checks: the ${files} include code.`
    : `Skipping the checks: the ${files} are Markdown or docs.`,
);
const output = process.env.GITHUB_OUTPUT;
if (output) appendFileSync(output, `run=${run}\n`);
