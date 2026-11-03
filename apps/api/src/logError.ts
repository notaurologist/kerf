import { DrizzleQueryError } from 'drizzle-orm';

// A failed query's parameters can hold session token hashes, client addresses and project
// content, so they stay out of the log. Drizzle puts them in its error's message and stack, and
// the drivers attach them to the cause (postgres.js as `parameters`, PGlite as `params`), so
// only the query text and the cause's own fields are kept.

interface LoggedCause {
  name?: string;
  code?: string;
  message?: string;
}

function causeFields(cause: unknown): LoggedCause | string {
  if (!(cause instanceof Error)) return String(cause);
  const code = (cause as { code?: unknown }).code;
  return {
    name: cause.name,
    ...(typeof code === 'string' ? { code } : {}),
    message: cause.message,
  };
}

/** What the 500 handler logs for an error it did not expect. */
export function loggable(error: unknown): unknown {
  if (!(error instanceof DrizzleQueryError)) return error;
  const header = `${error.name}: ${error.message}`;
  const frames = error.stack?.startsWith(header) ? error.stack.slice(header.length + 1) : '';
  return {
    name: 'DrizzleQueryError',
    query: error.query,
    cause: causeFields(error.cause),
    stack: frames,
  };
}
