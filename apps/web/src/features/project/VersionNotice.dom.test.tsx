// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../lib/types.ts';
import { byText, click, mount, settle } from '../../test/dom.tsx';
import { projectFrom, storedSnapshots } from '../../test/projects.ts';
import { VersionNotice } from './VersionNotice.tsx';

// Regenerating from the version notice (#425): it names the revision the notice was computed at,
// so a save from another device since then is refused rather than regenerated unseen.

const [snapshot] = storedSnapshots;
if (!snapshot) throw new Error('fixture has a worked example');
const version: Project['version'] = {
  status: 'behind',
  storedVersion: 1,
  currentVersion: 2,
  regenerated: { ok: true, outputs: snapshot.outputs, changes: [], truncated: false },
};
const opened = projectFrom(snapshot, { revision: 1, version, templateBehind: true });
const newer = projectFrom(snapshot, { revision: 2, version, templateBehind: true });

/** A server where another device has saved the project, now at revision 2. */
function server() {
  const sent: { method: string; body: unknown }[] = [];
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (input instanceof Request ? input.method : init?.method) ?? 'GET';
    if (method === 'GET') {
      sent.push({ method, body: null });
      return json(newer);
    }
    const raw = input instanceof Request ? await input.text() : String(init?.body ?? '');
    const body = JSON.parse(raw) as { revision: number };
    sent.push({ method, body });
    if (body.revision !== newer.revision) {
      return json({ error: 'stale-project', revision: newer.revision }, 409);
    }
    return json({ ...newer, revision: newer.revision + 1 });
  });
  return sent;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('regenerating from the version notice', () => {
  it('sends the revision the notice was computed at, and offers the newer version when refused', async () => {
    const sent = server();
    const regenerated = vi.fn();
    const shown: Project[] = [];
    const notice = (project: Project) => (
      <VersionNotice
        project={project}
        onRegenerated={regenerated}
        onNewer={(p) => {
          shown.push(p);
          view.rerender(notice(p));
        }}
      />
    );
    const view = mount(notice(opened));
    const { container } = view;

    await click(byText(container, 'button', 'Regenerate with version 2'));
    await click(byText(container, 'button', 'Regenerate'));
    await settle();
    expect(sent).toEqual([{ method: 'POST', body: { revision: 1 } }]);
    expect(regenerated).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Changed on another device.');
    expect(container.textContent).toContain('Nothing was regenerated.');
    expect(container.textContent).not.toContain('Regenerate with version 2');

    await click(byText(container, 'button', 'Load the newer version'));
    await settle();
    expect(shown.map((p) => p.revision)).toEqual([2]);
    expect(container.textContent).not.toContain('Changed on another device.');

    await click(byText(container, 'button', 'Regenerate with version 2'));
    await click(byText(container, 'button', 'Regenerate'));
    await settle();
    expect(sent.at(-1)).toEqual({ method: 'POST', body: { revision: 2 } });
    expect(regenerated).toHaveBeenCalledWith(expect.objectContaining({ revision: 3 }));
  });
});
