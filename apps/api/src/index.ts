import { serve } from '@hono/node-server';
import { app } from './app.ts';

// Local development and any plain Node host. Vercel gets its own entry point in M3.
const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
