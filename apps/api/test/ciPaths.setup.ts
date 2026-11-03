import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { afterAll } from 'vitest';
import { pullRequestFilter, reads, repositoryPath, runsCi } from './ciPaths.ts';

// Every package's Vitest config runs this before each test file. It records the files and folders
// the test file reads or checks for, and fails it when CI skips changes to one of them
// (ciPaths.ts). A stat is not recorded: walking a folder stats files a test then filters out.

const WRAPPED = Symbol.for('kerf.test.fsWrapped');

function record(path: unknown): void {
  const relative = repositoryPath(path);
  if (relative !== undefined) reads().add(relative);
}

const marked = fs as { [WRAPPED]?: true };
if (!marked[WRAPPED]) {
  marked[WRAPPED] = true;
  const sync = ['readFileSync', 'readdirSync', 'existsSync', 'openSync'] as const;
  for (const name of sync) {
    // The originals are overloaded; the wrapper passes every argument through unchanged.
    // biome-ignore lint/suspicious/noExplicitAny: forwards the arguments of any overload
    const original = fs[name] as (...args: any[]) => unknown;
    Object.assign(fs, {
      [name]: (...args: unknown[]) => {
        record(args[0]);
        return original(...args);
      },
    });
  }
  for (const name of ['readFile', 'readdir', 'open'] as const) {
    // biome-ignore lint/suspicious/noExplicitAny: forwards the arguments of any overload
    const original = fs.promises[name] as (...args: any[]) => Promise<unknown>;
    Object.assign(fs.promises, {
      [name]: (...args: unknown[]) => {
        record(args[0]);
        return original(...args);
      },
    });
  }
  syncBuiltinESMExports();
}

reads().clear();

afterAll(() => {
  const filter = pullRequestFilter();
  const skipped = [...reads()].filter((path) => !runsCi(path, filter)).sort();
  reads().clear();
  if (skipped.length > 0) {
    throw new Error(
      `This test file reads ${skipped.join(', ')}, which CI skips. Add each to the paths filters ` +
        'in .github/workflows/ci.yml after the exclusions, or move what the test needs out of docs.',
    );
  }
});
