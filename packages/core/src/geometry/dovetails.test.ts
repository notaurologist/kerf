import { describe, expect, it } from 'vitest';
import type { Inventory } from '../inventory/tools.ts';
import { fillMethodText } from '../knowledge/methods.ts';
import { cutAndDrillOperations, type Operation } from '../model/operations.ts';
import type { Part } from '../model/types.ts';
import { selectMethod } from '../steps/select.ts';
import { cutDetail } from './cutDetail.ts';

// A drawer box's front corner, on made-up parts. A side 18 long, 5-1/2 wide, 1/2 thick (two of
// them), with tails at its first end; a front 12 long, 5-1/2 wide, 3/4 thick, with pins at both
// ends, narrow at its far face. 3 tails at 1:8 between 3/8 half pins and 1/4 pins: each tail
// (5.5 − 0.75 − 0.5) / 3 = 1.41667 wide at the end, 1-7/16 to the sixteenth. Each wall moves
// 0.75 / 8 = 0.09375 across the side's 3/4 baseline and across the front's 3/4 thickness, so the
// first wall runs from 0.375 at the end to 0.46875 at the baseline, and the first socket for a
// tail in the front's far face spans 0.375 to 1.79167, in its near face 0.46875 to 1.69792.

const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };
const layout = { tails: 3, slope: 8, halfPin: 0.375, pin: 0.25 };
const base = {
  markLengths: [],
  ends: [square, square] as Part['ends'],
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
  mortises: [],
  tenons: [],
  screwHoles: [],
  grooves: [],
  rabbets: [],
  recesses: [],
};
const side: Part = {
  ...base,
  id: 'side',
  letter: 'A',
  name: 'Side',
  role: 'side',
  stock: { nominal: '1/2 board', thickness: 0.5, width: 5.5, buyableFeet: [8] },
  quantity: 2,
  length: 18,
  dovetails: [{ board: 'tails', withPart: 'front', end: 0, baseline: 0.75, ...layout }],
};
const pins = (end: 0 | 1) =>
  ({
    board: 'pins',
    withPart: 'side',
    end,
    baseline: 0.5,
    outside: 'far',
    ...layout,
  }) as const;
const front: Part = {
  ...base,
  id: 'front',
  letter: 'B',
  name: 'Front',
  role: 'front',
  stock: { nominal: '3/4 board', thickness: 0.75, width: 5.5, buyableFeet: [8] },
  quantity: 1,
  length: 12,
  dovetails: [pins(0), pins(1)],
};

const polygons = (part: Part) =>
  cutDetail(part).primitives.flatMap((p) => (p.kind === 'polygon' && p.fill !== 2 ? [p] : []));

describe('dovetail cut details', () => {
  it('hatch the waste between the tails: two half-pin sockets and two pin sockets', () => {
    const waste = polygons(side);
    expect(waste.map((p) => [p.role, p.fill])).toEqual(Array(4).fill(['visible', 'zone']));
    const first = waste[0]?.points.map((q) => [q.x, -q.y]);
    // The half pin's socket: the straight edge, then 3/8 wide at the end and 15/32 at the baseline.
    expect(first).toEqual([
      [0, 0],
      [0.75, 0],
      [0.75, 0.46875],
      [0, 0.375],
    ]);
  });

  it('say how many tails, how wide, at what slope, and how far in', () => {
    expect(cutDetail(side).notes).toContain(
      'Dovetail tails at the first end, on the left: 3 tails, each 1-7/16" wide at the end, sloped 1:8 on the faces and cut 3/4" in to the baseline, between half pins 3/8" and pins 1/4" wide at their narrow ends. The waste is hatched.',
    );
  });

  it('hatch the tails’ sockets on the face shown, narrow face, and dash them on the back', () => {
    const sockets = polygons(front);
    // Three sockets per face at each of two ends.
    expect(sockets.map((p) => p.role)).toEqual([
      ...Array(3).fill('visible'),
      ...Array(3).fill('hidden'),
      ...Array(3).fill('visible'),
      ...Array(3).fill('hidden'),
    ]);
    const ys = (i: number) => [...new Set(sockets[i]?.points.map((q) => -q.y))];
    expect(ys(0)[0]).toBe(0.375);
    expect(ys(0)[1]).toBeCloseTo(1.791667, 6);
    expect(ys(3)[0]).toBe(0.46875);
    expect(ys(3)[1]).toBeCloseTo(1.697917, 6);
    // Cut 1/2 in from each end.
    expect([...new Set(sockets[6]?.points.map((q) => q.x))]).toEqual([12, 11.5]);
    expect(cutDetail(front).notes).toContain(
      'Dovetail pins at the first end, on the left: 2 pins and a half pin at each edge, 1/4" and 3/8" wide at the face shown, sloped 1:8 across the thickness and cut 1/2" in to the baseline. The tails\' sockets are hatched on the face shown and dashed on the back.',
    );
  });
});

describe('dovetail operations', () => {
  it('cut the tails on each side, and the pins at each end of the front', () => {
    const ops = cutAndDrillOperations([side, front], []).filter((o) =>
      o.type.startsWith('dovetail'),
    );
    expect(ops).toEqual([
      {
        id: 'side/dovetails-0',
        type: 'dovetail-tails',
        partId: 'side',
        count: 2,
        dovetails: 0,
        end: 0,
        tails: 3,
        slope: 8,
        baseline: 0.75,
        halfPin: 0.375,
        pin: 0.25,
        tailWide: expect.closeTo(1.416667, 6),
        thickness: 0.5,
      },
      ...([0, 1] as const).map((i) => ({
        id: `front/dovetails-${i}`,
        type: 'dovetail-pins',
        partId: 'front',
        count: 1,
        dovetails: i,
        end: i,
        pins: 2,
        slope: 8,
        baseline: 0.5,
        halfPin: 0.375,
        pin: 0.25,
        thickness: 0.75,
      })),
    ]);
  });

  it('are refused on an angled end, or when the tails do not fit', () => {
    const angled = { ...square, setting: 10 };
    expect(() => cutAndDrillOperations([{ ...side, ends: [angled, square] }], [])).toThrow(
      'side/dovetails-0 is on an angled end',
    );
    const tails = side.dovetails[0] as Part['dovetails'][number];
    const steep: Part = { ...side, dovetails: [{ ...tails, slope: 1 }] };
    expect(() => cutAndDrillOperations([steep], [])).toThrow('do not fit');
  });
});

describe('dovetail methods', () => {
  const [tailsOp, pinsOp] = cutAndDrillOperations([side, front], []).filter((o) =>
    o.type.startsWith('dovetail'),
  ) as [Operation, Operation];
  const kit = (...ids: string[]): Inventory => ({
    tools: ids.map((toolTypeId) => ({ toolTypeId, capabilities: {} })),
  });
  const hand = ['tape-measure', 'combination-square', 'clamps', 'hand-saw', 'chisel'];

  it('use a router and a dovetail jig when there are both, and a saw and chisel otherwise', () => {
    const shop = kit(...hand, 'sliding-bevel', 'router', 'dovetail-jig');
    expect(selectMethod(tailsOp, shop).chosen?.id).toBe('dovetail-tails-router-jig');
    expect(selectMethod(pinsOp, shop).chosen?.id).toBe('dovetail-pins-router-jig');
    expect(selectMethod(tailsOp, kit(...hand, 'sliding-bevel', 'router')).chosen?.id).toBe(
      'dovetail-tails-hand-saw',
    );
    expect(selectMethod(pinsOp, kit(...hand)).chosen?.id).toBe('dovetail-pins-hand-saw');
  });

  // atan(1/8) = 7.125°, shown to a tenth.
  it('fill the slope as a ratio, its run, and its angle from square', () => {
    expect(fillMethodText('{slope}, {slopeRun}, {slopeAngle}, {tailWide}', tailsOp)).toBe(
      '1:8, 8, 7.1°, 1-7/16"',
    );
    expect(fillMethodText('{pins} pins {pin} wide, half pins {halfPin}', pinsOp)).toBe(
      '2 pins 1/4" wide, half pins 3/8"',
    );
  });
});
