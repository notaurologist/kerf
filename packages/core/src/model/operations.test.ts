import { describe, expect, it } from 'vitest';
import { panelStock } from '../lumber/panel.ts';
import { stock } from '../lumber/stock.ts';
import { boardCuts, cutAndDrillOperations, Operation } from './operations.ts';
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
  dadoes: [],
  notches: [],
  cutouts: [],
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

describe('panel operations', () => {
  const cherry = { nominal: '1x6 cherry', thickness: 0.75, width: 5.5, buyableFeet: [4, 6, 8] };
  const allowances = { jointPerEdge: 1 / 16, rip: 0.5, trimPerEnd: 1 };
  const panel = (id: string, width: number): Part => {
    const made = panelStock({ thickness: 0.75, width, length: 19.4375, board: cherry, allowances });
    if (!made.ok) throw new Error(made.issue.message);
    return { ...post, id, quantity: 2, stock: made.stock, ends: [square, square], tapers: [] };
  };

  it("cuts a panel's boards, joints and glues them, flattens and rips the panel, then cuts its ends", () => {
    // lumber/panel.test.ts works the stock: 3 boards of 5-1/2", each 21-7/16" long, glued to
    // 16-1/4". Two panels: 6 boards with 2 ends each, and 2 · 2 · (3 − 1) = 8 glued edges.
    const side = { partId: 'side' };
    expect(cutAndDrillOperations([panel('side', 15)], [])).toEqual([
      {
        id: 'side/board-end-0',
        type: 'crosscut',
        ...side,
        count: 6,
        end: 0,
        width: 5.5,
        thickness: 0.75,
        panelBoards: true,
      },
      {
        id: 'side/board-end-1',
        type: 'crosscut',
        ...side,
        count: 6,
        end: 1,
        width: 5.5,
        thickness: 0.75,
        panelBoards: true,
      },
      {
        id: 'side/joint-edges',
        type: 'joint-edges',
        ...side,
        count: 8,
        length: 21.4375,
        thickness: 0.75,
      },
      {
        id: 'side/glue-up',
        type: 'glue-up',
        ...side,
        count: 2,
        boards: 3,
        width: 16.25,
        length: 21.4375,
      },
      { id: 'side/flatten', type: 'flatten', ...side, count: 2, width: 16.25, length: 21.4375 },
      {
        id: 'side/rip',
        type: 'rip',
        ...side,
        count: 2,
        width: 15,
        length: 21.4375,
        thickness: 0.75,
      },
      { id: 'side/end-0', type: 'crosscut', ...side, count: 2, end: 0, width: 15, thickness: 0.75 },
      { id: 'side/end-1', type: 'crosscut', ...side, count: 2, end: 1, width: 15, thickness: 0.75 },
    ]);
  });

  it('only cuts to length and rips a panel of one board', () => {
    expect(cutAndDrillOperations([panel('rail', 3)], []).map((o) => o.id)).toEqual([
      'rail/board-end-0',
      'rail/board-end-1',
      'rail/rip',
      'rail/end-0',
      'rail/end-1',
    ]);
  });

  it("leaves a panel's own end cuts out of the board cuts, and keeps every end cut of other parts", () => {
    const ops = cutAndDrillOperations([post, panel('side', 15)], []);
    for (const op of ops) expect(Operation.safeParse(op).error).toBeUndefined();
    expect(boardCuts(ops).map((o) => o.id)).toEqual([
      'post/end-0',
      'post/end-1',
      'post/taper-0',
      'side/board-end-0',
      'side/board-end-1',
    ]);
  });
});

describe('dadoes, notches, and cutouts', () => {
  // A made-up 2x6 rail, 20" long and 5-1/2" wide: square ends at u = 0 and u = 20.
  const housing: Part = { ...rail, id: 'side', ends: [square, square], length: 20, boltAreas: [] };
  const dado = (u0: number, u1: number, v0: number, v1: number) => ({
    withPart: 'shelf',
    face: 'near' as const,
    u0,
    u1,
    v0,
    v1,
    depth: 0.1875,
  });

  it('makes a through dado of one reaching two opposite edges, and a stopped dado of one reaching one', () => {
    const part = {
      ...housing,
      dadoes: [
        dado(6, 6.75, 0, 5.5), // across the width, edge to edge
        dado(0, 20, 2, 2.75), // along the length, end to end
        dado(16, 19, 5, 5.5), // in from the far edge only
      ],
    };
    const ops = cutAndDrillOperations([part], []).filter((o) => o.type.endsWith('dado'));
    const base = { partId: 'side', count: 1, depth: 0.1875 };
    expect(ops).toEqual([
      { id: 'side/dado-0', type: 'dado', ...base, dado: 0, length: 5.5, width: 0.75 },
      { id: 'side/dado-1', type: 'dado', ...base, dado: 1, length: 20, width: 0.75 },
      { id: 'side/dado-2', type: 'stopped-dado', ...base, dado: 2, length: 0.5, width: 3 },
    ]);
    for (const op of ops) expect(Operation.safeParse(op).error).toBeUndefined();
    // Not cut while breaking down boards: the template's outline places them.
    expect(boardCuts(ops)).toEqual([]);
  });

  it('refuses a dado closed on every side, or reaching two edges at a corner', () => {
    const closed = { ...housing, dadoes: [dado(6, 7, 1, 2)] };
    expect(() => cutAndDrillOperations([closed], [])).toThrow(/side\/dado-0 reaches 0 edges/);
    const corner = { ...housing, dadoes: [dado(18, 20, 5, 5.5)] };
    expect(() => cutAndDrillOperations([corner], [])).toThrow(/side\/dado-0 reaches 2 edges/);
  });

  it('makes a notch and a cutout through the thickness, each from a square end', () => {
    const part = {
      ...housing,
      notches: [{ end: 1 as const, edge: 'far' as const, along: 0.1875, across: 0.5 }],
      cutouts: [{ end: 0 as const, v0: 1.5, v1: 4, depth: 1 }],
    };
    const ops = cutAndDrillOperations([part], []);
    expect(ops.filter((o) => o.type === 'notch' || o.type === 'cutout')).toEqual([
      {
        id: 'side/notch-0',
        type: 'notch',
        partId: 'side',
        count: 1,
        notch: 0,
        along: 0.1875,
        across: 0.5,
        thickness: 1.5,
      },
      // 4 − 1.5 = 2.5 wide.
      {
        id: 'side/cutout-0',
        type: 'cutout',
        partId: 'side',
        count: 1,
        cutout: 0,
        width: 2.5,
        depth: 1,
        thickness: 1.5,
      },
    ]);
  });

  it('refuses a notch or cutout on an angled end', () => {
    const angled = { ...housing, ends: [square, { ...square, setting: 15 }] } as Part;
    const notched = {
      ...angled,
      notches: [{ end: 1 as const, edge: 'far' as const, along: 1, across: 1 }],
    };
    expect(() => cutAndDrillOperations([notched], [])).toThrow(/side\/notch-0 is on an angled end/);
    const cut = { ...angled, cutouts: [{ end: 1 as const, v0: 1, v1: 2, depth: 1 }] };
    expect(() => cutAndDrillOperations([cut], [])).toThrow(/side\/cutout-0 is on an angled end/);
  });
});
