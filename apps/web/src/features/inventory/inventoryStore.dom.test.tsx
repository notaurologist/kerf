// @vitest-environment happy-dom
import type { Inventory } from '@kerf/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, mount, settle } from '../../test/dom.tsx';
import { fromInventory } from './draft.ts';
import { ToolsEditor, ToolsScreen } from './ToolsScreen.tsx';

const inventory: Inventory = {
  tools: [{ toolTypeId: 'tape-measure', capabilities: {} }],
  other: [],
};

/** A server answering every request with `answer`, a delay away. */
function server(answer: () => Promise<Response>) {
  vi.stubGlobal('fetch', answer);
}

const json = (body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }),
  );

const ticked = (container: HTMLElement, label: string) =>
  [...container.querySelectorAll('label.k-tick')]
    .find((l) => l.textContent?.trim() === label)
    ?.querySelector('input') ?? undefined;

async function loaded() {
  for (let i = 0; i < 5; i++) await settle();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the tool inventory', () => {
  it('shows the last one loaded at once when Tools opens again', async () => {
    server(() => json(inventory));
    const first = mount(<ToolsScreen />);
    await loaded();
    expect(ticked(first.container, 'Tape measure')?.checked).toBe(true);

    server(() => new Promise(() => {}));
    const again = mount(<ToolsScreen />);
    expect(again.container.querySelector('.k-skeleton')).toBeNull();
    expect(ticked(again.container, 'Tape measure')?.checked).toBe(true);
  });

  it('keeps what was ticked when a refresh brings back the same inventory', async () => {
    const { container, rerender } = mount(<ToolsEditor saved={fromInventory(inventory)} />);
    await click(ticked(container, 'Chalk line') as Element);
    rerender(<ToolsEditor saved={fromInventory(structuredClone(inventory))} />);
    expect(ticked(container, 'Chalk line')?.checked).toBe(true);

    rerender(<ToolsEditor saved={fromInventory({ tools: [], other: [] })} />);
    expect(ticked(container, 'Chalk line')?.checked).toBe(false);
    expect(ticked(container, 'Tape measure')?.checked).toBe(false);
  });
});
