import { describe, expect, it } from 'vitest';
import { METHODS } from './methods.ts';
import { findToolType, RETIRED_CAPABILITIES, TOOL_GROUPS, TOOL_TYPES, ToolType } from './tools.ts';

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

  // A capability is asked of the owner only if a method reads it (#171). Each exception says why
  // it is kept; an exception a method has started to use fails too, so the list stays current.
  const UNUSED_KEPT: Record<string, string> = {
    'clamps.count': 'Kept until #170 settles whether clamp counts add across clamp entries.',
  };

  it('lists only capabilities some method needs, and retires none it still lists', () => {
    const used = new Set(
      METHODS.flatMap((m) =>
        m.tools.flatMap((r) =>
          r.anyOf.flatMap((c: { tool: string; needs?: readonly { capability: string }[] }) =>
            (c.needs ?? []).map((n) => `${c.tool}.${n.capability}`),
          ),
        ),
      ),
    );
    const listed = TOOL_TYPES.flatMap((t) =>
      (t.capabilities as readonly { id: string }[]).map((c) => `${t.id}.${c.id}`),
    );
    expect(listed.filter((c) => !used.has(c))).toEqual(Object.keys(UNUSED_KEPT));
    for (const [type, ids] of Object.entries(RETIRED_CAPABILITIES)) {
      for (const id of ids ?? []) expect(listed).not.toContain(`${type}.${id}`);
    }
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
      'line-level',
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
      'shovel',
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
