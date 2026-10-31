import { describe, expect, it } from 'vitest';
import { stock } from '../lumber/stock.ts';
import { cutAndDrillOperations, Operation } from './operations.ts';
import type { HardwareItem, Part } from './types.ts';

// Generic: a made-up post and rail, so nothing here depends on one template's numbers.
const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };
const post: Part = {
  id: 'post',
  letter: 'A',
  name: 'Post',
  role: 'post',
  stock: stock('4x4'),
  quantity: 3,
  length: 48,
  markLengths: [],
  ends: [square, { setting: 15, description: 'Angled', measuredFrom: 'reference-edge' }],
  endsParallel: false,
  notes: [],
  selection: [],
  referenceEdge: 'bottom edge',
  holes: [],
  boltAreas: [],
  tapers: [
    { description: 'Taper', start: { u: 4, v: 0 }, end: { u: 0, v: 3 }, angleToEdge: 36.87 },
  ],
};
const rail: Part = {
  ...post,
  id: 'rail',
  letter: 'B',
  quantity: 1,
  stock: stock('2x6'),
  ends: [square, square],
  tapers: [],
  boltAreas: [
    {
      hardwareId: 'bolts',
      count: 2,
      diameter: 0.375,
      withPart: 'post',
      outline: [
        { u: 0, v: 0 },
        { u: 1, v: 0 },
        { u: 1, v: 1 },
      ],
    },
  ],
};
const bolts: HardwareItem = {
  id: 'bolts',
  name: 'Bolts',
  quantity: 6,
  bolt: { diameter: 0.375, grip: 5, washers: 2, nut: 'locking', cap: false },
  structural: true,
  notes: [],
  group: 'Bolts',
};
const screws: HardwareItem = {
  id: 'screws',
  name: 'Screws',
  quantity: 20,
  structural: false,
  notes: [],
  group: 'Screws',
};

describe('cutAndDrillOperations', () => {
  const ops = cutAndDrillOperations([post, rail], [bolts, screws]);

  it('makes a crosscut of a square end, a miter of an angled one, and a taper of each taper', () => {
    expect(ops.slice(0, 3)).toEqual([
      {
        id: 'post/end-0',
        type: 'crosscut',
        partId: 'post',
        count: 3,
        end: 0,
        width: 3.5,
        thickness: 3.5,
      },
      {
        id: 'post/end-1',
        type: 'miter',
        partId: 'post',
        count: 3,
        end: 1,
        setting: 15,
        width: 3.5,
        thickness: 3.5,
      },
      {
        id: 'post/taper-0',
        type: 'taper',
        partId: 'post',
        count: 3,
        taper: 0,
        angleToEdge: 36.87,
        length: 5,
        thickness: 3.5,
      },
    ]);
  });

  it('drills each through-bolt item through every part with its holes or bolt areas, to its grip', () => {
    expect(ops.at(-1)).toEqual({
      id: 'bolts/holes',
      type: 'bolt-holes',
      hardwareId: 'bolts',
      partIds: ['rail'],
      count: 6,
      boltDiameter: 0.375,
      // 3/8" + 1/16" (NDS 2024 12.1.3.2) = 7/16".
      holeDiameter: 0.4375,
      depth: 5,
    });
    expect(ops.some((o) => o.type === 'bolt-holes' && o.hardwareId === 'screws')).toBe(false);
  });

  it('gives every operation a unique ID, and each parses', () => {
    expect(new Set(ops.map((o) => o.id)).size).toBe(ops.length);
    for (const op of ops) expect(Operation.safeParse(op).error).toBeUndefined();
  });

  it('refuses a bevel rather than calling it a miter', () => {
    const beveled = {
      ...post,
      ends: [square, { ...square, setting: 10, measuredFrom: 'reference-face' }],
    } as Part;
    expect(() => cutAndDrillOperations([beveled], [])).toThrow(/post\/end-1 is a bevel/);
  });
});
