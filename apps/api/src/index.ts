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

// Only this machine reaches the development API, not others on the same network.
serve({ fetch: app.fetch, hostname: 'localhost', port: config.port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
