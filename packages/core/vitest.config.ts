import { defineConfig } from 'vitest/config';

// Core has no code until M1. Remove passWithNoTests when the first tests land, so a package
// whose tests go missing fails instead of passing quietly.
export default defineConfig({
  test: {
    passWithNoTests: true,
  },
});
