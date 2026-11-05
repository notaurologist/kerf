import { READS_KEY, repositoryPath } from './ciPaths.ts';

// ciPaths.setup.ts records the files a test file reads through `fs`, in the test's own process.
// Vite reads a JSON or `?raw` import in its own process instead, so this adds a line to each such
// module that records its file when the module runs. Each test file runs its own copy of a module,
// so the line runs for every test file that imports it. Every package's Vitest config adds it.

/** Whether a module is a file's contents imported as data: JSON, or `?raw`. */
function isDataImport(id: string): boolean {
  const [file = '', query = ''] = id.split('?');
  return file.endsWith('.json') || new URLSearchParams(query).has('raw');
}

/** The Vite plugin that records data imports during tests. */
export function recordDataImports() {
  return {
    name: 'kerf-record-data-imports',
    enforce: 'post' as const,
    apply: (_config: unknown, env: { mode: string }) => env.mode === 'test',
    transform(code: string, id: string) {
      if (!isDataImport(id)) return null;
      const path = repositoryPath(id.split('?')[0]);
      if (path === undefined) return null;
      const record = `globalThis[Symbol.for(${JSON.stringify(READS_KEY)})]?.add(${JSON.stringify(path)});`;
      return { code: `${code}\n${record}\n`, map: null };
    },
  };
}
