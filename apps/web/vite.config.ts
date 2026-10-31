import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

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
  plugins: [react(), preloadTextFont()],
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
