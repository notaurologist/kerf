import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// CI runs its checks only for changes outside Markdown and docs/ (0010). A test that reads a file
// CI skips can pass on a pull request whose checks never ran and then fail on the next one, so
// ciPaths.setup.ts records every file a test reads and fails the test file when CI would skip a
// change to it. The workflow always starts its job, so a required check reports on every pull
// request, and asks scripts/ci-changes.ts whether the change needs the checks.

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * The paths whose changes run CI's checks, as GitHub Actions path patterns; the last match decides.
 * A doc a test reads is listed again after the exclusions: `styles.test.ts` checks the stylesheets
 * against the breakpoints table in `docs/design/system.md`.
 */
export const CHECKED_PATHS: readonly string[] = [
  '**',
  '!**.md',
  '!docs/**',
  'docs/design/system.md',
];

/** A GitHub Actions path pattern as a regular expression: `*` stops at a slash, `**` does not. */
function patternToRegExp(pattern: string): RegExp {
  if (/[?[\]{}+]/.test(pattern)) throw new Error(`Unsupported characters in "${pattern}"`);
  const source = pattern
    .split('**')
    .map((part) =>
      part
        .split('*')
        .map((s) => s.replace(/[.^$|()\\/]/g, '\\$&'))
        .join('[^/]*'),
    )
    .join('.*');
  return new RegExp(`^${source}$`);
}

/** Whether a change to `path` (relative to the repository root) runs CI. The last match decides. */
export function runsCi(path: string, filter: readonly string[]): boolean {
  let runs = false;
  for (const pattern of filter) {
    const negated = pattern.startsWith('!');
    if (patternToRegExp(negated ? pattern.slice(1) : pattern).test(path)) runs = !negated;
  }
  return runs;
}

/** Whether a change to these paths needs CI's checks. With no paths known, it does. */
export function needsChecks(paths: readonly string[], filter = CHECKED_PATHS): boolean {
  return paths.length === 0 || paths.some((path) => runsCi(path, filter));
}

/** A file read inside the repository, relative to its root, or undefined for anything else. */
export function repositoryPath(path: unknown): string | undefined {
  const given =
    typeof path === 'string' ? path : path instanceof URL ? fileURLToPath(path) : undefined;
  if (given === undefined) return undefined;
  const from = relative(root, resolve(given));
  if (from.startsWith('..') || from.split(sep).includes('node_modules')) return undefined;
  return from.split(sep).join('/');
}

/** The global symbol holding the current test file's reads; ciPaths.plugin.ts records to it too. */
export const READS_KEY = 'kerf.test.reads';
const READS = Symbol.for(READS_KEY);

/** Files read by the current test file, relative to the repository root. */
export function reads(): Set<string> {
  const store = globalThis as { [READS]?: Set<string> };
  store[READS] ??= new Set();
  return store[READS];
}
