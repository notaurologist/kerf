import { describe, expect, it } from 'vitest';
import { findToolType, TOOL_GROUPS, TOOL_TYPES, ToolType } from './tools.ts';

describe('tool-type library', () => {
  it('parses every entry with its schema', () => {
    for (const entry of TOOL_TYPES) expect(ToolType.safeParse(entry).error).toBeUndefined();
  });

  it('has unique IDs and unique names', () => {
    expect(new Set(TOOL_TYPES.map((t) => t.id)).size).toBe(TOOL_TYPES.length);
    expect(new Set(TOOL_TYPES.map((t) => t.name)).size).toBe(TOOL_TYPES.length);
  });

  it('has a tool in every group, listed in group order', () => {
    const groups = TOOL_TYPES.map((t) => t.group);
    expect([...new Set(groups)]).toEqual([...TOOL_GROUPS]);
  });

  it('gives every capability a range', () => {
    for (const type of TOOL_TYPES) {
      for (const c of type.capabilities as readonly {
        kind: string;
        min?: number;
        max?: number;
      }[]) {
        if (c.kind !== 'yes-no') expect([type.id, c.min, c.max]).not.toContain(undefined);
      }
    }
  });

  // The work in docs/templates/swing-set-a-frame.md, Tools for the work. A tool removed from the
  // library or renamed fails here, so the spec's table and the library stay in step.
  it('covers the tools the swing-set spec lists for its work', () => {
    const fromSpec = [
      'tape-measure',
      'combination-square',
      'rafter-square',
      'sliding-bevel',
      'chalk-line',
      'level',
      'string-line',
      'circular-saw',
      'miter-saw',
      'hand-saw',
      'jigsaw',
      'drill-driver',
      'impact-driver',
      'spade-bits',
      'auger-bits',
      'socket-wrench',
      'clamps',
      'chisel',
      'block-plane',
      'sander',
      'post-hole-digger',
      'tamper',
    ];
    expect(TOOL_TYPES.map((t) => t.id).sort()).toEqual(fromSpec.sort());
  });

  it('names no brands (hard rule 11)', () => {
    // Trademarks that are often used as generic tool names.
    const brands = /speed square|skil|sawzall|shop-?vac|dremel|kreg/i;
    for (const type of TOOL_TYPES) {
      expect(JSON.stringify(type)).not.toMatch(brands);
    }
  });

  it('finds an entry by ID, and nothing for an unknown ID', () => {
    expect(findToolType('circular-saw')?.name).toBe('Circular saw');
    expect(findToolType('table-saw')).toBeUndefined();
  });
});
