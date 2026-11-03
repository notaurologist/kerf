// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, mount, settle } from '../../test/dom.tsx';
import { fromInventory } from './draft.ts';
import { ToolsEditor } from './ToolsScreen.tsx';

// Adding and removing save at once, with Undo (#363).

const sent: unknown[] = [];
afterEach(() => {
  sent.length = 0;
  vi.unstubAllGlobals();
});

function stubSave() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      sent.push(body);
      return new Response(JSON.stringify({ ...body, revision: body.revision + 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

const button = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as
    | HTMLButtonElement
    | undefined;

describe('My toolbox', () => {
  it('adds a tool in one tap and saves it', async () => {
    stubSave();
    const { container } = mount(<ToolsEditor saved={fromInventory({ tools: [] })} revision={1} />);
    await click(button(container, 'Level') as HTMLButtonElement);
    await settle();
    expect(sent).toEqual([{ tools: [{ toolTypeId: 'level', capabilities: {} }], revision: 1 }]);
    expect(container.textContent).toContain('Saved.');
  });

  it('removes a tool in one tap and saves, then puts it back with Undo', async () => {
    stubSave();
    const { container } = mount(
      <ToolsEditor
        revision={1}
        saved={fromInventory({
          tools: [
            { toolTypeId: 'level', capabilities: {} },
            { toolTypeId: 'tape-measure', capabilities: {} },
          ],
        })}
      />,
    );
    await click(container.querySelector('button[aria-label="Remove level"]') as Element);
    await settle();
    expect(sent.at(-1)).toEqual({
      tools: [{ toolTypeId: 'tape-measure', capabilities: {} }],
      revision: 1,
    });
    expect(container.textContent).toContain('Removed Level.');
    await click(button(container, 'Undo') as HTMLButtonElement);
    await settle();
    expect(sent.at(-1)).toEqual({
      tools: [
        { toolTypeId: 'tape-measure', capabilities: {} },
        { toolTypeId: 'level', capabilities: {} },
      ],
      revision: 2,
    });
  });
});

describe('My toolbox saved on another device first (#426)', () => {
  const stale = () =>
    new Response(JSON.stringify({ error: 'stale-tools', revision: 4 }), {
      status: 409,
      headers: { 'content-type': 'application/json' },
    });

  it('keeps the edit, says so, and saves nothing more until the owner chooses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(String(init.body)));
        return stale();
      }),
    );
    const { container } = mount(<ToolsEditor saved={fromInventory({ tools: [] })} revision={1} />);
    await click(button(container, 'Level') as HTMLButtonElement);
    await settle();
    expect(container.textContent).toContain('Changed on another device.');
    expect(container.textContent).not.toContain('Saved.');
    expect(container.textContent).toContain('Level');
    await click(button(container, 'Tape measure') as HTMLButtonElement);
    await settle();
    expect(sent).toHaveLength(1);
  });

  it('saves the edits over the newer list, naming its revision', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        sent.push(body);
        if (calls++ === 0) return stale();
        return new Response(JSON.stringify({ ...body, revision: 5 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    const { container } = mount(<ToolsEditor saved={fromInventory({ tools: [] })} revision={1} />);
    await click(button(container, 'Level') as HTMLButtonElement);
    await settle();
    await click(button(container, 'Save my changes over it') as HTMLButtonElement);
    await settle();
    expect(sent.at(-1)).toEqual({
      tools: [{ toolTypeId: 'level', capabilities: {} }],
      revision: 4,
    });
    expect(container.textContent).toContain('Saved.');
    expect(container.textContent).not.toContain('Changed on another device.');
  });

  it('offers to load the newer list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => stale()),
    );
    const onReload = vi.fn();
    const { container } = mount(
      <ToolsEditor saved={fromInventory({ tools: [] })} revision={1} onReload={onReload} />,
    );
    await click(button(container, 'Level') as HTMLButtonElement);
    await settle();
    await click(button(container, 'Load the newer list') as HTMLButtonElement);
    expect(onReload).toHaveBeenCalledOnce();
  });
});
