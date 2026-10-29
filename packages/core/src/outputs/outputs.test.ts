import { describe, expect, it } from 'vitest';
import { stock } from '../lumber/stock.ts';
import type { HardwareItem, Part } from '../templates/types.ts';
import { cutList } from './cutList.ts';
import { hardwareList } from './hardwareList.ts';
import { planLumber } from './shoppingList.ts';

// Generic outputs, tested on made-up parts. Each template tests its own output through these
// in its own folder.

describe('cutList', () => {
  const part: Part = {
    id: 'rail',
    letter: 'A',
    name: 'Rail',
    role: 'crossbar',
    stock: stock('2x4'),
    quantity: 3,
    length: 30.03,
    markLengths: [{ label: 'Short edge', value: 27.4 }],
    ends: [
      { setting: 0, description: 'Square' },
      { setting: 15, description: 'Miter' },
    ],
    endsParallel: false,
    notes: ['A note'],
  };

  it('formats stock, length, ends, and marks', () => {
    expect(cutList([part])).toEqual([
      {
        partId: 'rail',
        letter: 'A',
        name: 'Rail',
        quantity: 3,
        stock: '2x4 (1-1/2" x 3-1/2")',
        length: '30"',
        ends: ['Square', 'Miter; saw at 15.0°, 75.0° to the edge'],
        endsParallel: false,
        marks: [{ label: 'Short edge', value: '27-3/8"' }],
        notes: ['A note'],
      },
    ]);
  });
});

describe('planLumber, edge cases', () => {
  const piece = (length: number, quantity = 1): Part => ({
    id: 'test',
    letter: 'A',
    name: 'Test piece',
    role: 'leg',
    stock: stock('2x4'),
    quantity,
    length,
    markLengths: [],
    ends: [
      { setting: 0, description: 'Square' },
      { setting: 0, description: 'Square' },
    ],
    endsParallel: true,
    notes: [],
  });

  it('reports a part longer than any board instead of dropping it', () => {
    const plan = planLumber([piece(200)]);
    expect(plan.boards).toEqual([]);
    expect(plan.issues.map((i) => i.code)).toEqual(['part-longer-than-any-board']);
  });

  it('charges kerf and trim, so a piece exactly a board long needs the next size', () => {
    expect(planLumber([piece(96)]).lines).toEqual([{ nominal: '2x4', feet: 10, count: 1 }]);
    expect(planLumber([piece(94.875)]).lines).toEqual([{ nominal: '2x4', feet: 8, count: 1 }]);
  });

  it('uses the given kerf, trim, and lengths', () => {
    const plan = planLumber([piece(30, 3)], { kerf: 0, trimPerEnd: 0, buyableFeet: [6, 8] });
    expect(plan.lines).toEqual([{ nominal: '2x4', feet: 8, count: 1 }]);
    expect(plan.boards[0]?.offcut).toBe(6);
  });
});

describe('hardwareList', () => {
  const bolt = (
    id: string,
    quantity: number,
    diameter: number,
    grip: number,
    fittings: Partial<NonNullable<HardwareItem['bolt']>> = {},
  ): HardwareItem => ({
    id,
    name: id,
    quantity,
    bolt: { diameter, grip, washers: 2, nut: 'standard', cap: false, ...fittings },
    structural: true,
    notes: [],
  });

  it('groups bolts by diameter and displayed grip', () => {
    const lines = hardwareList([
      bolt('a', 2, 0.5, 5),
      bolt('b', 3, 0.5, 5.01), // displays as 5", so it shares a line
      bolt('c', 1, 0.5, 6),
    ]);
    expect(lines.slice(0, 2)).toEqual([
      { description: '1/2" through-bolt, grip 5"', quantity: 5 },
      { description: '1/2" through-bolt, grip 6"', quantity: 1 },
    ]);
  });

  it('totals only the fittings each bolt calls for', () => {
    const lines = hardwareList([
      bolt('a', 2, 0.5, 5, { washers: 1, nut: 'locking', cap: true }),
      bolt('b', 3, 0.5, 6),
      bolt('c', 1, 0.375, 4, { washers: 0 }),
    ]);
    expect(lines.slice(3)).toEqual([
      { description: '3/8" nuts', quantity: 1 },
      { description: '1/2" flat washers', quantity: 8 },
      { description: '1/2" locking nuts', quantity: 2 },
      { description: '1/2" nuts', quantity: 3 },
      { description: '1/2" bolt caps', quantity: 2 },
    ]);
  });

  it('lists other items by name after the bolts and fittings', () => {
    const lines = hardwareList([
      { id: 'x', name: 'Hinge', quantity: 2, structural: false, notes: [] },
      bolt('a', 1, 0.5, 5),
    ]);
    expect(lines.at(-1)).toEqual({ description: 'Hinge', quantity: 2 });
  });
});
