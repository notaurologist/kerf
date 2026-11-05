import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { recordDataImports } from '../api/test/ciPaths.plugin.ts';

// Every screen uses the text font, so the built page fetches it with the CSS rather than after
// the first render finds it. Its file name carries a hash, known only once the bundle is written.
function preloadTextFont(): Plugin {
  return {
    name: 'preload-text-font',
    transformIndexHtml: {
      order: 'post',
      handler: (_html, context) => {
        const file = Object.keys(context.bundle ?? {}).find((f) =>
          /AtkinsonHyperlegibleNext-Latin-[^/]*\.woff2$/.test(f),
        );
        if (!file) return [];
        const attrs = { rel: 'preload', href: `/${file}`, as: 'font', type: 'font/woff2' };
        return [{ tag: 'link', attrs: { ...attrs, crossorigin: '' }, injectTo: 'head' }];
      },
    },
  };
}

export default defineConfig({
  // The last fails a test file that imports a path CI skips as JSON or ?raw (0010); tests only.
  plugins: [react(), preloadTextFont(), recordDataImports()],
  // The commit Vercel builds from, which the API also sends, so an open page can tell it is older
  // (lib/build.ts). Empty in development and tests.
  define: { __KERF_BUILD__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA ?? '') },
  server: {
    // Same origin in production (0006). In development the API runs separately, so proxy to it.
    // The API serves its routes under /api itself, so paths pass through unchanged.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    // Some tests generate a workbench plan with core, which searches for the fewest feet of lumber
    // (decision 0021), and render it. The slowest took 5.8 s on GitHub's runners and 7.1 s on a
    // busy development machine, past Vitest's 5 s default.
    testTimeout: 15_000,
    expect: { requireAssertions: true },
    // Fails a test file that reads a path CI skips (0010).
    setupFiles: ['../api/test/ciPaths.setup.ts'],
  },
});
