// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';
import { createClient, send } from './lib/api.ts';
import { href } from './lib/route.ts';
import { byText, click, goTo, mount, settle } from './test/dom.tsx';
import { projectFrom, storedSnapshots } from './test/projects.ts';

// A session that ends while a screen is loading: Log in again brings the screen's data with
// nothing more to do. A fake server stands in for the API: happy-dom, like a browser, keeps the
// Cookie and Set-Cookie headers from scripts, so the real API's session cannot pass through a
// stubbed fetch (api.integration.test.tsx runs the real API in Node).

const project = projectFrom(storedSnapshots[0] ?? null, { name: 'Backyard swing set' });

/**
 * A server whose session ends just after the app checks it, and comes back on login. With
 * `endLater`, it ends only when `end` is called.
 */
function server(options: { endLater?: boolean } = {}) {
  let session = true;
  const gets: string[] = [];
  const json = (body: unknown, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input instanceof Request ? input.url : input), 'http://localhost')
      .pathname;
    const method = (input instanceof Request ? input.method : init?.method) ?? 'GET';
    if (method === 'POST' && path === '/api/login') {
      session = true;
      return json({ expiresAt: '2026-11-03T12:00:00.000Z' });
    }
    if (path === '/api/session') {
      const ok = session;
      if (!options.endLater) session = false;
      return ok ? json({ expiresAt: '2026-11-02T12:00:00.000Z' }) : json({}, 401);
    }
    if (!session) return json({ error: 'login-required' }, 401);
    gets.push(path);
    if (path === '/api/projects') return json({ projects: [] });
    if (path === '/api/templates') return json({ templates: [] });
    if (path === `/api/projects/${project.id}`) return json(project);
    return json({ error: 'not-found' }, 404);
  });
  return {
    gets,
    end: () => {
      session = false;
    },
  };
}

async function waitForRequests() {
  for (let i = 0; i < 5; i++) await settle();
}

async function typeInto(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** The Log in again dialog, if it is open. */
const loginDialog = () =>
  [...document.querySelectorAll('dialog')].find(
    (d) => d.open && d.textContent?.includes('Your session has ended.'),
  );

async function logInAgain() {
  const dialog = loginDialog();
  if (!dialog) throw new Error('Log in again is not open.');
  const input = dialog.querySelector('input[type="password"]') as HTMLInputElement;
  await typeInto(input, 'pw');
  await click(byText(dialog, 'button', 'Log in'));
  await waitForRequests();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a session that ends while a screen loads', () => {
  it('shows Projects after logging in again', async () => {
    server();
    await goTo(href({ screen: 'projects' }));
    const { container } = mount(<App />);
    await waitForRequests();
    // Log in again says the session ended; the screen behind it does not say so a second time.
    expect(container.textContent).toContain('Kerf could not do this while you were logged out.');
    expect(document.body.textContent?.match(/session (has )?ended/gi)).toHaveLength(1);
    await logInAgain();
    expect(loginDialog()).toBeUndefined();
    expect(container.textContent).toContain('No projects yet.');
  });

  it('shows the edit form after logging in again', async () => {
    server();
    await goTo(href({ screen: 'edit-project', id: project.id }));
    const { container } = mount(<App />);
    await waitForRequests();
    expect(container.querySelector('#project-name')).toBeNull();
    await logInAgain();
    const name = container.querySelector('#project-name') as HTMLInputElement;
    expect(name.value).toBe('Backyard swing set');
  });

  it('shows how to start a new project after logging in again', async () => {
    server();
    await goTo(href({ screen: 'new-project', templateId: project.templateId }));
    const { container } = mount(<App />);
    await waitForRequests();
    expect(container.textContent).not.toContain('How do you want to start?');
    await logInAgain();
    expect(container.textContent).toContain('How do you want to start?');
  });

  it('keeps a form that had loaded as it was, without loading it again', async () => {
    const api = server({ endLater: true });
    await goTo(href({ screen: 'edit-project', id: project.id }));
    const { container } = mount(<App />);
    await waitForRequests();
    const name = container.querySelector('#project-name') as HTMLInputElement;
    await typeInto(name, 'Swing set for the oak');
    api.end();
    // Any request finding the session ended opens Log in again.
    await act(async () => {
      await send(createClient().api.session.$get());
    });
    await logInAgain();
    expect(api.gets.filter((p) => p === `/api/projects/${project.id}`)).toHaveLength(1);
    expect((container.querySelector('#project-name') as HTMLInputElement).value).toBe(
      'Swing set for the oak',
    );
  });
});
