// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';
import { href } from './lib/route.ts';
import { goTo, mount, settle } from './test/dom.tsx';

// Moving from one project's address to another's starts the screen over, so no render shows the
// first project under the second's address. Each stand-in screen records the id it was first
// rendered for beside the id it is rendering.

const P1 = '00000000-0000-4000-8000-000000000001';
const P2 = '00000000-0000-4000-8000-000000000002';
const renders = vi.hoisted(() => [] as [first: string, now: string][]);

vi.mock('./features/project/ProjectScreen.tsx', () => ({
  ProjectScreen: (props: { id: string }) => {
    const [first] = useState(props.id);
    renders.push([first, props.id]);
    return <h1>Project {props.id}</h1>;
  },
}));

vi.mock('./features/inventory/ToolPage.tsx', () => ({
  ToolPage: (props: { id: string }) => {
    const [first] = useState(props.id);
    renders.push([first, props.id]);
    return <h1>Tool {props.id}</h1>;
  },
}));

beforeEach(() => {
  renders.length = 0;
  vi.stubGlobal('fetch', () =>
    Promise.resolve(
      new Response(JSON.stringify({ expiresAt: '2026-11-06T12:00:00.000Z' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('App', () => {
  it("starts a project's screen over when the address moves to another project", async () => {
    await goTo(href({ screen: 'project', id: P1 }));
    const { container } = mount(<App />);
    await settle();
    expect(container.querySelector('h1')?.textContent).toBe(`Project ${P1}`);
    await goTo(href({ screen: 'project', id: P2 }));
    expect(container.querySelector('h1')?.textContent).toBe(`Project ${P2}`);
    expect(renders.filter(([first, now]) => first !== now)).toEqual([]);
  });

  it('keeps the screen across sections of one project', async () => {
    await goTo(href({ screen: 'project', id: P1 }));
    const { container } = mount(<App />);
    await settle();
    const heading = container.querySelector('h1');
    await goTo(href({ screen: 'project', id: P1, section: 'cut-list' }));
    expect(container.querySelector('h1')).toBe(heading);
  });

  it("starts a tool's page over when the address moves to another tool", async () => {
    await goTo(href({ screen: 'tools', tool: 'miter-saw' }));
    mount(<App />);
    await settle();
    await goTo(href({ screen: 'tools', tool: 'table-saw' }));
    expect(renders.map(([, now]) => now)).toContain('table-saw');
    expect(renders.filter(([first, now]) => first !== now)).toEqual([]);
  });
});
