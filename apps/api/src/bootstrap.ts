import { createApp } from './app.ts';
import { type Config, loadConfig } from './config.ts';
import { type ConnectionOptions, createDatabase } from './db/client.ts';

// Validates the environment and, if it's wrong, logs every problem by variable name (never the
// values) before throwing. Each entry point then stops in its own way.
export function loadConfigOrReport(env: Record<string, string | undefined>): Config {
  try {
    return loadConfig(env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    throw error;
  }
}

export function createApi(config: Config, connection: ConnectionOptions = {}) {
  const { db } = createDatabase(config.databaseUrl, connection);
  return createApp({ db, passwordHash: config.passwordHash });
}

// Neon's pooled connection (decision 0006), as rowing-conditions uses it. Prepared statements
// are off, which any transaction pooler needs. Each function instance keeps a few connections and
// closes idle ones, and connecting allows time for Neon to wake from suspend.
export const POOLED_CONNECTION: ConnectionOptions = {
  prepare: false,
  max: 5,
  idle_timeout: 20,
  connect_timeout: 15,
};
