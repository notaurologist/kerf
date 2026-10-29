import { swingSetAFrame, type TemplateDefinition } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { createTestApp, TEST_PASSWORD } from '../../../api/test/app.ts';
import { VersionNotice } from '../features/project/VersionNotice.tsx';
import { renderText } from '../test/render.tsx';
import { createClient, send } from './api.ts';

// The web client against the real API app on PGlite: the request shapes the screens send, the
// session cookie, and the JSON content type the API requires on every state-changing request.

type TestApp = Awaited<ReturnType<typeof createTestApp>>;

/** A fetch that serves requests from the app and keeps its cookie, as a browser would. */
function browser(app: TestApp['app']) {
  let cookie = '';
  return createClient(async (input, init) => {
    const headers = new Headers(init?.headers);
    if (cookie) headers.set('cookie', cookie);
    const res = await app.request(new URL(String(input), 'http://localhost').pathname, {
      ...init,
      headers,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0]?.endsWith('=') ? '' : (set.split(';')[0] ?? '');
    return res;
  });
}

const base = swingSetAFrame.definition as TemplateDefinition;
const example = base.examples[0];
if (!example) throw new Error('needs a worked example');

/** A made-up next version that changes the first cut-list length, standing in for a real change. */
const nextVersion: TemplateDefinition = {
  ...base,
  version: base.version + 1,
  generate(params, inputs) {
    const result = base.generate(params, inputs);
    if (!result.ok) return result;
    const outputs = result.output as { cutList: { length: string }[] };
    const [first, ...rest] = outputs.cutList;
    return {
      ok: true,
      output: { ...outputs, cutList: first ? [{ ...first, length: '121"' }, ...rest] : rest },
    };
  },
};

describe('the web client against the API', () => {
  it('logs in, creates the worked example, and regenerates it only when asked after a template change', async () => {
    const before = await createTestApp();
    const v1 = browser(before.app);
    expect((await send(v1.api.tools.$get())).ok).toBe(false);
    expect((await send(v1.api.login.$post({ json: { password: TEST_PASSWORD } }))).ok).toBe(true);

    const created = await send(
      v1.api.projects.$post({
        json: {
          name: 'Backyard swing set',
          templateId: base.id,
          params: example.params,
          structuralInputs: example.structuralInputs,
        },
      }),
    );
    if (!created.ok) throw new Error(JSON.stringify(created.error));
    const id = created.value.id;

    // The same database, served by code whose template is now at the next version.
    const after = await createTestApp({ database: before, templates: [nextVersion] });
    const v2 = browser(after.app);
    await send(v2.api.login.$post({ json: { password: TEST_PASSWORD } }));
    const read = await send(v2.api.projects[':id'].$get({ param: { id } }));
    if (!read.ok) throw new Error(JSON.stringify(read.error));
    expect(read.value.version?.status).toBe('behind');
    const notice = renderText(<VersionNotice project={read.value} onRegenerated={() => {}} />);
    expect(notice).toContain('cutList[0].length 120" 121"');

    // Regenerate sends no body; the client still sends JSON, so the API accepts it.
    const regenerated = await send(v2.api.projects[':id'].regenerate.$post({ param: { id } }));
    if (!regenerated.ok) throw new Error(JSON.stringify(regenerated.error));
    expect(regenerated.value.version).toEqual({ status: 'current', version: base.version + 1 });

    // Logout ends the session for later requests.
    expect((await send(v2.api.logout.$post())).ok).toBe(true);
    const afterLogout = await send(v2.api.projects.$get());
    expect(afterLogout).toEqual({ ok: false, error: { kind: 'login-required' } });
  }, 30_000);
});
