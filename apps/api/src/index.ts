import { serve } from '@hono/node-server';
import { createApi, loadConfigOrReport } from './bootstrap.ts';

// Local development and any plain Node host.
let config: ReturnType<typeof loadConfigOrReport>;
try {
  config = loadConfigOrReport(process.env);
} catch {
  process.exit(1);
}
const app = createApi(config);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
