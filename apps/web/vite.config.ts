import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    // Same origin in production (0006). In development the API runs separately, so proxy to it.
    // The API serves its routes under /api itself, so paths pass through unchanged.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    expect: { requireAssertions: true },
  },
});
