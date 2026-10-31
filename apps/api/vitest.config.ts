import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The first test in each file starts PGlite, which took over 5 s (Vitest's default) on
    // GitHub's runners. Later tests clone that database and take milliseconds.
    testTimeout: 30_000,
    expect: { requireAssertions: true },
  },
});
