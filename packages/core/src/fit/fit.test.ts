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
  dovetails: [],
  screwHoles: [],
  grooves: [],
  rabbets: [],
  recesses: [],
  boredHoles: [],
  hingePlates: [],
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

  it('accepts a mortise left 1/8 long on any one side for movement, when it records the room', () => {
    const room = (at: 'u0' | 'u1' | 'a0' | 'a1') => ({ at, length: 0.125 });
    const left = [
      { ...mortise, u0: 4.375, room: room('u0') },
      { ...mortise, u1: 6.625, room: room('u1') },
      { ...mortise, a0: 0.5, room: room('a0') },
      { ...mortise, a1: 1, room: room('a1') },
    ];
    for (const m of left) expect(checks([post(m), rail()], placements)).toEqual([]);
  });

  it('reports room on the side the tenon is held at, and room as long as the mortise', () => {
    // Left long below a0, but the room says above a1: the held part, 0.5 to 0.875, is not the tenon.
    const wrongSide = { ...mortise, a0: 0.5, room: { at: 'a1' as const, length: 0.125 } };
    expect(checks([post(wrongSide), rail()], placements)).toEqual(['mortise post', 'tenon rail']);
    const all = { ...mortise, room: { at: 'u0' as const, length: 2 } };
    expect(checks([post(all), rail()], placements)).toEqual([
      'within post',
      'mortise post',
      'tenon rail',
    ]);
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

  it('accepts a tongue in a groove cut into a face, and reports one too thick for it', () => {
    // The 3/4 part lies flat, 6 wide along y, its top face (far, z = 3/4) grooved end to end,
    // y 2-3/4 to 3, 3/8 deep. The 1/2 panel stands in it, centered (y 2-5/8 to 3-1/8), its
    // bottom edge 1/32 above the groove's bottom at z = 3/8.
    const faceGroove = {
      withPart: 'panel',
      face: 'far' as const,
      u0: 0,
      u1: 12,
      v0: 2.75,
      v1: 3,
      depth: 0.375,
    };
    const flat = part('frame', 12, 6, 0.75, { dadoes: [faceGroove] });
    const standing = [
      place('frame', at(0, 0, 0), X, Y, Z),
      place('panel', at(2, 3.125, 0.375 + 1 / 32), X, Z, minus(Y)),
    ];
    expect(checks([flat, panel(0.125)], standing)).toEqual([]);
    // A 3/8 tongue, y 2-11/16 to 3-1/16, is wider than the groove: neither holds the other.
    expect(checks([flat, panel(0.0625)], standing)).toEqual(['dado frame', 'tongue panel']);
  });

  it('accepts a panel whose tongues run on into the grooves of the parts across them', () => {
    // A box of 3/4 boards 4 wide along y: a bottom (z 0 to 3/4) and a top (z 8 to 8-3/4), 10
    // long, and sides between them, inner faces at x = 3/4 and 9-1/4. Each is grooved end to end
    // in its inner face, y 2-7/8 to 3-1/8, 3/8 deep. The 1/2 panel is 7-15/16 tall from z =
    // 13/32 and 9-1/8 wide from x = 7/16, rabbeted to a 1/4 tongue all round, so its left edge
    // runs from z = 13/32, in the bottom's groove, past the side's end at 3/4, into the side's.
    const groove = (u1: number, face: 'near' | 'far') => ({
      withPart: 'back',
      face,
      u0: 0,
      u1,
      v0: 2.875,
      v1: 3.125,
      depth: 0.375,
    });
    const box = (sideGroove = 7.25) => [
      part('bottom', 10, 4, 0.75, { dadoes: [groove(10, 'far')] }),
      part('top', 10, 4, 0.75, { dadoes: [groove(10, 'near')] }),
      part('left', 7.25, 4, 0.75, { dadoes: [groove(sideGroove, 'near')] }),
      part('right', 7.25, 4, 0.75, { dadoes: [groove(7.25, 'near')] }),
    ];
    const back = part('back', 7.9375, 9.125, 0.5, {
      rabbets: (['reference', 'far', 'first-end', 'second-end'] as const).flatMap((edge) =>
        (['near', 'far'] as const).map((face) => ({ edge, face, width: 0.375, depth: 0.125 })),
      ),
    });
    const placed = [
      place('bottom', at(0, 0, 0), X, Y, Z),
      place('top', at(0, 0, 8), X, Y, Z),
      place('left', at(0.75, 0, 0.75), Z, Y, minus(X)),
      place('right', at(9.25, 0, 8), minus(Z), Y, X),
      place('back', at(0.4375, 2.75, 0.40625), Z, X, Y),
    ];
    expect(checks([...box(), back], placed)).toEqual([]);
    // The left side's groove stopped 6 up, at z = 6-3/4: the tongue from there to the top's
    // groove at 8 lies in none.
    expect(checks([...box(6), back], placed)).toEqual(['tongue back']);
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

describe('dovetails', () => {
  // A drawer box's front corners. A front 12 long, 5-1/2 wide, 3/4 thick along x, its outside face
  // at y = 0 (n = 3/4, the far face) and its inside at y = 3/4, with pins at both ends cut 1/2 in.
  // Two sides 1/2 thick, 5-1/2 wide, running back along y from y = 0, at x 0 to 1/2 and 11-1/2 to
  // 12, with tails at their first ends cut 3/4 in. Each corner: 3 tails at 1:8 between 3/8 half
  // pins and 1/4 pins. Tails 4.25 / 3 = 1.41667 wide at the end, each wall moving 0.75 / 8 =
  // 0.09375 in by the baseline, as on both boards.
  const layout = { tails: 3, slope: 8, halfPin: 0.375, pin: 0.25 };
  const pins = (end: 0 | 1, over: Partial<Part['dovetails'][number]> = {}) =>
    ({
      board: 'pins',
      withPart: 'side',
      end,
      baseline: 0.5,
      outside: 'far',
      ...layout,
      ...over,
    }) as Part['dovetails'][number];
  const tails = (over: Partial<Part['dovetails'][number]> = {}) =>
    ({
      board: 'tails',
      withPart: 'front',
      end: 0,
      baseline: 0.75,
      ...layout,
      ...over,
    }) as Part['dovetails'][number];
  const front = (a = pins(0), b = pins(1)) => part('front', 12, 5.5, 0.75, { dovetails: [a, b] });
  const side = (d = tails()) => part('side', 18, 5.5, 0.5, { quantity: 2, dovetails: [d] });
  const placements = (sideX = 0) => [
    place('front', at(0, 0.75, 0), X, Z, minus(Y)),
    place('side', at(sideX, 0, 0), Y, Z, X, 0),
    place('side', at(11.5, 0, 0), Y, Z, X, 1),
  ];

  it('accepts tails and pins cut from one layout, each to the other board’s thickness', () => {
    expect(checks([front(), side()], placements())).toEqual([]);
  });

  it('reports pins narrow at the inside face, where the tails are narrowest', () => {
    expect(checks([front(pins(0, { outside: 'near' })), side()], placements())).toEqual([
      'dovetail front',
      'dovetail side',
    ]);
  });

  // Both sides share the part's tails, so a change to them misses at both corners.
  it('reports a baseline that is not the other board’s thickness', () => {
    expect(checks([front(), side(tails({ baseline: 0.5 }))], placements())).toEqual([
      'dovetail front',
      'dovetail front',
      'dovetail side',
      'dovetail side',
    ]);
    expect(checks([front(pins(0, { baseline: 0.75 })), side()], placements())).toEqual([
      'dovetail front',
      'dovetail side',
    ]);
  });

  it('reports tails sloped 1:6 against pins at 1:8, and one side set 1/16 off the end', () => {
    expect(checks([front(), side(tails({ slope: 6 }))], placements())).toEqual([
      'dovetail front',
      'dovetail front',
      'dovetail side',
      'dovetail side',
    ]);
    expect(checks([front(), side()], placements(1 / 16))).toEqual([
      'dovetail front',
      'dovetail side',
    ]);
  });

  it('reports pins with no tails, and tails that do not fit across the part', () => {
    expect(checks([front(), part('side', 18, 5.5, 0.5, { quantity: 2 })], placements())).toEqual([
      'dovetail front',
      'dovetail front',
    ]);
    // At 1:1 each wall moves 3/4 in, so a 1.41667 tail would end 1.5 narrower: below nothing.
    expect(checks([front(), side(tails({ slope: 1 }))], placements())).toEqual([
      'within side',
      'dovetail front',
      'dovetail front',
      'dovetail side',
      'dovetail side',
    ]);
  });
});

describe('dovetails over part of the width', () => {
  // A drawer's back corner, where the back is cut short. A side 18 long, 5 wide, 1/2 thick along
  // y, its width up z from z = 0, with tails at its first end over v 1 to 4, cut 3/4 in. A back 12
  // long, 3 wide, 3/4 thick along x, its outside face at y = 0 and its width up z from z = 1, with
  // pins across its whole width at its first end, cut 1/2 in. 2 tails at 1:8 between 3/8 half pins
  // and a 1/4 pin, across the 3 of the span: each (3 − 0.75 − 0.25) / 2 = 1 wide at the end, so
  // the walls are at v 1.375, 2.375, 2.625, 3.625 on the side and 0.375, 1.375, 1.625, 2.625 on
  // the back: z 1.375 to 3.625 on both.
  const layout = { tails: 2, slope: 8, halfPin: 0.375, pin: 0.25 };
  const span = (v0: number, v1: number) => ({ v0, v1 });
  const side = (s = span(1, 4)) =>
    part('side', 18, 5, 0.5, {
      dovetails: [{ board: 'tails', withPart: 'back', end: 0, baseline: 0.75, span: s, ...layout }],
    });
  const back = part('back', 12, 3, 0.75, {
    dovetails: [
      { board: 'pins', withPart: 'side', end: 0, baseline: 0.5, outside: 'far', ...layout },
    ],
  });
  const placements = (backZ: number) => [
    place('side', at(0, 0, 0), Y, Z, X),
    place('back', at(0, 0.75, backZ), X, Z, minus(Y)),
  ];

  it('accepts a 3-wide pin board placed across the tails’ span', () => {
    expect(checks([side(), back], placements(1))).toEqual([]);
  });

  it('reports the pin board placed at the side’s edge instead', () => {
    expect(checks([side(), back], placements(0))).toEqual(['dovetail side', 'dovetail back']);
  });

  it('reports a span that runs past the part', () => {
    const problems = fitProblems(
      { parts: [side(span(3, 6)), back], placements: placements(3) },
      [],
    );
    expect(problems.filter((p) => p.check === 'within').map((p) => p.message)).toEqual([
      "The dovetail tails on end 0 span 3 to 6 across the part's 5 width.",
    ]);
  });
});
