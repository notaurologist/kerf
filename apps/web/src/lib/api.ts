import type { AppType } from '@kerf/api';
import { type ClientResponse, hc } from 'hono/client';
import type { SuccessStatusCode } from 'hono/utils/http-status';
import type { Failure } from '../ui/index.ts';

// The only way the web app reaches the API: Hono's typed client over /api on the same origin
// (ARCHITECTURE.md, apps/web). Request and response types come from the API's routes.

/**
 * State-changing requests must send JSON (decision 0007), including the ones with no body, such
 * as logout and regenerate. The client sets the header only when it sends a JSON body itself.
 */
export function withJsonBodies(base: typeof fetch): typeof fetch {
  return (input, init) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD') return base(input, init);
    const headers = new Headers(init?.headers);
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    return base(input, { ...init, headers, body: init?.body ?? '{}' });
  };
}

export function createClient(fetcher: typeof fetch = (input, init) => fetch(input, init)) {
  return hc<AppType>('/', { fetch: withJsonBodies(fetcher) });
}

export type Client = ReturnType<typeof createClient>;

/** A problem with what was sent, pointed at the field it names (dotted path, '' for the whole). */
export interface FieldIssue {
  field: string;
  message: string;
}

export type ApiError =
  | { kind: 'login-required' }
  | { kind: 'wrong-password' }
  | { kind: 'rate-limited'; retryAfterSeconds: number | null }
  | {
      kind: 'invalid';
      issues: FieldIssue[];
      /** Ticks on items the stored plan does not have (`unknown-progress`, #57). */
      items?: { kind: string; key: string }[];
    }
  | { kind: 'not-found' }
  | { kind: 'failed'; status: number; message: string };

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ApiError };

/** The body of a response's successful statuses. */
type SuccessBody<R> =
  R extends ClientResponse<infer T, infer S, infer _Format>
    ? S extends SuccessStatusCode
      ? T
      : never
    : never;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Issues from a 400 (`path`, from request validation) or a 422 (`params`, from core), in one
 * shape. A core issue names top-level parameters only, so each named parameter gets the message.
 */
export function fieldIssues(body: unknown): FieldIssue[] {
  if (!isRecord(body) || !Array.isArray(body.issues)) return [];
  return body.issues.flatMap((issue: unknown): FieldIssue[] => {
    if (!isRecord(issue) || typeof issue.message !== 'string') return [];
    const message = issue.message;
    if (Array.isArray(issue.path)) return [{ field: issue.path.map(String).join('.'), message }];
    if (Array.isArray(issue.params) && issue.params.length > 0) {
      return issue.params.map((p) => ({ field: String(p), message }));
    }
    return [{ field: '', message }];
  });
}

function isTickRef(value: unknown): value is { kind: string; key: string } {
  return isRecord(value) && typeof value.kind === 'string' && typeof value.key === 'string';
}

async function readJson(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** Turns an error response into something the UI can show. */
export async function toError(res: Response): Promise<ApiError> {
  const body = await readJson(res);
  const code = isRecord(body) && typeof body.error === 'string' ? body.error : '';
  switch (res.status) {
    case 401:
      return code === 'wrong-password' ? { kind: 'wrong-password' } : { kind: 'login-required' };
    case 429: {
      const seconds = Number(res.headers.get('retry-after'));
      return {
        kind: 'rate-limited',
        retryAfterSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
      };
    }
    case 400:
    case 422:
      return isRecord(body) && Array.isArray(body.items)
        ? { kind: 'invalid', issues: fieldIssues(body), items: body.items.filter(isTickRef) }
        : { kind: 'invalid', issues: fieldIssues(body) };
    case 404:
      return { kind: 'not-found' };
    default:
      return {
        kind: 'failed',
        status: res.status,
        message: code || res.statusText || 'The request failed.',
      };
  }
}

let onLoginRequired: () => void = () => {};

/** Called whenever a request answers 401 without a session, so the app can show the login. */
export function setLoginRequiredHandler(handler: () => void) {
  onLoginRequired = handler;
}

/**
 * Sends a request made with the typed client and reads its body. Network failures and error
 * statuses become an `ApiError`; a missing session also tells the app to show the login screen.
 */
export async function send<R extends ClientResponse<unknown>>(
  request: Promise<R>,
): Promise<ApiResult<SuccessBody<R>>> {
  let res: R;
  try {
    res = await request;
  } catch {
    return {
      ok: false,
      error: {
        kind: 'failed',
        status: 0,
        message: 'Kerf could not reach the server. Check your connection, then try again.',
      },
    };
  }
  const response = res as unknown as Response;
  if (response.ok) return { ok: true, value: (await readJson(response)) as SuccessBody<R> };
  const error = await toError(response);
  if (error.kind === 'login-required') onLoginRequired();
  return { ok: false, error };
}

/** An error as a failed request the UI shows: its words, and whether the server was reached. */
export function failureOf(error: ApiError): Failure {
  return {
    message: describeError(error),
    connection: error.kind === 'failed' && error.status === 0,
  };
}

/** Where a save stands, for a screen that stays open after saving. */
export type SaveState =
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'saved' }
  | { state: 'failed'; failure: Failure };

/** Plain words for an error, for places that show one line. */
export function describeError(error: ApiError): string {
  switch (error.kind) {
    case 'login-required':
      return 'Your session ended. Log in again.';
    case 'wrong-password':
      return 'That password is not right.';
    case 'rate-limited':
      return error.retryAfterSeconds
        ? `Too many attempts. Try again in ${Math.ceil(error.retryAfterSeconds / 60)} minutes.`
        : 'Too many attempts. Try again later.';
    case 'invalid':
      return error.issues.map((i) => (i.field ? `${i.field}: ${i.message}` : i.message)).join(' ');
    case 'not-found':
      return 'Not found.';
    case 'failed':
      return error.status === 0 ? error.message : `The server answered ${error.status}.`;
  }
}

export const api = createClient();
