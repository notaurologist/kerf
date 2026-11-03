import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { stock } from '../lumber/stock.ts';
import { LumberPlan } from '../outputs/shoppingList.ts';
import { ChecklistItem, EndCut, Flag, HardwareItem, Part } from './types.ts';

// What a template generates must carry every field generic code reads, so a template that leaves
// one out fails to type-check and to parse instead of drawing or listing nothing. A part's lists
// are the exception: each defaults to empty, so a stored snapshot can leave an empty one out.
// Made-up values.

const end = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' };
const part = {
  id: 'rail',
  letter: 'A',
  name: 'Rail',
  role: 'rail',
  stock: stock('2x4'),
  quantity: 1,
  length: 30,
  markLengths: [],
  ends: [end, end],
  endsParallel: true,
  notes: [],
  selection: [],
  referenceEdge: 'bottom edge',
  holes: [],
  boltAreas: [],
  tapers: [],
  dadoes: [],
  notches: [],
  cutouts: [],
};
const concerns = { partIds: [], hardwareIds: [] };
const flag = { category: 'load-bearing', ask: 'Ask.', why: 'Why.', ...concerns };
const item = {
  category: 'racking',
  element: 'Rail',
  confirm: 'Confirm.',
  why: 'Why.',
  ...concerns,
};
const hardware = { id: 'screws', name: 'Screws', quantity: 4, structural: false, notes: [] };
const lumber = {
  boards: [],
  kerf: 0.125,
  trimPerEnd: 0.5,
  lines: [],
  notes: [],
  issues: [],
  selection: [],
};

const cases: [string, z.ZodType, Record<string, unknown>, string[]][] = [
  ['Part', Part, part, ['referenceEdge']],
  ['EndCut', EndCut, end, ['measuredFrom']],
  ['Flag', Flag, flag, ['partIds', 'hardwareIds']],
  ['ChecklistItem', ChecklistItem, item, ['partIds', 'hardwareIds']],
  ['HardwareItem', HardwareItem, { ...hardware, group: 'Fasteners' }, ['group']],
  ['LumberPlan', LumberPlan, lumber, ['selection']],
];

describe('generated output', () => {
  it.each(cases)('%s parses with every field', (_, schema, value) => {
    expect(schema.safeParse(value).success).toBe(true);
  });

  it.each(
    cases.flatMap(([name, schema, value, keys]) => keys.map((k) => [name, k, schema, value])),
  )('%s requires %s', (_, key, schema, value) => {
    const { [key as string]: _left, ...without } = value as Record<string, unknown>;
    expect((schema as z.ZodType).safeParse(without).success).toBe(false);
  });
});

/** A field's schema under any optional, nullable, or default wrapper. */
function unwrapped(schema: z.ZodType): z.ZodType {
  return schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault
    ? unwrapped(schema.def.innerType as z.ZodType)
    : schema;
}

describe("a part's lists", () => {
  const lists = Object.entries(Part.shape).filter(([, f]) => unwrapped(f) instanceof z.ZodArray);

  it('are each required, with an empty default', () => {
    // A list added later then needs no change to what any template already stores (#430).
    expect(lists.length).toBeGreaterThan(0);
    const otherwise = lists
      .filter(
        ([, f]) => !(f instanceof z.ZodDefault && JSON.stringify(f.def.defaultValue) === '[]'),
      )
      .map(([key]) => key);
    expect(otherwise).toEqual([]);
  });

  it.each(lists.map(([key]) => key))('reads %s as empty when left out', (key) => {
    const { [key]: _left, ...without } = part as Record<string, unknown>;
    expect(Part.parse(without)[key as keyof Part]).toEqual([]);
  });
});
