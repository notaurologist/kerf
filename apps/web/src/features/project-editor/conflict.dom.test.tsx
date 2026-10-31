// @vitest-environment happy-dom
import { createSnapshot, findTemplate, type TemplateDefinition } from '@kerf/core';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { byText, click, mount, settle } from '../../test/dom.tsx';
import { projectFrom } from '../../test/projects.ts';
import { EditProjectScreen } from './ProjectEditor.tsx';

// Two devices editing one project (#207): a save refused because another device saved first
// keeps what was typed, and offers both ways on.

const template = findTemplate('swing-set-a-frame') as TemplateDefinition;
const example = template.examples[0];
const made = createSnapshot(template, example?.params, example?.structuralInputs);
if (!made.ok) throw new Error('worked example should generate');
const snapshot = JSON.parse(JSON.stringify(made.output));
const opened = projectFrom(snapshot, { revision: 1, name: 'Backyard swing set' });
const newer = projectFrom(snapshot, { revision: 2, name: 'Renamed on the laptop' });

/** A server holding the project, which another device saves once the form is open. */
function server() {
  const saves: Record<string, unknown>[] = [];
  let current = opened;
  const json = (body: unknown, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const method = (input instanceof Request ? input.method : init?.method) ?? 'GET';
    if (url.endsWith('/preview')) return json({ error: 'internal' }, 500);
    if (method === 'GET') return json(current);
    return (async () => {
      const raw = input instanceof Request ? await input.text() : String(init?.body ?? '');
      const body = JSON.parse(raw) as Record<string, unknown>;
      saves.push(body);
      if (body.revision !== current.revision) {
        return json({ error: 'stale-project', revision: current.revision }, 409);
      }
      current = { ...current, ...body, revision: current.revision + 1 } as typeof current;
      return json(current);
    })();
  });
  return {
    saves,
    savedElsewhere: () => {
      current = newer;
    },
  };
}

async function typeName(value: string) {
  const input = document.getElementById('project-name') as HTMLInputElement;
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function loaded() {
  for (let i = 0; i < 5; i++) await settle();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saving a project another device saved first', () => {
  it('keeps what was typed and says so', async () => {
    const s = server();
    window.history.replaceState(null, '', `#/projects/${opened.id}/edit`);
    const { container } = mount(<EditProjectScreen id={opened.id} />);
    await loaded();
    await typeName('Swing set');
    s.savedElsewhere();
    await click(container.querySelector('button[type="submit"]') as Element);
    await loaded();
    expect(s.saves[0]).toMatchObject({ name: 'Swing set', revision: 1 });
    expect(container.textContent).toContain('Changed on another device.');
    expect((document.getElementById('project-name') as HTMLInputElement).value).toBe('Swing set');
  });

  it('saves the changes over the newer version when asked', async () => {
    const s = server();
    window.history.replaceState(null, '', `#/projects/${opened.id}/edit`);
    const { container } = mount(<EditProjectScreen id={opened.id} />);
    await loaded();
    await typeName('Swing set');
    s.savedElsewhere();
    await click(container.querySelector('button[type="submit"]') as Element);
    await loaded();
    await click(byText(container, 'button', 'Save my changes over it'));
    await loaded();
    expect(s.saves[1]).toMatchObject({ name: 'Swing set', revision: 2 });
    expect(window.location.hash).toBe(`#/projects/${opened.id}`);
  });

  it('loads the newer version, starting the form again from it, when asked', async () => {
    const s = server();
    window.history.replaceState(null, '', `#/projects/${opened.id}/edit`);
    const { container } = mount(<EditProjectScreen id={opened.id} />);
    await loaded();
    await typeName('Swing set');
    s.savedElsewhere();
    await click(container.querySelector('button[type="submit"]') as Element);
    await loaded();
    await click(byText(container, 'button', 'Load the newer version'));
    await loaded();
    expect((document.getElementById('project-name') as HTMLInputElement).value).toBe(
      'Renamed on the laptop',
    );
    expect(container.textContent).not.toContain('Changed on another device.');
    expect(s.saves).toHaveLength(1);
  });
});
