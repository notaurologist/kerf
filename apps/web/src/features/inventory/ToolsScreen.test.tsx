import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { emptyInventory, fromInventory } from './draft.ts';
import { ToolsEditor } from './ToolsScreen.tsx';

describe('ToolsEditor', () => {
  it('says when there are no tools, and offers the whole library by group', () => {
    const html = renderToString(<ToolsEditor saved={emptyInventory()} />);
    expect(html).toContain('No tools yet.');
    expect(html).toContain('Measuring and marking');
    expect(html).toContain('Digging and setting');
    expect(html).toContain('Add circular saw');
    expect(html).toContain('Add post-hole digger');
  });

  it('shows each tool with its capabilities, marking those not entered as input needed', () => {
    const html = renderToString(
      <ToolsEditor
        saved={fromInventory({
          tools: [{ toolTypeId: 'circular-saw', capabilities: { depthOfCut: 2.4375 } }],
          other: [{ name: 'Table saw', note: '' }],
        })}
      />,
    );
    expect(html).toContain('Circular saw');
    expect(html).toContain('value="2-7/16"');
    expect(html).toContain('Largest bevel');
    expect((html.match(/Input needed/g) ?? []).length).toBe(1);
    // An owned tool is not offered again.
    expect(html).not.toContain('Add circular saw');
    expect(html).toContain('value="Table saw"');
    expect(html).toContain('build steps do not use them');
  });
});
