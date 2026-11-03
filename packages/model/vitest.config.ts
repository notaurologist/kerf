import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    expect: { requireAssertions: true },
    // Fails a test file that reads a path CI skips (0010).
    setupFiles: ['../../apps/api/test/ciPaths.setup.ts'],
  },
});
