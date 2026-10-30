import { TOOL_TYPES } from '@kerf/core';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { emptyInventory, fromInventory } from './draft.ts';
import { ToolsEditor } from './ToolsScreen.tsx';

describe('ToolsEditor', () => {
  it('lists the whole library by group as a checklist, none ticked, with a search box', () => {
    const html = renderToString(<ToolsEditor saved={emptyInventory()} />);
    expect(html).toContain('<legend>Measuring and marking</legend>');
    expect(html).toContain('<legend>Digging and setting</legend>');
    expect(html.match(/type="checkbox"/g)).toHaveLength(TOOL_TYPES.length);
    expect(html).not.toMatch(/type="checkbox"[^>]*checked/);
    expect(html).toMatch(/<label[^>]*for="tool-search"[^>]*>.*Find a tool/s);
    expect(html).toContain('type="search"');
    expect(html).not.toContain('Tool details');
  });

  it('shows each of several tools of a type by name, with a way to add or remove one', () => {
    const html = renderToString(
      <ToolsEditor
        saved={fromInventory({
          tools: [
            { toolTypeId: 'clamps', name: 'Short', capabilities: { count: 4, maxOpening: 6 } },
            { toolTypeId: 'clamps', name: 'Long', capabilities: { count: 2 } },
          ],
          other: [],
        })}
      />,
    );
    expect(html).toContain('Clamps: Short');
    expect(html).toContain('Clamps: Long');
    expect(html.match(/type="checkbox"[^>]*checked/g)).toHaveLength(1);
    expect(html).toContain('Remove Short');
    expect(html).toContain('Add another set of clamps');
  });

  it('ticks owned tools, and says how many details each still needs', () => {
    const html = renderToString(
      <ToolsEditor
        saved={fromInventory({
          tools: [{ toolTypeId: 'miter-saw', capabilities: { crosscutWidth: 7.5, cutDepth: 3.5 } }],
          other: [{ name: 'Table saw', note: '' }],
        })}
      />,
    );
    expect(html.match(/type="checkbox"[^>]*checked/g)).toHaveLength(1);
    expect(html).toContain('Tool details');
    expect(html).toContain('1 detail needed');
    // The details sit closed under their summary, still in the page for print and find.
    expect(html).toMatch(/<details class="k-disclosure">/);
    expect(html).toContain('value="7-1/2"');
    expect(html).toContain('Largest miter');
    expect(html).toContain('value="Table saw"');
    expect(html).toMatch(/Table saw(<!-- -->)? is in the library now\./);
    expect(html).toContain('Move table saw to your tools');
    expect(html).toContain('build steps do not use them');
  });
});
