import type { Inventory } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { emptyTool, fromInventory, toInventory } from './draft.ts';

describe('inventory drafts', () => {
  const inventory: Inventory = {
    tools: [
      { toolTypeId: 'circular-saw', capabilities: { bevels: true, maxBevel: 56, blade: '7-1/4' } },
      { toolTypeId: 'drill-driver', capabilities: {} },
    ],
  };

  it('round-trips an inventory, keeping each capability its kind', () => {
    const drafts = fromInventory(inventory);
    expect(drafts[0]?.capabilities.map((c) => c.kind)).toEqual(['yes-no', 'number', 'text']);
    expect(toInventory(drafts)).toEqual({ ok: true, inventory });
  });

  it('trims IDs and names before checking them', () => {
    const result = toInventory([
      { toolTypeId: ' speed-square ', capabilities: [{ name: ' x ', kind: 'text', value: 'a' }] },
    ]);
    expect(result).toEqual({
      ok: true,
      inventory: { tools: [{ toolTypeId: 'speed-square', capabilities: { x: 'a' } }] },
    });
  });

  it("uses core's rule for tool type IDs", () => {
    const result = toInventory([{ toolTypeId: 'Miter Saw', capabilities: [] }]);
    expect(result).toEqual({
      ok: false,
      issues: [{ field: 'tools.0.toolTypeId', message: 'must be a lowercase ID like miter-saw' }],
    });
  });

  it('points a duplicate at the second tool, and a blank ID at its own', () => {
    const result = toInventory([
      { toolTypeId: 'drill-driver', capabilities: [] },
      { toolTypeId: 'drill-driver', capabilities: [] },
      emptyTool(),
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((i) => i.field)).toEqual(['tools.1.toolTypeId', 'tools.2.toolTypeId']);
  });

  it('rejects unnamed, repeated, and non-numeric capabilities', () => {
    const result = toInventory([
      {
        toolTypeId: 'table-saw',
        capabilities: [
          { name: '', kind: 'yes-no', value: 'true' },
          { name: 'tilt', kind: 'number', value: 'lots' },
          { name: 'tilt', kind: 'number', value: '' },
        ],
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual([
      { field: 'tools.0.capabilities.0.name', message: 'needs a name' },
      { field: 'tools.0.capabilities.1.value', message: 'must be a number' },
      { field: 'tools.0.capabilities.2.name', message: 'is listed twice' },
      { field: 'tools.0.capabilities.2.value', message: 'must be a number' },
    ]);
  });
});
