import { describe, expect, it } from 'vitest';
import { findToolType } from '../knowledge/tools.ts';
import { buildFromForm, entryProblems, formValues } from '../templates/form.ts';
import { capabilityForm, Inventory, missingCapabilities, readStoredTools, Tool } from './tools.ts';

const messages = (result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  result.error?.issues.map((i) => `${i.path.join('.')}: ${i.message}`) ?? [];

describe('Inventory', () => {
  it('accepts library tools with some, all, or none of their capabilities entered', () => {
    const inventory = {
      tools: [
        { toolTypeId: 'circular-saw', capabilities: { depthOfCut: 2.4375 } },
        { toolTypeId: 'miter-saw', capabilities: { maxMiter: 50 } },
        { toolTypeId: 'clamps', capabilities: {} },
      ],
      other: [{ name: 'Table saw', note: '' }],
    };
    expect(Inventory.parse(inventory)).toEqual(inventory);
  });

  it('accepts only library tool type IDs', () => {
    expect(messages(Tool.safeParse({ toolTypeId: 'lathe', capabilities: {} }))).toEqual([
      'toolTypeId: is not a tool type in the library',
    ]);
  });

  it('accepts only the capabilities the library gives a tool type, in range and of their kind', () => {
    const result = Tool.safeParse({
      toolTypeId: 'circular-saw',
      capabilities: { bevels: true, depthOfCut: 0, maxBevel: 45 },
    });
    expect(messages(result)).toEqual([
      'capabilities.bevels: is not a capability of a circular saw',
      'capabilities.depthOfCut: Depth of cut with the blade square must be from 1/16" to 1\' 0".',
      'capabilities.maxBevel: is not a capability of a circular saw',
    ]);
    expect(
      messages(Tool.safeParse({ toolTypeId: 'miter-saw', capabilities: { maxMiter: true } })),
    ).toEqual(['capabilities.maxMiter: Enter a number.']);
  });

  it('takes several tools of one type when each has its own name', () => {
    const tools = [
      { toolTypeId: 'clamps', name: 'Short', capabilities: { maxOpening: 6 } },
      { toolTypeId: 'clamps', name: 'Long', capabilities: { maxOpening: 24 } },
    ];
    expect(Inventory.parse({ tools, other: [] }).tools).toEqual(tools);
  });

  it('asks for a name on each tool of a repeated type, different from the others', () => {
    const result = Inventory.safeParse({
      tools: [
        { toolTypeId: 'level', capabilities: {} },
        { toolTypeId: 'level', name: 'Short', capabilities: {} },
        { toolTypeId: 'level', name: 'short ', capabilities: {} },
      ],
      other: [{ name: '  ', note: '' }],
    });
    expect(messages(result)).toEqual([
      'tools.0.name: Name each one, so build steps can say which level to use.',
      'tools.1.name: Give each one a different name.',
      'tools.2.name: Give each one a different name.',
      'other.0.name: Enter a name.',
    ]);
  });
});

describe('missingCapabilities', () => {
  it('lists the capabilities not entered, which are input needed', () => {
    const tool = { toolTypeId: 'miter-saw', capabilities: { maxMiter: 50 } };
    expect(missingCapabilities(tool).map((c) => c.id)).toEqual(['crosscutWidth', 'cutDepth']);
    expect(missingCapabilities({ toolTypeId: 'hand-saw', capabilities: {} })).toEqual([]);
  });
});

describe('capabilityForm', () => {
  const saw = findToolType('miter-saw');
  if (!saw) throw new Error('miter-saw is in the library');
  const form = [capabilityForm(saw)];

  it('enters capabilities like template fields, lengths as a plan writes them', () => {
    const values = { crosscutWidth: '7-1/2', cutDepth: '', maxMiter: '50' };
    expect(entryProblems(form, values)).toEqual([]);
    // Left empty: left out, so it stays input needed.
    expect(buildFromForm(form, values)).toEqual({ crosscutWidth: 7.5, maxMiter: 50 });
  });

  it('writes stored values back without changing them', () => {
    expect(formValues(form, { crosscutWidth: 7.5, maxMiter: 50 })).toEqual({
      crosscutWidth: '7-1/2',
      cutDepth: '',
      maxMiter: '50',
    });
  });

  it('says in each hint what the value decides and where to read it', () => {
    expect(form[0]?.fields[0]?.help).toBe(
      "Decides which boards it cuts across in one pass. Read it from: the tool's manual, or its specifications.",
    );
  });
});

describe('readStoredTools', () => {
  it('keeps a library tool and the capabilities that fit it', () => {
    expect(
      readStoredTools([{ toolTypeId: 'circular-saw', capabilities: { depthOfCut: 2.375 } }]),
    ).toEqual({
      tools: [{ toolTypeId: 'circular-saw', capabilities: { depthOfCut: 2.375 } }],
      moved: [],
    });
  });

  it('moves a free-text tool to other tools, with its earlier values in the note', () => {
    expect(readStoredTools([{ toolTypeId: 'lathe', capabilities: { tilts: true } }])).toEqual({
      tools: [],
      moved: [
        {
          name: 'lathe',
          note: 'Moved here from your tool list. Not a tool type in the library. Earlier values: tilts: true.',
        },
      ],
    });
  });

  it('moves capabilities a library tool cannot use, keeping the tool', () => {
    const read = readStoredTools([
      {
        toolTypeId: 'circular-saw',
        capabilities: { bevels: true, depthOfCut: 'deep' },
      },
      { toolTypeId: 'miter-saw', capabilities: { maxMiter: 50 } },
    ]);
    expect(read).toEqual({
      tools: [
        { toolTypeId: 'circular-saw', capabilities: {} },
        { toolTypeId: 'miter-saw', capabilities: { maxMiter: 50 } },
      ],
      moved: [
        {
          name: 'circular-saw',
          note: 'Moved here from your tool list. Details the circular saw entry cannot use. Earlier values: bevels: true; depthOfCut: "deep".',
        },
      ],
    });
    // What it reads is a valid inventory.
    expect(Inventory.safeParse({ tools: read.tools, other: read.moved }).success).toBe(true);
  });
});
