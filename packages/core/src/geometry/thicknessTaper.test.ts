import { describe, expect, it } from 'vitest';
import { stock } from '../lumber/stock.ts';
import { cutAndDrillOperations } from '../model/operations.ts';
import type { Part, Placement } from '../model/types.ts';
import { cutDetail } from './cutDetail.ts';
import { solid } from './solid.ts';
import { cross, dot, sub, unit } from './vec.ts';

// A part tapered on two adjacent faces, as a Shaker leg is on its inside faces: 1-1/2" square
// (a 2x2's actual size, stood in for by a 2x4's thickness in both directions here), 7-1/2" long,
// each taper from full size 5" from the first end to 1/2" less at the first end, leaving a 1"
// square foot.

const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };
const angle = (Math.atan(0.5 / 5) * 180) / Math.PI;
const leg: Part = {
  id: 'leg',
  letter: 'A',
  name: 'Leg',
  role: 'leg',
  stock: { ...stock('2x4'), width: 1.5 },
  quantity: 4,
  length: 7.5,
  markLengths: [],
  ends: [square, square],
  endsParallel: true,
  notes: [],
  selection: [],
  referenceEdge: 'inside edge',
  holes: [],
  boltAreas: [],
  tapers: [
    {
      description: 'Inside edge',
      start: { u: 5, v: 0 },
      end: { u: 0, v: 0.5 },
      angleToEdge: angle,
    },
    {
      description: 'Inside face',
      start: { u: 5, v: 0 },
      end: { u: 0, v: 0.5 },
      angleToEdge: angle,
      plane: 'thickness',
    },
  ],
  dadoes: [],
  notches: [],
  cutouts: [],
  mortises: [],
  tenons: [],
  screwHoles: [],
  grooves: [],
  rabbets: [],
  recesses: [],
  boredHoles: [],
};
const pl: Placement = {
  partId: 'leg',
  instance: 0,
  origin: { x: 0, y: 0, z: 0 },
  along: { x: 1, y: 0, z: 0 },
  across: { x: 0, y: 1, z: 0 },
  through: { x: 0, y: 0, z: 1 },
};

describe('a taper that takes off thickness', () => {
  const faces = solid(leg, pl).faces;

  it('leaves a 1" square foot and full size above the tapers', () => {
    const at = (x: number) =>
      faces.flatMap((f) => f.points).filter((p) => Math.abs(p.x - x) < 1e-9);
    const foot = at(0);
    expect([Math.min(...foot.map((p) => p.y)), Math.max(...foot.map((p) => p.y))]).toEqual([
      0.5, 1.5,
    ]);
    expect([Math.min(...foot.map((p) => p.z)), Math.max(...foot.map((p) => p.z))]).toEqual([
      0.5, 1.5,
    ]);
    const top = at(7.5);
    expect([Math.min(...top.map((p) => p.z)), Math.max(...top.map((p) => p.z))]).toEqual([0, 1.5]);
  });

  it('draws every face flat, so it can be painted', () => {
    for (const f of faces) {
      const [a, b, c] = f.points as [typeof pl.along, typeof pl.along, typeof pl.along];
      const n = unit(cross(sub(b, a), sub(c, a)));
      for (const p of f.points) expect(Math.abs(dot(sub(p, a), n))).toBeLessThan(1e-9);
    }
  });

  it('is cut through the width, and noted on the cut detail', () => {
    const ops = cutAndDrillOperations([leg], []).filter((o) => o.type === 'taper');
    expect(ops.map((o) => o.type === 'taper' && o.thickness)).toEqual([1.5, 1.5]);
    expect(cutDetail(leg).notes).toContain(
      'Taper the back face too: from full thickness 5" from the first end to 1/2" thinner at the first end.',
    );
  });
});
