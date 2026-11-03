// @vitest-environment happy-dom
import { flagProgressKey } from '@kerf/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPlan } from '../../lib/plan.ts';
import { click, mount, settle } from '../../test/dom.tsx';
import { loadedDrawings, projectFrom, storedSnapshots } from '../../test/projects.ts';
import { ProjectView } from '../project/ProjectScreen.tsx';

// Ticking the To do band's expert checks and checklist items (#393): each tick is saved with the
// project's other ticks, and the band's and the header's counts follow.

const [complete] = storedSnapshots;
if (!complete) throw new Error('fixture has a worked example');
const project = projectFrom(complete, { id: '6f1c2a3e-0000-4000-8000-000000003931' });
const plan = readPlan(project);
if (!plan.ok) throw new Error(plan.message);
const { flags, checklist } = plan.plan;
const [flag] = flags;
if (!flag) throw new Error('the worked example has expert checks');

/** A server that saves ticks and answers with them, as PATCH /progress does. */
function server() {
  const sent: unknown[] = [];
  let ticks: { kind: string; key: string; doneAt: string }[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = input instanceof Request ? await input.text() : String(init?.body ?? '');
    const body = JSON.parse(raw) as {
      changes: { kind: string; key: string; done: boolean }[];
    };
    sent.push(body);
    for (const c of body.changes) {
      ticks = ticks.filter((t) => t.kind !== c.kind || t.key !== c.key);
      if (c.done) ticks.push({ kind: c.kind, key: c.key, doneAt: '2026-11-02T12:00:00.000Z' });
    }
    return new Response(JSON.stringify({ ticks, status: 'planned' }), {
      headers: { 'content-type': 'application/json' },
    });
  });
  return sent;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ticking the structural review', () => {
  it('saves an expert check as asked, counts it off, and clears it again', async () => {
    const sent = server();
    const { container } = mount(
      <ProjectView
        project={project}
        drawings={loadedDrawings(project)}
        section="structural-review"
      />,
    );
    const heading = () =>
      [...container.querySelectorAll('h3')].find((h) => h.textContent?.startsWith('To do'));
    const all = flags.length + checklist.length;
    expect(heading()?.textContent).toBe(`To do · ${all}`);
    expect(container.textContent).toContain(`${flags.length} expert checks`);

    const box = () =>
      [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((i) =>
        i.closest('label')?.textContent?.includes(`Asked: ${flag.ask}`),
      ) as HTMLInputElement;
    await click(box());
    await settle();
    expect(sent).toEqual([
      {
        revision: project.revision,
        changes: [{ kind: 'flag', key: flagProgressKey(flag), done: true }],
      },
    ]);
    expect(box().checked).toBe(true);
    expect(heading()?.textContent).toBe(`To do · ${all - 1}`);
    expect(container.textContent).toContain(
      `${flags.length - 1} ${flags.length - 1 === 1 ? 'expert check' : 'expert checks'}`,
    );

    await click(box());
    await settle();
    expect(sent.at(-1)).toEqual({
      revision: project.revision,
      changes: [{ kind: 'flag', key: flagProgressKey(flag), done: false }],
    });
    expect(box().checked).toBe(false);
    expect(heading()?.textContent).toBe(`To do · ${all}`);
  });
});
