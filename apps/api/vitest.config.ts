import { defineConfig } from 'vitest/config';
import { recordDataImports } from './test/ciPaths.plugin.ts';

export default defineConfig({
  // Fails a test file that imports a path CI skips as JSON or ?raw (0010).
  plugins: [recordDataImports()],
  test: {
    // The first test in each file starts PGlite, which took up to 7.1 s on GitHub's runners and
    // 8.6 s on a busy development machine, past Vitest's 5 s default. Later tests empty that
    // database and take milliseconds.
    testTimeout: 20_000,
    expect: { requireAssertions: true },
    // Fails a test file that reads a path CI skips (0010).
    setupFiles: ['./test/ciPaths.setup.ts'],
  },
});
