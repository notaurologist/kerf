import { defineConfig } from 'vitest/config';
import { recordDataImports } from '../../apps/api/test/ciPaths.plugin.ts';

export default defineConfig({
  // Fails a test file that imports a path CI skips as JSON or ?raw (0010).
  plugins: [recordDataImports()],
  test: {
    expect: { requireAssertions: true },
    // Fails a test file that reads a path CI skips (0010).
    setupFiles: ['../../apps/api/test/ciPaths.setup.ts'],
  },
});
