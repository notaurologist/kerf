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
      return new Response(JSON.stringify(body), {
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
    const { container } = mount(<ToolsEditor saved={fromInventory({ tools: [] })} />);
    await click(button(container, 'Level') as HTMLButtonElement);
    await settle();
    expect(sent).toEqual([{ tools: [{ toolTypeId: 'level', capabilities: {} }] }]);
    expect(container.textContent).toContain('Saved.');
  });

  it('removes a tool in one tap and saves, then puts it back with Undo', async () => {
    stubSave();
    const { container } = mount(
      <ToolsEditor
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
    expect(sent.at(-1)).toEqual({ tools: [{ toolTypeId: 'tape-measure', capabilities: {} }] });
    expect(container.textContent).toContain('Removed Level.');
    await click(button(container, 'Undo') as HTMLButtonElement);
    await settle();
    expect(sent.at(-1)).toEqual({
      tools: [
        { toolTypeId: 'tape-measure', capabilities: {} },
        { toolTypeId: 'level', capabilities: {} },
      ],
    });
  });
});
