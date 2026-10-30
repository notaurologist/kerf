import type { Inventory } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import {
  addAnother,
  addTool,
  detailsNeeded,
  emptyInventory,
  fromInventory,
  libraryMatch,
  matchingTypes,
  moveToLibrary,
  removeTool,
  toInventory,
} from './draft.ts';

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
      { toolTypeId: 'tape-measure', name: '', values: {} },
      { toolTypeId: 'drill-driver', name: '', values: {} },
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
        { toolTypeId: 'circular-saw', name: '', values: { depthOfCut: 'deep' } },
        { toolTypeId: 'miter-saw', name: '', values: { maxMiter: '95' } },
        { toolTypeId: 'clamps', name: '', values: { count: '2.5' } },
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

  it('removes a tool and leaves the rest in place', () => {
    const draft = fromInventory(inventory);
    expect(removeTool(draft, 'circular-saw').tools.map((t) => t.toolTypeId)).toEqual(['miter-saw']);
  });

  it('finds library tools by any part of the name, ignoring case', () => {
    expect(matchingTypes('SAW').map((t) => t.id)).toEqual([
      'circular-saw',
      'miter-saw',
      'table-saw',
      'track-saw',
      'band-saw',
      'hand-saw',
      'jigsaw',
    ]);
    expect(matchingTypes('  ').length).toBeGreaterThan(20);
    expect(matchingTypes('lathe')).toEqual([]);
  });

  it('matches an other tool to the library by name or old ID, ignoring case and spacing', () => {
    expect(libraryMatch(' table SAW ')?.id).toBe('table-saw');
    expect(libraryMatch('table-saw')?.id).toBe('table-saw');
    expect(libraryMatch('Table saw with sled')).toBeUndefined();
    expect(libraryMatch('')).toBeUndefined();
  });

  it('moves an other tool into the library tools', () => {
    const moved = moveToLibrary(fromInventory(inventory), 0, 'table-saw');
    expect(moved.tools.map((t) => t.toolTypeId)).toEqual([
      'circular-saw',
      'miter-saw',
      'table-saw',
    ]);
    expect(moved.other).toEqual([]);
  });

  it('adds another tool of a type after the others, and sends names trimmed', () => {
    let draft = addTool(emptyInventory(), 'clamps');
    draft = addTool(draft, 'tape-measure');
    draft = addAnother(draft, 'clamps');
    expect(draft.tools.map((t) => t.toolTypeId)).toEqual(['tape-measure', 'clamps', 'clamps']);
    draft = {
      ...draft,
      tools: draft.tools.map((t, i) => ({ ...t, name: ['', ' Short ', 'Long'][i] ?? '' })),
    };
    expect(toInventory(draft)).toEqual({
      ok: true,
      inventory: {
        tools: [
          { toolTypeId: 'tape-measure', capabilities: {} },
          { toolTypeId: 'clamps', name: 'Short', capabilities: {} },
          { toolTypeId: 'clamps', name: 'Long', capabilities: {} },
        ],
        other: [],
      },
    });
  });

  it('counts the details not entered yet', () => {
    const draft = fromInventory(inventory);
    expect(draft.tools.map(detailsNeeded)).toEqual([0, 2]);
    expect(detailsNeeded({ toolTypeId: 'tape-measure', name: '', values: {} })).toBe(0);
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
