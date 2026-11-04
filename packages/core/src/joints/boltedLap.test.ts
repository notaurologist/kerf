import { describe, expect, it } from 'vitest';
import type { Part, Placement } from '../model/types.ts';
import { boltHoleDiameter } from '../structural/boltHoles.ts';
import { type Bolt, boltedLap, type PlacedPart } from './boltedLap.ts';
import { compare } from './compare.ts';

// Hand-checked on two 2x4s (1-1/2" by 3-1/2"), lapped flat. A runs along x from the origin,
// width toward +y, thickness from z = 0 to 1.5. B runs along y from y = −10 on top of it, width
// toward −x from x = 5, thickness from z = 1.5 to 3.

const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };
const board = (id: string, over: Partial<Part> = {}): Part => ({
  id,
  letter: 'A',
  name: id,
  role: id,
  stock: { nominal: '2x4', thickness: 1.5, width: 3.5, buyableFeet: [8] },
  quantity: 1,
  length: 20,
  markLengths: [],
  ends: [square, square],
  endsParallel: true,
  notes: [],
  selection: [],
  referenceEdge: 'edge',
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
  boredHoles: [],
  hingePlates: [],
  dovetails: [],
  ...over,
});
const placed = (part: Part, placement: Omit<Placement, 'partId' | 'instance'>): PlacedPart => ({
  part,
  placement: { partId: part.id, instance: 0, ...placement },
});
const A = placed(board('a'), {
  origin: { x: 0, y: 0, z: 0 },
  along: { x: 1, y: 0, z: 0 },
  across: { x: 0, y: 1, z: 0 },
  through: { x: 0, y: 0, z: 1 },
});
const B = (z = 1.5) =>
  placed(board('b'), {
    origin: { x: 5, y: -10, z },
    along: { x: 0, y: 1, z: 0 },
    across: { x: -1, y: 0, z: 0 },
    through: { x: 0, y: 0, z: 1 },
  });
const down = (stack: Bolt['stack']): Bolt => ({
  hardwareId: 'bolts',
  diameter: 0.5,
  point: { x: 3, y: 2, z: 10 },
  direction: { x: 0, y: 0, z: -2 },
  stack,
});
const hole = boltHoleDiameter(0.5);

describe('boltedLap', () => {
  it('drills each part where the bolt runs through it and adds up the grip', () => {
    const made = boltedLap(
      down([
        { ...B(), from: 'far-face' },
        { ...A, from: 'far-face' },
      ]),
    );
    expect(made).toEqual({
      ok: true,
      grip: 3,
      holes: [
        {
          partId: 'b',
          instance: 0,
          hole: {
            hardwareId: 'bolts',
            diameter: hole,
            boltDiameter: 0.5,
            // (3, 2, 3) is 12 along B from y = −10, 2 across from x = 5, on its top face.
            entry: { u: 12, v: 2, n: 1.5 },
            direction: { u: 0, v: 0, n: -1 },
            length: 1.5,
          },
        },
        {
          partId: 'a',
          instance: 0,
          hole: {
            hardwareId: 'bolts',
            diameter: hole,
            boltDiameter: 0.5,
            entry: { u: 3, v: 2, n: 1.5 },
            direction: { u: 0, v: 0, n: -1 },
            length: 1.5,
          },
        },
      ],
    });
  });

  it('enters from the other side when that is the side named', () => {
    const made = boltedLap(down([{ ...A, from: 'near-face' }]));
    expect(made.ok && made.holes[0]?.hole).toMatchObject({
      entry: { u: 3, v: 2, n: 0 },
      direction: { u: 0, v: 0, n: 1 },
    });
  });

  it('gives a longer hole for a bolt at an angle: 1.5 / cos 30° = 1.732', () => {
    const tilted = { ...down([{ ...A, from: 'far-face' }]) };
    tilted.point = { x: 3, y: 2, z: 0.75 };
    tilted.direction = { x: Math.sin(Math.PI / 6), y: 0, z: -Math.cos(Math.PI / 6) };
    const made = boltedLap(tilted);
    expect(made.ok && made.grip).toBeCloseTo(1.5 / Math.cos(Math.PI / 6), 12);
    expect(1.732).toBeCloseTo(made.ok ? made.grip : 0, 3);
  });

  it('stops at a taper: a 45° cut from (3.5, 0) to (0, 3.5) leaves 1" at u = 1', () => {
    const tapered = placed(
      board('a', {
        tapers: [
          { description: 'Taper', start: { u: 3.5, v: 0 }, end: { u: 0, v: 3.5 }, angleToEdge: 45 },
        ],
      }),
      A.placement,
    );
    const made = boltedLap({
      hardwareId: 'bolts',
      diameter: 0.5,
      point: { x: 1, y: 10, z: 0.75 },
      direction: { x: 0, y: -1, z: 0 },
      stack: [{ ...tapered, from: 'far-edge' }],
    });
    expect(made.ok && made.holes[0]?.hole).toMatchObject({
      entry: { u: 1, v: 3.5, n: 0.75 },
      direction: { u: 0, v: -1, n: 0 },
    });
    expect(made.ok && made.grip).toBeCloseTo(1, 12);
  });

  it('gives the same holes for a direction of any length', () => {
    const unit = down([{ ...A, from: 'far-face' }]);
    expect(
      compare(boltedLap(unit), boltedLap({ ...unit, direction: { x: 0, y: 0, z: -1 } })),
    ).toEqual([]);
  });

  it('refuses a gap between parts along the bolt', () => {
    expect(
      boltedLap(
        down([
          { ...B(1.75), from: 'far-face' },
          { ...A, from: 'far-face' },
        ]),
      ),
    ).toMatchObject({ ok: false, partId: 'a', message: expect.stringMatching(/gap/) });
  });

  it('refuses a side the bolt does not pass through', () => {
    expect(boltedLap(down([{ ...A, from: 'reference-edge' }]))).toMatchObject({
      ok: false,
      partId: 'a',
    });
  });

  it('refuses a bolt that misses the part', () => {
    expect(
      boltedLap({ ...down([{ ...A, from: 'far-face' }]), point: { x: 30, y: 2, z: 0 } }),
    ).toMatchObject({
      ok: false,
      message: 'The bolt misses the part.',
    });
  });

  it('refuses a part with a notch', () => {
    const notched = placed(
      board('a', { notches: [{ end: 0, edge: 'far', along: 1, across: 1 }] }),
      A.placement,
    );
    expect(boltedLap(down([{ ...notched, from: 'far-face' }]))).toMatchObject({ ok: false });
  });
});
