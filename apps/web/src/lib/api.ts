import type { AppType } from '@kerf/api';
import { type ClientResponse, hc } from 'hono/client';
import type { SuccessStatusCode } from 'hono/utils/http-status';
import type { Failure } from '../ui/index.ts';
import { buildCheck } from './build.ts';

// The only way the web app reaches the API: Hono's typed client over /api on the same origin
// (ARCHITECTURE.md, apps/web). Request and response types come from the API's routes.

/**
 * State-changing requests must send JSON (decision 0007), including the ones with no body, such
 * as logout and delete. The client sets the header only when it sends a JSON body itself.
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
  /** The project or tool list changed on another device since it was read; `revision` is the current one. */
  | { kind: 'stale'; revision: number }
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

/** The parsed body, or `undefined` when there is none or it is not JSON. */
async function readJson(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

/** Turns an error response into something the UI can show. */
async function toError(res: Response): Promise<ApiError> {
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
    case 409:
      if (
        (code === 'stale-project' || code === 'stale-tools' || code === 'stale-settings') &&
        isRecord(body) &&
        typeof body.revision === 'number'
      ) {
        return { kind: 'stale', revision: body.revision };
      }
      return { kind: 'failed', status: 409, message: code || 'The request failed.' };
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

/** When Kerf could not reach the server at all (docs/design/content.md). */
const CONNECTION_MESSAGE =
  'Kerf could not reach the server. Check your connection, then try again.';

/** When a request has gone on so long that the screen offers to start it again (ui/Skeleton.tsx). */
export const SLOW_MESSAGE =
  'Kerf is still waiting for the server. Check your connection, then try again.';

/** When a successful status came with a body that could not be read. */
const UNREADABLE_MESSAGE = 'Kerf could not read the answer from the server.';

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
        message: CONNECTION_MESSAGE,
      },
    };
  }
  const response = res as unknown as Response;
  buildCheck.note(response.headers);
  if (response.status === 204) return { ok: true, value: null as SuccessBody<R> };
  if (response.ok) {
    const body = await readJson(response);
    if (body === undefined) {
      return {
        ok: false,
        error: { kind: 'failed', status: response.status, message: UNREADABLE_MESSAGE },
      };
    }
    return { ok: true, value: body as SuccessBody<R> };
  }
  const error = await toError(response);
  if (error.kind === 'login-required') onLoginRequired();
  return { ok: false, error };
}

/** A successful status whose body could not be read, such as a stream cut off partway. */
export function unreadable(error: ApiError): boolean {
  return error.kind === 'failed' && error.status >= 200 && error.status < 300;
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
      return 'Kerf could not do this while you were logged out.';
    case 'wrong-password':
      return 'That password is not right.';
    case 'rate-limited':
      return error.retryAfterSeconds
        ? `Too many attempts. Try again in ${minutes(error.retryAfterSeconds)}.`
        : 'Too many attempts. Try again later.';
    // A field's path is for the form that shows the message beside it, not for this one line.
    case 'invalid': {
      const messages = [...new Set(error.issues.map((i) => i.message))];
      return messages.length > 0 ? messages.join(' ') : 'Kerf could not use what was sent.';
    }
    case 'not-found':
      return 'Not found.';
    case 'stale':
      return 'This was changed on another device.';
    case 'failed':
      if (error.status === 0 || unreadable(error)) return error.message;
      return `The server answered ${error.status}.`;
  }
}

function minutes(seconds: number): string {
  const n = Math.ceil(seconds / 60);
  return n === 1 ? '1 minute' : `${n} minutes`;
}

export const api = createClient();
