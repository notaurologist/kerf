import { describe, expect, it, vi } from 'vitest';
import {
  createClient,
  describeError,
  fieldIssues,
  send,
  setLoginRequiredHandler,
  withJsonBodies,
} from './api.ts';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

/** A client whose requests all get `response`; records what was sent. */
function clientAnswering(response: () => Response) {
  const sent: Request[] = [];
  const client = createClient(async (input, init) => {
    sent.push(new Request(new URL(String(input), 'http://kerf.test'), init));
    return response();
  });
  return { client, sent };
}

describe('withJsonBodies', () => {
  it('sends a JSON content type and an empty object on state-changing requests with no body', async () => {
    const { client, sent } = clientAnswering(() => new Response(null, { status: 204 }));
    await client.api.logout.$post();
    expect(sent[0]?.headers.get('content-type')).toBe('application/json');
    expect(await sent[0]?.text()).toBe('{}');
  });

  it('leaves GET requests alone', async () => {
    const base = vi.fn(async () => new Response('{}'));
    await withJsonBodies(base)('/api/tools');
    expect(base).toHaveBeenCalledWith('/api/tools', undefined);
  });
});

describe('send', () => {
  it('returns the body of a successful response', async () => {
    const { client } = clientAnswering(() => json(200, { tools: [] }));
    expect(await send(client.api.tools.$get())).toEqual({ ok: true, value: { tools: [] } });
  });

  it('reads a 204 as no body', async () => {
    const { client } = clientAnswering(() => new Response(null, { status: 204 }));
    expect(await send(client.api.logout.$post())).toEqual({ ok: true, value: null });
  });

  it('reports a successful status whose body is not JSON as a failure', async () => {
    for (const body of ['<!doctype html><title>Kerf</title>', '']) {
      const { client } = clientAnswering(
        () => new Response(body, { status: 200, headers: { 'content-type': 'text/html' } }),
      );
      const result = await send(client.api.tools.$get());
      expect(result).toEqual({
        ok: false,
        error: {
          kind: 'failed',
          status: 200,
          message: 'Kerf could not read the answer from the server.',
        },
      });
      if (!result.ok) {
        expect(describeError(result.error)).toBe('Kerf could not read the answer from the server.');
      }
    }
  });

  it('reports a missing session and tells the app', async () => {
    const handler = vi.fn();
    setLoginRequiredHandler(handler);
    const { client } = clientAnswering(() => json(401, { error: 'login-required' }));
    expect(await send(client.api.tools.$get())).toEqual({
      ok: false,
      error: { kind: 'login-required' },
    });
    expect(handler).toHaveBeenCalledOnce();
    setLoginRequiredHandler(() => {});
  });

  it('tells a wrong password apart from a missing session', async () => {
    const handler = vi.fn();
    setLoginRequiredHandler(handler);
    const { client } = clientAnswering(() => json(401, { error: 'wrong-password' }));
    const result = await send(client.api.login.$post({ json: { password: 'x' } }));
    expect(result).toEqual({ ok: false, error: { kind: 'wrong-password' } });
    expect(handler).not.toHaveBeenCalled();
    setLoginRequiredHandler(() => {});
  });

  it('reads Retry-After when login is rate limited', async () => {
    const { client } = clientAnswering(() =>
      json(429, { error: 'too-many-attempts' }, { 'retry-after': '900' }),
    );
    expect(await send(client.api.login.$post({ json: { password: 'x' } }))).toEqual({
      ok: false,
      error: { kind: 'rate-limited', retryAfterSeconds: 900 },
    });
  });

  it("carries core's issues from a 422, by parameter", async () => {
    const { client } = clientAnswering(() =>
      json(422, {
        error: 'invalid-project',
        issues: [{ code: 'too-small', message: 'Too short', params: ['beamLength'] }],
      }),
    );
    const result = await send(
      client.api.projects.$post({
        json: { name: 'x', templateId: 't', params: {}, structuralInputs: {} },
      }),
    );
    expect(result).toEqual({
      ok: false,
      error: { kind: 'invalid', issues: [{ field: 'beamLength', message: 'Too short' }] },
    });
  });

  it('reports a network failure without throwing', async () => {
    const client = createClient(async () => {
      throw new TypeError('offline');
    });
    const result = await send(client.api.tools.$get());
    expect(result.ok).toBe(false);
  });
});

describe('fieldIssues', () => {
  it('joins request validation paths, and gives each parameter a core issue names its message', () => {
    expect(
      fieldIssues({
        issues: [
          { path: ['tools', '0', 'toolTypeId'], message: 'bad' },
          { code: 'c', message: 'both', params: ['a', 'b'] },
          { code: 'c', message: 'whole', params: [] },
        ],
      }),
    ).toEqual([
      { field: 'tools.0.toolTypeId', message: 'bad' },
      { field: 'a', message: 'both' },
      { field: 'b', message: 'both' },
      { field: '', message: 'whole' },
    ]);
  });
});

describe('describeError', () => {
  it('says how many minutes to wait, singular for one', () => {
    const wait = (retryAfterSeconds: number) =>
      describeError({ kind: 'rate-limited', retryAfterSeconds });
    expect(wait(30)).toBe('Too many attempts. Try again in 1 minute.');
    expect(wait(60)).toBe('Too many attempts. Try again in 1 minute.');
    expect(wait(61)).toBe('Too many attempts. Try again in 2 minutes.');
    expect(wait(900)).toBe('Too many attempts. Try again in 15 minutes.');
  });

  it('gives the messages of invalid fields without their dotted paths, each once', () => {
    expect(
      describeError({
        kind: 'invalid',
        issues: [
          { field: 'tools.0.toolTypeId', message: 'Choose a tool type.' },
          { field: 'tools.1.toolTypeId', message: 'Choose a tool type.' },
          { field: '', message: 'The list is too long.' },
        ],
      }),
    ).toBe('Choose a tool type. The list is too long.');
    expect(describeError({ kind: 'invalid', issues: [] })).toBe(
      'Kerf could not use what was sent.',
    );
  });

  it("gives a status, not the server's error code, for other failures", () => {
    expect(describeError({ kind: 'failed', status: 500, message: 'internal' })).toBe(
      'The server answered 500.',
    );
  });
});
