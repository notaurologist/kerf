import { describe, expect, it } from 'vitest';
import type { Inventory } from '../inventory/tools.ts';
import { stock } from '../lumber/stock.ts';
import { cutAndDrillOperations } from '../model/operations.ts';
import type { Part } from '../model/types.ts';
import { selectMethod } from '../steps/select.ts';
import { cutDetail } from './cutDetail.ts';

// A door's grooves, rabbets, and finger recess on made-up parts of 2x4 (1-1/2" × 3-1/2"). A stile
// 14" long with a 1/4" groove 3/8" deep along its reference edge, 5/8" off the back face, end to
// end, and a finger recess 3/4" by 3" and 1/4" deep in the face shown. A panel 10" long rabbeted
// all round on the back face, 3/8" wide and 5/8" deep.

const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };
const base = {
  quantity: 4,
  markLengths: [],
  ends: [square, square] as Part['ends'],
  endsParallel: true,
  notes: [],
  selection: [],
  holes: [],
  boltAreas: [],
  tapers: [],
  dadoes: [],
  notches: [],
  cutouts: [],
  mortises: [],
  tenons: [],
  dovetails: [],
  screwHoles: [],
  grooves: [],
  rabbets: [],
  recesses: [],
  boredHoles: [],
  hingePlates: [],
  stock: stock('2x4'),
};
const stile: Part = {
  ...base,
  id: 'stile',
  letter: 'A',
  name: 'Stile',
  role: 'stile',
  length: 14,
  referenceEdge: 'inside edge',
  grooves: [{ edge: 'reference', u0: 0, u1: 14, n0: 0.625, width: 0.25, depth: 0.375 }],
  recesses: [{ face: 'far', u: 7, v: 1.75, width: 0.75, height: 3, depth: 0.25 }],
};
const panel: Part = {
  ...base,
  id: 'panel',
  letter: 'B',
  name: 'Panel',
  role: 'panel',
  length: 10,
  referenceEdge: 'bottom edge',
  rabbets: (['reference', 'far', 'first-end', 'second-end'] as const).map((edge) => ({
    edge,
    face: 'near' as const,
    width: 0.375,
    depth: 0.625,
  })),
};

describe('grooves, rabbets, and finger recesses', () => {
  it('become operations with their sizes', () => {
    const ops = cutAndDrillOperations([stile, panel], []);
    expect(ops.filter((o) => o.type === 'groove')).toEqual([
      {
        id: 'stile/groove-0',
        type: 'groove',
        partId: 'stile',
        count: 4,
        groove: 0,
        length: 14,
        width: 0.25,
        depth: 0.375,
        stopped: false,
      },
    ]);
    expect(ops.filter((o) => o.type === 'finger-recess')).toMatchObject([
      { width: 0.75, height: 3, depth: 0.25 },
    ]);
    // The long edges' rabbets run the 10" length; the ends' the 3-1/2" width.
    expect(ops.flatMap((o) => (o.type === 'rabbet' ? [o.length] : []))).toEqual([10, 10, 3.5, 3.5]);
  });

  it('are drawn and noted on the cut detail', () => {
    const detail = cutDetail(stile);
    expect(detail.notes).toContain(
      'Groove along the inside edge, end to end: 1/4" wide, 3/8" deep, 5/8" from the back face (dashed).',
    );
    expect(detail.notes).toContain(
      'Finger recess in the face shown: 3/4" by 3", 1/4" deep, centered 7" from the first end and 1-3/4" from the inside edge.',
    );
    const panelDetail = cutDetail(panel);
    expect(panelDetail.notes).toContain(
      'Rabbet along the first end, in the back face (dashed): 3/8" wide, 5/8" deep.',
    );
    const steps = panelDetail.primitives.filter((p) => p.kind === 'line' && p.role === 'hidden');
    expect(steps).toHaveLength(4);
  });

  it('are cut with a router when there is one, or a table saw or chisel otherwise', () => {
    const ops = cutAndDrillOperations([stile, panel], []);
    const op = (type: string) => {
      const found = ops.find((o) => o.type === type);
      if (!found) throw new Error(type);
      return found;
    };
    const kit = (...ids: string[]): Inventory => ({
      tools: ['tape-measure', 'combination-square', 'clamps', ...ids].map((toolTypeId) => ({
        toolTypeId,
        capabilities: {},
      })),
    });
    expect(selectMethod(op('groove'), kit('router')).chosen?.id).toBe('groove-router');
    expect(selectMethod(op('groove'), kit('table-saw')).chosen?.id).toBe('groove-table-saw');
    expect(selectMethod(op('rabbet'), kit('table-saw')).chosen?.id).toBe('rabbet-table-saw');
    expect(selectMethod(op('finger-recess'), kit('chisel')).chosen?.id).toBe(
      'finger-recess-chisel',
    );
  });
});
