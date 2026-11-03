import { describe, expect, it } from 'vitest';
import type { Part, Placement, Vec3 } from '../model/types.ts';
import type { HardwareLine } from '../outputs/hardwareList.ts';
import { fitProblems } from './fit.ts';

// Hand-checked on made-up parts, in inches. Each check passes on parts that go together and
// reports the one change that makes them not.

const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };
const part = (
  id: string,
  length: number,
  width: number,
  thickness: number,
  over: Partial<Part> = {},
): Part => ({
  id,
  letter: 'A',
  name: id,
  role: id,
  stock: { nominal: id, thickness, width, buyableFeet: [8] },
  quantity: 1,
  length,
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
  ...over,
});
const at = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const X = at(1, 0, 0);
const Y = at(0, 1, 0);
const Z = at(0, 0, 1);
const minus = (v: Vec3) => at(-v.x, -v.y, -v.z);
const place = (
  partId: string,
  origin: Vec3,
  along: Vec3,
  across: Vec3,
  through: Vec3,
  instance = 0,
): Placement => ({ partId, instance, origin, along, across, through });
const checks = (parts: Part[], placements: Placement[], hardware: HardwareLine[] = []) =>
  fitProblems({ parts, placements }, hardware).map((p) => `${p.check} ${p.partId}`);

describe('dadoes', () => {
  // A 3/4 side, 30 tall and 11-1/4 deep, thickness x 0 to 0.75. A 3/4 shelf along x from x = 0.5,
  // bottom at z = 10, its first end 1/4 into a dado in the side's far face: u 10 to 10.75, v 0 to
  // 11.25, in the side's frame.
  const side = (dado: Partial<Part['dadoes'][number]> = {}) =>
    part('side', 30, 11.25, 0.75, {
      dadoes: [
        {
          withPart: 'shelf',
          face: 'far',
          u0: 10,
          u1: 10.75,
          v0: 0,
          v1: 11.25,
          depth: 0.25,
          ...dado,
        },
      ],
    });
  const shelf = (over: Partial<Part> = {}) => part('shelf', 19.5, 11.25, 0.75, over);
  const placements = (shelfX = 0.5) => [
    place('side', at(0, 0, 0), Z, Y, X),
    place('shelf', at(shelfX, 0, 10), X, Y, Z),
  ];

  it('accepts an end that fills its dado to the bottom', () => {
    expect(checks([side(), shelf()], placements())).toEqual([]);
  });

  it('reports an end short of the bottom, and a dado wider than the end', () => {
    expect(checks([side(), shelf()], placements(0.6))).toEqual(['dado side']);
    expect(checks([side({ u1: 11 }), shelf()], placements())).toEqual(['dado side']);
  });

  it('matches a stopped dado to the end notched beside it: 1/2 across, 1/4 along', () => {
    const notch = { end: 0 as const, edge: 'reference' as const, along: 0.25, across: 0.5 };
    expect(checks([side({ v0: 0.5 }), shelf({ notches: [notch] })], placements())).toEqual([]);
    expect(checks([side({ v0: 0.5 }), shelf()], placements())).toEqual(['dado side']);
  });

  it('accepts a piece whose edge runs in it, as a door in its track', () => {
    // A 3/4 door, 20 long and 10 tall, standing in a 1/4-deep track in a bottom's top face.
    const bottom = part('bottom', 30, 12, 0.75, {
      dadoes: [{ withPart: 'door', face: 'far', u0: 1, u1: 29, v0: 1, v1: 1.8125, depth: 0.25 }],
    });
    const door = part('door', 20, 10, 0.75);
    const placed = (z: number) => [
      place('bottom', at(0, 0, 0), X, Y, Z),
      place('door', at(5, 1.0625 + 0.75, z), X, Z, minus(Y)),
    ];
    expect(checks([bottom, door], placed(0.5))).toEqual([]);
    expect(checks([bottom, door], placed(0.4))).toEqual(['dado bottom']);
  });
});

describe('mortises and tenons', () => {
  // A 1-1/2 square post along z, its reference-edge face at x = 0. A 3/4 by 3 rail along x from
  // x = −20 to 1, centered across the post (y 0.375 to 1.125), bottom at z = 4, with a tenon 1
  // long, 2 wide from 1/2, 1/4 thick from 1/4. Its mortise: u 4.5 to 6.5, a 0.625 to 0.875.
  const mortise = {
    withPart: 'rail',
    side: 'reference-edge' as const,
    u0: 4.5,
    u1: 6.5,
    a0: 0.625,
    a1: 0.875,
    depth: 1,
  };
  const tenon = { end: 1 as const, length: 1, n0: 0.25, thickness: 0.25, v0: 0.5, width: 2 };
  const placements = [
    place('post', at(0, 0, 0), Z, X, Y),
    place('rail', at(-20, 1.125, 4), X, Z, minus(Y)),
  ];
  const post = (m = mortise) => part('post', 10, 1.5, 1.5, { mortises: [m] });
  const rail = (t = tenon) => part('rail', 21, 3, 0.75, { tenons: [t] });

  it('accepts a tenon that fills its mortise', () => {
    expect(checks([post(), rail()], placements)).toEqual([]);
  });

  it('reports a mortise that does not match its tenon, and the tenon it leaves', () => {
    expect(checks([post({ ...mortise, a0: 0.5 }), rail()], placements)).toEqual([
      'mortise post',
      'tenon rail',
    ]);
  });

  it('reports a mortise outside its part, even when its tenon matches it', () => {
    // The rail moved 1 toward +y: its tenon is at y 1.625 to 1.875, past the post's 1-1/2, and a
    // mortise there agrees with it while lying outside the wood.
    const off = { ...mortise, a0: 1.625, a1: 1.875 };
    const offRail = [placements[0] as Placement, place('rail', at(-20, 2.125, 4), X, Z, minus(Y))];
    expect(checks([post(off), rail()], offRail)).toEqual(['within post']);
  });

  it('accepts a stub tenon in a groove along the other part, and reports one past it', () => {
    // A 2-wide stile along z, its far edge at x = 2 grooved 3/8 deep, 1/4 wide from 1/4. A rail
    // along x from 1.625 into it, its stub tenon 3/8 long, full width, 1/4 thick from 1/4.
    const groove = { edge: 'far' as const, u0: 0, u1: 10, n0: 0.25, width: 0.25, depth: 0.375 };
    const stile = part('stile', 10, 2, 0.75, { grooves: [groove] });
    const stub = (n0: number) =>
      part('rail', 8.375, 2, 0.75, {
        tenons: [{ end: 0, length: 0.375, n0, thickness: 0.25, v0: 0, width: 2 }],
      });
    const placed = [
      place('stile', at(0, 0, 0), Z, X, Y),
      place('rail', at(1.625, 0.75, 3), X, Z, minus(Y)),
    ];
    expect(checks([stile, stub(0.25)], placed)).toEqual([]);
    expect(checks([stile, stub(0.375)], placed)).toEqual(['tenon rail']);
  });
});

describe('tongues', () => {
  // A 3/4 frame part along x with a groove along its far edge (z = 2), 1/4 wide from 1/4, 3/8
  // deep. A 1/2 panel above it, its bottom edge 1/32 short of the groove's bottom, centered: its
  // edges rabbeted 1/8 on each face to a 1/4 tongue.
  const groove = { edge: 'far' as const, u0: 0, u1: 12, n0: 0.25, width: 0.25, depth: 0.375 };
  const frame = part('frame', 12, 2, 0.75, { grooves: [groove] });
  const panel = (depth: number) =>
    part('panel', 8, 6, 0.5, {
      rabbets: (['near', 'far'] as const).map((face) => ({
        edge: 'reference' as const,
        face,
        width: 0.375,
        depth,
      })),
    });
  const placements = [
    place('frame', at(0, 0.75, 0), X, Z, minus(Y)),
    place('panel', at(2, 0.625, 1.625 + 1 / 32), X, Z, minus(Y)),
  ];

  it('accepts a tongue in the groove, and reports one too thick for it', () => {
    expect(checks([frame, panel(0.125)], placements)).toEqual([]);
    // Rabbeted 1/16 on each face, the tongue is 3/8, wider than the 1/4 groove.
    expect(checks([frame, panel(0.0625)], placements)).toEqual(['tongue panel']);
  });
});

describe('bolts', () => {
  // Two 2x4s lapped flat: A along x, z 0 to 1.5; B along y on top, z 1.5 to 3. A bolt down
  // through both at (3, 2): a hole 1.5 long in each, grip 3.
  const hole = (u: number, v: number, n: number, length = 1.5) => ({
    hardwareId: 'bolts',
    diameter: 0.5625,
    boltDiameter: 0.5,
    entry: { u, v, n },
    direction: { u: 0, v: 0, n: -1 },
    length,
  });
  const line = (grip: number): HardwareLine => ({
    description: 'Bolts',
    notes: [],
    bolt: { diameter: 0.5, grip, items: ['bolts'] },
  });
  const placements = (bz = 1.5) => [
    place('a', at(0, 0, 0), X, Y, Z),
    place('b', at(5, -10, bz), Y, minus(X), Z),
  ];
  const a = part('a', 20, 3.5, 1.5, { holes: [hole(3, 2, 1.5)] });
  const b = part('b', 20, 3.5, 1.5, { holes: [hole(12, 2, 1.5)] });

  it('accepts holes that touch end to end, as long as the grip', () => {
    expect(checks([a, b], placements(), [line(3)])).toEqual([]);
  });

  it('reports a grip that is not the holes, and a gap between parts', () => {
    // Each problem names the first part along the bolt, B, on top.
    expect(checks([a, b], placements(), [line(3.5)])).toEqual(['bolt b']);
    // B raised 1/4: two runs of 1.5, each short of the grip.
    expect(checks([a, b], placements(1.75), [line(3)]).sort()).toEqual(['bolt a', 'bolt b']);
  });

  it('takes bolts apart on one line as separate bolts', () => {
    // The same lap again 40 along x: two bolts, each 3.
    const placed = [
      ...placements(),
      place('a', at(40, 0, 0), X, Y, Z, 1),
      place('b', at(45, -10, 1.5), Y, minus(X), Z, 1),
    ];
    expect(checks([a, b], placed, [line(3)])).toEqual([]);
  });
});
