import type { Inventory } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { addTool, emptyInventory, fromInventory, toInventory } from './draft.ts';

describe('inventory drafts', () => {
  const inventory: Inventory = {
    tools: [
      { toolTypeId: 'circular-saw', capabilities: { depthOfCut: 2.4375 } },
      { toolTypeId: 'miter-saw', capabilities: { maxMiter: 50 } },
    ],
    other: [{ name: 'Table saw', note: 'Tilts to 45' }],
  };

  it('round-trips an inventory, writing lengths as a plan does', () => {
    const draft = fromInventory(inventory);
    expect(draft.tools[0]?.values).toEqual({ depthOfCut: '2-7/16' });
    expect(draft.tools[1]?.values).toEqual({ crosscutWidth: '', cutDepth: '', maxMiter: '50' });
    expect(toInventory(draft)).toEqual({ ok: true, inventory });
  });

  it('adds a tool once, in library order, with nothing entered', () => {
    let draft = addTool(emptyInventory(), 'drill-driver');
    draft = addTool(draft, 'tape-measure');
    draft = addTool(draft, 'drill-driver');
    expect(draft.tools).toEqual([
      { toolTypeId: 'tape-measure', values: {} },
      { toolTypeId: 'drill-driver', values: {} },
    ]);
    // Nothing entered is left out: input needed, not a stand-in value.
    expect(toInventory(draft)).toEqual({
      ok: true,
      inventory: {
        tools: [
          { toolTypeId: 'tape-measure', capabilities: {} },
          { toolTypeId: 'drill-driver', capabilities: {} },
        ],
        other: [],
      },
    });
  });

  it('says what to type for text it cannot read, and reports ranges from core', () => {
    const result = toInventory({
      tools: [
        { toolTypeId: 'circular-saw', values: { depthOfCut: 'deep' } },
        { toolTypeId: 'miter-saw', values: { maxMiter: '95' } },
        { toolTypeId: 'clamps', values: { count: '2.5' } },
      ],
      other: [],
    });
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          field: 'tools.0.capabilities.depthOfCut',
          message: expect.stringContaining('Kerf cannot read this as a length'),
        },
        {
          field: 'tools.1.capabilities.maxMiter',
          message: 'Largest miter must be from 0.0° to 90.0°.',
        },
        { field: 'tools.2.capabilities.count', message: 'Enter a whole number.' },
      ],
    });
  });

  it('trims other tools and asks for a name', () => {
    expect(
      toInventory({
        tools: [],
        other: [
          { name: ' Router ', note: ' ' },
          { name: ' ', note: 'x' },
        ],
      }),
    ).toEqual({ ok: false, issues: [{ field: 'other.1.name', message: 'Enter a name.' }] });
  });
});
