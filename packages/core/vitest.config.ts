import { defineConfig } from 'vitest/config';
import { recordDataImports } from '../../apps/api/test/ciPaths.plugin.ts';

export default defineConfig({
  // Fails a test file that imports a path CI skips as JSON or ?raw (0010).
  plugins: [recordDataImports()],
  test: {
    // Generating a plan searches for the fewest feet of lumber, up to its work limit (decision
    // 0021), so a test that generates several workbench plans passes Vitest's 5 s default on
    // GitHub's runners: the slowest took 4.2 s there and 2.7 s on a busy development machine. The
    // properties test sets its own. What generation costs is checked in templates/planCost.test.ts.
    testTimeout: 10_000,
    expect: { requireAssertions: true },
    // Fails a test file that reads a path CI skips (0010).
    setupFiles: ['../../apps/api/test/ciPaths.setup.ts'],
  },
});
