import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createDatabase } from './db/client.ts';

// Local development and any plain Node host.
const config = loadConfig(process.env);
const { db } = createDatabase(config.databaseUrl);
const app = createApp({ db, passwordHash: config.passwordHash });

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
