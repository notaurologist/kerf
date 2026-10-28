import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fromInventory } from './draft.ts';
import { ToolsEditor } from './ToolsScreen.tsx';

describe('ToolsEditor', () => {
  it('says when there are no tools', () => {
    expect(renderToString(<ToolsEditor saved={[]} />)).toContain('No tools yet.');
  });

  it('shows each tool and its capabilities', () => {
    const html = renderToString(
      <ToolsEditor
        saved={fromInventory({
          tools: [{ toolTypeId: 'circular-saw', capabilities: { maxBevel: 56 } }],
        })}
      />,
    );
    expect(html).toContain('value="circular-saw"');
    expect(html).toContain('value="maxBevel"');
    expect(html).toContain('value="56"');
  });
});
