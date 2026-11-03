import { TOOL_TYPES } from '@kerf/core';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { emptyInventory, fromInventory } from './draft.ts';
import { ToolsEditor } from './ToolsScreen.tsx';

// My toolbox (#363, T1): only the tools owned, with the library one search away.

describe('ToolsEditor', () => {
  it('starts empty, with the whole library behind Add a tool, one button per tool', () => {
    const html = renderToString(<ToolsEditor saved={emptyInventory()} revision={1} />);
    expect(html).toContain('<h1 tabindex="-1">My toolbox</h1>');
    expect(html).toContain('No tools yet.');
    // Open while there are no tools to show.
    expect(html).toMatch(/<details class="k-disclosure" open=""><summary><span>Add a tool<\/span>/);
    expect(html).toMatch(/<label[^>]*for="tool-search"[^>]*>.*Find a tool/s);
    expect(html.match(/data-variant="secondary"/g)).toHaveLength(TOOL_TYPES.length);
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain('Other tools');
  });

  it('lists only the tools owned, by group, each with Remove and its details inline', () => {
    const html = renderToString(
      <ToolsEditor
        revision={1}
        saved={fromInventory({
          tools: [{ toolTypeId: 'miter-saw', capabilities: { crosscutWidth: 7.5, cutDepth: 3.5 } }],
        })}
      />,
    );
    expect(html).toContain('<h2>Cutting</h2>');
    expect(html).not.toContain('<h2>Measuring and marking</h2>');
    expect(html).toContain('aria-label="Remove miter saw"');
    expect(html).toContain('1 detail needed');
    expect(html).toContain('value="7-1/2"');
    expect(html).toContain('Largest miter');
    expect(html).toContain('<a href="#/tools/miter-saw">About this tool</a>');
    // A tool owned is not offered again.
    expect(html.match(/data-variant="secondary"/g)).toHaveLength(TOOL_TYPES.length - 1);
    expect(html).not.toContain('Save tools');
    // Your tools first, then the library, closed.
    expect(html.indexOf('Miter saw')).toBeLessThan(html.indexOf('Add a tool'));
    expect(html).toMatch(/<details class="k-disclosure"><summary><span>Add a tool<\/span>/);
  });

  it('names each of several tools of a type, with a way to add another', () => {
    const html = renderToString(
      <ToolsEditor
        revision={1}
        saved={fromInventory({
          tools: [
            { toolTypeId: 'clamps', name: 'Short', capabilities: { maxOpening: 6 } },
            { toolTypeId: 'clamps', name: 'Long', capabilities: {} },
          ],
        })}
      />,
    );
    expect(html).toContain('Clamps: Short');
    expect(html).toContain('Clamps: Long');
    expect(html).toContain('aria-label="Remove Short"');
    expect(html).toContain('Add another set of clamps');
  });
});
