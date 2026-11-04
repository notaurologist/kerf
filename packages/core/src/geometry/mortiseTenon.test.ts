import { describe, expect, it } from 'vitest';
import type { Inventory } from '../inventory/tools.ts';
import { fillMethodText, findMethod } from '../knowledge/methods.ts';
import { stock } from '../lumber/stock.ts';
import { cutAndDrillOperations } from '../model/operations.ts';
import type { Part, Placement, Vec3 } from '../model/types.ts';
import { selectMethod } from '../steps/select.ts';
import { cutDetail } from './cutDetail.ts';
import { partOutline, type UV } from './outline.ts';
import { solid } from './solid.ts';

// Mortises and tenons on made-up parts. An apron of 2x4 (1-1/2" × 3-1/2") 20" long with a tenon at
// each end: 1" long, 1/2" thick from 1/2" off the back face, 2-1/2" wide from 1/2" off the
// reference edge, so 1/2" cheeks and 1/2" shoulders all round. A leg of 4x4 (3-1/2" square) 20"
// long with two mortises for such tenons, 2-1/2" long, 1/2" wide, 1-1/4" deep: one in a face and
// one in the reference edge, each 2" from the first end and 1-1/2" across.

const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };
const base = {
  quantity: 2,
  length: 20,
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
};
const tenon = { length: 1, n0: 0.5, thickness: 0.5, v0: 0.5, width: 2.5 };
const apron: Part = {
  ...base,
  id: 'apron',
  letter: 'A',
  name: 'Apron',
  role: 'apron',
  stock: stock('2x4'),
  referenceEdge: 'bottom edge',
  tenons: [
    { end: 0, ...tenon },
    { end: 1, ...tenon },
  ],
};
const mortise = { withPart: 'apron', u0: 2, u1: 4.5, a0: 1.5, a1: 2, depth: 1.25 };
const leg: Part = {
  ...base,
  id: 'leg',
  letter: 'B',
  name: 'Leg',
  role: 'leg',
  stock: stock('4x4'),
  referenceEdge: 'inside edge',
  mortises: [
    { side: 'far', ...mortise },
    { side: 'reference-edge', ...mortise },
  ],
};

const area = (points: readonly UV[]) =>
  points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length] as UV;
    return sum + (p.u * q.v - q.u * p.v) / 2;
  }, 0);

describe('tenons', () => {
  it('show their shoulders on the face: 18 × 3-1/2 of body and two 1 × 2-1/2 tenons', () => {
    // 63 + 2 × 2.5 = 68.
    expect(area(partOutline(apron))).toBeCloseTo(68, 12);
  });

  it('stand out of the body as boxes 1/2" thick, and the body stops at the shoulders', () => {
    const at = { x: 0, y: 0, z: 0 };
    const pl: Placement = {
      partId: 'apron',
      instance: 0,
      origin: at,
      along: { x: 1, y: 0, z: 0 },
      across: { x: 0, y: 1, z: 0 },
      through: { x: 0, y: 0, z: 1 },
    };
    const faces = solid(apron, pl).faces;
    const xs = faces.flatMap((f) => f.points.map((p) => p.x));
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([0, 20]);
    // Points at the very ends belong to the tenons only: n from 1/2 to 1, v from 1/2 to 3.
    const ends = faces.flatMap((f) => f.points).filter((p) => p.x === 0 || p.x === 20);
    expect(new Set(ends.map((p) => p.z))).toEqual(new Set([0.5, 1]));
    expect(new Set(ends.map((p) => p.y))).toEqual(new Set([0.5, 3]));
  });

  it('become operations with their cheeks and shoulders', () => {
    const ops = cutAndDrillOperations([apron], []).filter((o) => o.type === 'tenon');
    expect(ops).toEqual(
      [0, 1].map((i) => ({
        id: `apron/tenon-${i}`,
        type: 'tenon',
        partId: 'apron',
        count: 2,
        tenon: i,
        end: i,
        length: 1,
        tenonThickness: 0.5,
        width: 2.5,
        thickness: 1.5,
        cheekBack: 0.5,
        cheekFront: 0.5,
        shoulderReference: 0.5,
        shoulderFar: 0.5,
      })),
    );
  });

  it('are noted on the cut detail, with the shoulder line on the face', () => {
    const detail = cutDetail(apron);
    expect(detail.notes).toContain(
      'Tenon at the first end, on the left: 1" long, 1/2" thick, 2-1/2" wide, 1/2" from the back face and 1/2" from the bottom edge.',
    );
    const shoulders = detail.primitives.filter(
      (p) => p.kind === 'line' && p.role === 'visible' && p.points.length === 2,
    );
    expect(shoulders.map((p) => (p.kind === 'line' ? p.points[0]?.x : null))).toEqual([1, 19]);
  });
});

describe('mitered tenons', () => {
  // The apron's tenons mitered 45° across their 1/2" thickness, long at the far cheek (n = 1): the
  // near cheek (n = 1/2) is 1/2 · tan 45° = 1/2 shorter, so it ends 1/2 in from each end.
  const mitered: Part = {
    ...apron,
    tenons: apron.tenons.map((t) => ({ ...t, miter: { angle: 45, long: 'far' as const } })),
  };
  const pl: Placement = {
    partId: 'apron',
    instance: 0,
    origin: { x: 0, y: 0, z: 0 },
    along: { x: 1, y: 0, z: 0 },
    across: { x: 0, y: 1, z: 0 },
    through: { x: 0, y: 0, z: 1 },
  };

  it('are drawn with the end sloped from the far cheek at the end to the near cheek 1/2 in', () => {
    const points = solid(mitered, pl).faces.flatMap((f) => f.points);
    // At the near cheek, z = 1/2, the tenon reaches x = 1/2 and 19-1/2; at the far, z = 1, the ends.
    const xsAt = (z: number) =>
      [...new Set(points.filter((p) => p.z === z).map((p) => Math.round(p.x * 1e9) / 1e9))].sort(
        (a, b) => a - b,
      );
    expect(xsAt(0.5)).toEqual([0.5, 1, 19, 19.5]);
    expect(xsAt(1)).toContain(0);
    expect(xsAt(1)).toContain(20);
    // Every face is wound counterclockwise seen from outside: its normal agrees with the turn of
    // its points (Newell's sum, which holds when three points in a row are in line).
    for (const f of solid(mitered, pl).faces) {
      const turn = f.points.reduce(
        (sum, a, i) => {
          const b = f.points[(i + 1) % f.points.length] as Vec3;
          return {
            x: sum.x + (a.y - b.y) * (a.z + b.z),
            y: sum.y + (a.z - b.z) * (a.x + b.x),
            z: sum.z + (a.x - b.x) * (a.y + b.y),
          };
        },
        { x: 0, y: 0, z: 0 },
      );
      expect(turn.x * f.normal.x + turn.y * f.normal.y + turn.z * f.normal.z).toBeGreaterThan(0);
    }
  });

  it('are long at the near cheek when the miter says so', () => {
    const near: Part = {
      ...apron,
      tenons: apron.tenons.map((t) => ({ ...t, miter: { angle: 45, long: 'near' as const } })),
    };
    const points = solid(near, pl).faces.flatMap((f) => f.points);
    const xsAt = (z: number) =>
      new Set(points.filter((p) => p.z === z).map((p) => Math.round(p.x * 1e9) / 1e9));
    expect(xsAt(0.5).has(0)).toBe(true);
    expect(xsAt(1).has(0)).toBe(false);
    expect(xsAt(1).has(0.5)).toBe(true);
  });

  it('become a miter operation after each tenon, its short cheek 1/2 shorter', () => {
    const ops = cutAndDrillOperations([mitered], []).filter((o) => o.type.startsWith('tenon'));
    expect(ops.map((o) => o.id)).toEqual([
      'apron/tenon-0',
      'apron/tenon-miter-0',
      'apron/tenon-1',
      'apron/tenon-miter-1',
    ]);
    expect(ops[1]).toEqual({
      id: 'apron/tenon-miter-0',
      type: 'tenon-miter',
      partId: 'apron',
      count: 2,
      tenon: 0,
      end: 0,
      angle: 45,
      setback: expect.closeTo(0.5, 12),
      long: 'far',
      tenonThickness: 0.5,
      width: 2.5,
    });
  });

  it('are noted on the cut detail, the short cheek dashed behind the long one on the face shown', () => {
    const detail = cutDetail(mitered);
    expect(detail.notes).toContain(
      'Tenon at the first end, on the left: 1" long, 1/2" thick, 2-1/2" wide, 1/2" from the back face and 1/2" from the bottom edge. Its end is mitered 45.0° across the thickness: the cheek toward the face shown is the long one, and the other is 1/2" shorter.',
    );
    const hidden = detail.primitives.filter(
      (p) => p.kind === 'line' && p.role === 'hidden' && p.points.length === 2,
    );
    const xs = hidden.map((p) => (p.kind === 'line' ? (p.points[0]?.x ?? 0) : 0));
    expect(xs).toHaveLength(2);
    expect(xs[0]).toBeCloseTo(0.5, 12);
    expect(xs[1]).toBeCloseTo(19.5, 12);
  });

  it('are made by hand saw or chisel, with the setback and angle in the text', () => {
    const [op] = cutAndDrillOperations([mitered], []).filter((o) => o.type === 'tenon-miter');
    if (!op) throw new Error('no miter');
    const marking = ['tape-measure', 'combination-square', 'clamps'];
    const tools = (...ids: string[]): Inventory => ({
      tools: ids.map((toolTypeId) => ({ toolTypeId, capabilities: {} })),
    });
    expect(selectMethod(op, tools(...marking, 'hand-saw', 'chisel')).chosen?.id).toBe(
      'tenon-miter-hand-saw',
    );
    expect(selectMethod(op, tools(...marking, 'chisel')).chosen?.id).toBe('tenon-miter-chisel');
    expect(fillMethodText(findMethod('tenon-miter-hand-saw')?.setup.join(' ') ?? '', op)).toContain(
      '1/2" back from the end of the 1/2" tenon',
    );
    expect(fillMethodText(findMethod('tenon-miter-chisel')?.setup.join(' ') ?? '', op)).toContain(
      'The lines lie at 45.0°.',
    );
  });
});

describe('mortises', () => {
  it('become operations 2-1/2" long, 1/2" wide, 1-1/4" deep', () => {
    const ops = cutAndDrillOperations([leg], []).filter((o) => o.type === 'mortise');
    expect(ops.map((o) => o.type === 'mortise' && [o.id, o.length, o.width, o.depth])).toEqual([
      ['leg/mortise-0', 2.5, 0.5, 1.25],
      ['leg/mortise-1', 2.5, 0.5, 1.25],
    ]);
  });

  it('draw solid on the face shown, and dashed from the edge as deep as they go', () => {
    const detail = cutDetail(leg);
    const boxes = detail.primitives.filter((p) => p.kind === 'polygon' && p.fill === 'none');
    expect(boxes.map((p) => p.kind === 'polygon' && [p.role, p.points.map((q) => q.y)])).toEqual([
      ['visible', [-1.5, -1.5, -2, -2]],
      // The reference edge is at v = 0, the page's y = 0; 1-1/4" deep.
      ['hidden', [-0, -0, -1.25, -1.25]],
    ]);
    expect(detail.notes).toContain(
      'Mortise 2" from the first end, in the inside edge (dashed): 2-1/2" long, 1/2" wide, 1-1/4" deep, starting 1-1/2" from the back face.',
    );
  });
});

describe('methods', () => {
  const tools = (...ids: string[]): Inventory => ({
    tools: ids.map((toolTypeId) => ({ toolTypeId, capabilities: {} })),
  });
  const [op] = cutAndDrillOperations([leg], []).filter((o) => o.type === 'mortise');
  const [ten] = cutAndDrillOperations([apron], []).filter((o) => o.type === 'tenon');

  it('cut a mortise with a router when there is one, and a drill and chisel otherwise', () => {
    const marking = ['tape-measure', 'combination-square', 'clamps', 'chisel'];
    if (!op || !ten) throw new Error('no operations');
    expect(selectMethod(op, tools(...marking, 'router')).chosen?.id).toBe('mortise-router');
    expect(selectMethod(op, tools(...marking, 'drill-driver', 'spade-bits')).chosen?.id).toBe(
      'mortise-drill-and-chisel',
    );
    expect(selectMethod(ten, tools(...marking, 'hand-saw')).chosen?.id).toBe('tenon-hand-saw');
  });
});

describe('screw holes', () => {
  // A 2x4 cleat 12" long holding a case bottom that moves 0.149" toward the back: a round hole at
  // the front, 1" in, and two slots behind it, each 0.149 + 1/16 = 0.2115" longer, toward the
  // second end.
  const slot = 0.149 + 0.0625;
  const cleat: Part = {
    ...base,
    id: 'cleat',
    letter: 'C',
    name: 'Cleat',
    role: 'cleat',
    stock: stock('2x4'),
    quantity: 2,
    length: 12,
    referenceEdge: 'bottom edge',
    screwHoles: [
      { hardwareId: 'screw', u: 1, v: 1.75, slot: 0, direction: 'along' },
      { hardwareId: 'screw', u: 6, v: 1.75, slot, direction: 'along' },
      { hardwareId: 'screw', u: 10.5, v: 1.75, slot, direction: 'along' },
    ],
  };

  it('become one operation per part, with the round and slotted counts and the slot', () => {
    const [op] = cutAndDrillOperations([cleat], []).filter((o) => o.type === 'screw-holes');
    expect(op).toEqual({
      id: 'cleat/screw-holes',
      type: 'screw-holes',
      partId: 'cleat',
      count: 2,
      round: 1,
      slotted: 2,
      slot,
      thickness: 1.5,
    });
  });

  it('are marked on the cut detail, each slot drawn its length toward the second end', () => {
    const detail = cutDetail(cleat);
    expect(detail.notes).toContain(
      'Screw holes: 1 round, and 2 slotted 3/16" longer, toward the second end, so the part they hold can move.',
    );
    const slots = detail.primitives.filter(
      (p) => p.kind === 'line' && p.role === 'visible' && p.points.length === 2,
    );
    const lengths = slots.map((p) =>
      p.kind === 'line' ? (p.points[1]?.x ?? 0) - (p.points[0]?.x ?? 0) : 0,
    );
    expect(lengths).toHaveLength(2);
    for (const length of lengths) expect(length).toBeCloseTo(slot, 12);
  });

  it('are drilled and pared, or routed when there is a router', () => {
    const [op] = cutAndDrillOperations([cleat], []).filter((o) => o.type === 'screw-holes');
    if (!op) throw new Error('no operation');
    const kit = (...ids: string[]): Inventory => ({
      tools: ['tape-measure', 'combination-square', 'clamps', 'drill-driver', ...ids].map(
        (toolTypeId) => ({ toolTypeId, capabilities: {} }),
      ),
    });
    expect(selectMethod(op, kit('chisel')).chosen?.id).toBe('screw-holes-drill');
    expect(selectMethod(op, kit('router')).chosen?.id).toBe('screw-holes-router');
  });
});
