import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { stock } from '../lumber/stock.ts';
import { LumberPlan } from '../outputs/shoppingList.ts';
import { ChecklistItem, EndCut, Flag, HardwareItem, Part } from './types.ts';

// What a template generates must carry every field generic code reads, so a template that leaves
// one out fails to type-check and to parse instead of drawing or listing nothing. Made-up values.

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
  ['Part', Part, part, ['selection', 'referenceEdge', 'holes', 'boltAreas', 'tapers']],
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
