import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Generating a plan searches for the fewest feet of lumber, up to its work limit (decision
    // 0021): about 0.8 s for a workbench on a development machine and up to about 3 s on GitHub's
    // runners, so a test that generates a few plans passes Vitest's 5 s default there.
    testTimeout: 30_000,
    expect: { requireAssertions: true },
    // Fails a test file that reads a path CI skips (0010).
    setupFiles: ['../../apps/api/test/ciPaths.setup.ts'],
  },
});
