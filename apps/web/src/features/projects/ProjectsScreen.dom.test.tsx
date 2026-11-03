// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setFlash } from '../../lib/flash.ts';
import { byText, click, mount, settle } from '../../test/dom.tsx';
import { ProjectsScreen } from './ProjectsScreen.tsx';

// Undo after a delete: the Projects line that says a project moved to the trash takes it
// back out, and then links to it.

const id = '6f1c2a3e-0000-4000-8000-000000000001';

function server(restore: { status: number; body?: unknown }) {
  const requests: string[] = [];
  const json = (body: unknown, status = 200) =>
    Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input instanceof Request ? input.url : input), 'http://localhost')
      .pathname;
    const method = (input instanceof Request ? input.method : init?.method) ?? 'GET';
    requests.push(`${method} ${path}`);
    if (path === '/api/projects') return json({ projects: [] });
    if (path === '/api/templates') return json({ templates: [] });
    if (method === 'POST' && path === `/api/trash/${id}/restore`) {
      return json(restore.body, restore.status);
    }
    return json({ error: 'not-found' }, 404);
  });
  return requests;
}

async function open() {
  setFlash('Moved “Shed” to Deleted projects in Workshop. You can restore it there for 30 days.', {
    id,
    name: 'Shed',
  });
  const { container } = mount(<ProjectsScreen />);
  for (let i = 0; i < 5; i++) await settle();
  return container;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Undo after a delete', () => {
  it('restores the project, links to it, and lists the projects again', async () => {
    const requests = server({ status: 204 });
    const container = await open();
    expect(container.textContent).toContain('Moved “Shed” to Deleted projects in Workshop.');
    await click(byText(container, 'button', 'Undo'));
    for (let i = 0; i < 5; i++) await settle();
    expect(requests).toContain(`POST /api/trash/${id}/restore`);
    expect(requests.filter((r) => r === 'GET /api/projects')).toHaveLength(2);
    expect(container.textContent).toContain('Restored “Shed”.');
    expect(byText<HTMLAnchorElement>(container, 'a', 'Shed').getAttribute('href')).toBe(
      `#/projects/${id}`,
    );
    expect(container.textContent).not.toContain('Undo');
  });

  it('says what went wrong and keeps Undo when the restore is refused', async () => {
    server({ status: 404, body: { error: 'not-found' } });
    const container = await open();
    await click(byText(container, 'button', 'Undo'));
    for (let i = 0; i < 5; i++) await settle();
    expect(container.textContent).toContain('Not found.');
    expect(byText(container, 'button', 'Undo')).toBeTruthy();
  });

  it('offers no Undo with a message that is not about a delete', async () => {
    server({ status: 204 });
    setFlash('Saved.');
    const { container } = mount(<ProjectsScreen />);
    for (let i = 0; i < 5; i++) await settle();
    expect(container.textContent).toContain('Saved.');
    expect(container.querySelector('button')?.textContent).not.toBe('Undo');
  });
});
