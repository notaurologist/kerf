import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// CI skips changes that touch only Markdown or docs/ (0010). A test that reads a skipped file can
// pass on a pull request that never ran CI and then fail on the next one, so ciPaths.setup.ts
// records every file a test reads and fails the test file when CI would skip a change to it.

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const workflow = join(root, '.github', 'workflows', 'ci.yml');

/** The `paths` filter of each event in the CI workflow, in order. */
export function ciFilters(yaml: string): Record<string, string[]> {
  const filters: Record<string, string[]> = {};
  let event: string | undefined;
  let inPaths = false;
  for (const line of yaml.split('\n')) {
    const key = line.match(/^ {2}([a-z_]+):\s*$/);
    if (key) {
      event = key[1];
      inPaths = false;
      continue;
    }
    if (/^ {4}paths(-ignore)?:/.test(line)) {
      if (line.includes('paths-ignore'))
        throw new Error('Use paths with ! exclusions, not paths-ignore');
      inPaths = true;
      continue;
    }
    const item = line.match(/^ {6}- "([^"]+)"\s*$/);
    if (inPaths && item && event) {
      filters[event] = [...(filters[event] ?? []), item[1] ?? ''];
      continue;
    }
    inPaths = false;
  }
  return filters;
}

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

/** The pull request filter, which the push filter must equal. */
export function pullRequestFilter(): string[] {
  const filter = ciFilters(readFileSync(workflow, 'utf8')).pull_request;
  if (!filter?.length) throw new Error(`No paths filter for pull_request in ${workflow}`);
  return filter;
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

const READS = Symbol.for('kerf.test.reads');

/** Files read by the current test file, relative to the repository root. */
export function reads(): Set<string> {
  const store = globalThis as { [READS]?: Set<string> };
  store[READS] ??= new Set();
  return store[READS];
}
