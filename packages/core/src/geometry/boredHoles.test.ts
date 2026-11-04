import { describe, expect, it } from 'vitest';
import { fitProblems } from '../fit/fit.ts';
import type { Inventory } from '../inventory/tools.ts';
import { ROUND_HOLDING_HOLE } from '../knowledge/holes.ts';
import { cutAndDrillOperations, treatmentOperations } from '../model/operations.ts';
import type { BoredHole, Part } from '../model/types.ts';
import { selectMethod } from '../steps/select.ts';
import { cutDetail } from './cutDetail.ts';

// Bored holes on made-up parts, hand-checked in inches.
//
// A top 2x12 (1-1/2" × 11-1/4"), 48" long, with a row of three 3/4" holes for hold-downs bored
// through from the face shown, 2" from the reference edge, at 12", 24", and 36". A frame member
// of 1x4 (3/4" × 3-1/2"), 20" long, with two hinge cups 1-3/8" across and 1/2" deep in its back
// face, 7/8" from the reference edge, 3" from each end.

const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };
const base = {
  quantity: 1,
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
  screwHoles: [],
  grooves: [],
  rabbets: [],
  recesses: [],
  boredHoles: [],
};
const down = { u: 0, v: 0, n: -1 };
const up = { u: 0, v: 0, n: 1 };
const holdingHole = (u: number): BoredHole => ({
  use: 'for a hold-down',
  diameter: 0.75,
  entry: { u, v: 2, n: 1.5 },
  direction: down,
  depth: 1.5,
  through: true,
});
const top: Part = {
  ...base,
  id: 'top',
  letter: 'A',
  name: 'Top',
  role: 'top',
  stock: { nominal: '2x12', thickness: 1.5, width: 11.25, buyableFeet: [8] },
  length: 48,
  referenceEdge: 'front edge',
  boredHoles: [12, 24, 36].map(holdingHole),
};
const cup = (u: number): BoredHole => ({
  use: 'for a hinge cup',
  diameter: 1.375,
  entry: { u, v: 0.875, n: 0 },
  direction: up,
  depth: 0.5,
  through: false,
});
const member: Part = {
  ...base,
  id: 'member',
  letter: 'B',
  name: 'Member',
  role: 'member',
  quantity: 2,
  stock: { nominal: '1x4', thickness: 0.75, width: 3.5, buyableFeet: [8] },
  length: 20,
  referenceEdge: 'outside edge',
  boredHoles: [cup(3), cup(17)],
};

const atOrigin = (partId: string, instance = 0) => ({
  partId,
  instance,
  origin: { x: 0, y: 0, z: 0 },
  along: { x: 1, y: 0, z: 0 },
  across: { x: 0, y: 1, z: 0 },
  through: { x: 0, y: 0, z: 1 },
});
const problems = (part: Part) =>
  fitProblems({ parts: [part], placements: [atOrigin(part.id)] }).map((p) => p.message);

describe('bored holes', () => {
  it('become one operation for each size, through or stopped', () => {
    const ops = cutAndDrillOperations([top, member], []);
    // The top's holes are 2" from the front edge, 9-1/4" from the back, and at least 12" from an
    // end: 2" is the farthest any is from its nearest edge.
    expect(ops.filter((o) => o.type === 'bore')).toEqual([
      {
        id: 'top/bore-0',
        type: 'bore',
        partId: 'top',
        count: 3,
        holes: [0, 1, 2],
        diameter: 0.75,
        depth: 1.5,
        fromEdge: 2,
      },
    ]);
    // Two cups on each of two pieces: 4. Each is 7/8" from the outside edge, 2-5/8" from the
    // inside edge (3-1/2 − 7/8), and 3" from its end.
    expect(ops.filter((o) => o.type === 'stopped-bore')).toEqual([
      {
        id: 'member/bore-0',
        type: 'stopped-bore',
        partId: 'member',
        count: 4,
        holes: [0, 1],
        diameter: 1.375,
        depth: 0.5,
        fromEdge: 0.875,
      },
    ]);
  });

  it('count as cuts to treat in treated lumber', () => {
    const treated = { ...top, treated: true as const };
    const ops = treatmentOperations([treated], []);
    // Two ends and three holes.
    expect(ops).toMatchObject([{ type: 'treat-cuts', cuts: 5 }]);
  });

  it('are drawn and noted on the cut detail', () => {
    const detail = cutDetail(top);
    expect(detail.notes).toContain(
      'Bore 3 3/4" holes for a hold-down, through, into the face shown, 2" from the front edge, at 12", 24", 36" from the first end.',
    );
    const circles = detail.primitives.filter((p) => p.kind === 'circle');
    expect(circles).toHaveLength(3);
    expect(circles.every((c) => c.role === 'visible')).toBe(true);
    expect(circles.map((c) => (c.kind === 'circle' ? c.center : null))).toEqual([
      { x: 12, y: -2 },
      { x: 24, y: -2 },
      { x: 36, y: -2 },
    ]);

    // Stopped in the back face: dashed, and the note says so.
    const cups = cutDetail(member);
    expect(cups.notes).toContain(
      'Bore 2 1-3/8" holes for a hinge cup, 1/2" deep, into the back face (dashed), 7/8" from the outside edge, at 3", 17" from the first end.',
    );
    const dashed = cups.primitives.filter((p) => p.kind === 'circle' && p.role === 'hidden');
    expect(dashed).toHaveLength(2);
    expect(cups.description).toContain('2 bored holes');
  });

  it('draw a hole into an edge as hidden lines as deep as it goes', () => {
    // A 1/2" hole 1" deep into the far edge of the 1x4, at 10", halfway through its thickness.
    const edge: Part = {
      ...member,
      boredHoles: [
        {
          use: 'for a peg',
          diameter: 0.5,
          entry: { u: 10, v: 3.5, n: 0.375 },
          direction: { u: 0, v: -1, n: 0 },
          depth: 1,
          through: false,
        },
      ],
    };
    const detail = cutDetail(edge);
    const hidden = detail.primitives.filter((p) => p.kind === 'line' && p.role === 'hidden');
    // Two sides and the flat bottom, at v = 2-1/2 (page y = −2-1/2).
    expect(hidden).toHaveLength(3);
    expect(hidden[2]).toMatchObject({
      points: [
        { x: 10.25, y: -2.5 },
        { x: 9.75, y: -2.5 },
      ],
    });
    expect(detail.notes).toContain(
      'Bore one 1/2" hole for a peg, 1" deep, into the far edge, 3/8" from the back face, at 10" from the first end.',
    );
    expect(problems(edge)).toEqual([]);
  });

  it('are bored on a drill press that reaches them, or with a drill otherwise', () => {
    const ops = cutAndDrillOperations([top, member], []);
    const bore = ops.find((o) => o.type === 'bore');
    const stopped = ops.find((o) => o.type === 'stopped-bore');
    if (!bore || !stopped) throw new Error('no bore operations');
    const kit = (...tools: [string, Record<string, number>][]): Inventory => ({
      tools: [['tape-measure', {}], ['combination-square', {}], ['clamps', {}], ...tools].map(
        ([toolTypeId, capabilities]) => ({
          toolTypeId: toolTypeId as string,
          capabilities: capabilities as Record<string, number>,
        }),
      ),
    });
    const press = (throat: number) =>
      ['drill-press', { throat, quillTravel: 3 }] as [string, Record<string, number>];
    const forstner: [string, Record<string, number>] = ['forstner-bits', { reach: 2 }];
    const auger: [string, Record<string, number>] = ['auger-bits', { reach: 6 }];
    const drill: [string, Record<string, number>] = ['drill-driver', {}];
    // A press with 4" from column to bit reaches 2" in.
    expect(selectMethod(bore, kit(press(4), forstner, drill)).chosen?.id).toBe('bore-drill-press');
    // One with 1-1/2" does not, so the hand drill and an auger bit bore them.
    expect(selectMethod(bore, kit(press(1.5), forstner, drill, auger)).chosen?.id).toBe(
      'bore-drill-one-side',
    );
    // Auger bits reaching 1" bore the 1-1/2" from both sides, each past halfway.
    expect(selectMethod(bore, kit(drill, ['auger-bits', { reach: 1 }])).chosen?.id).toBe(
      'bore-drill-both-sides',
    );
    // A stopped hole needs a flat-bottomed bit: an auger's screw tip would go deeper.
    expect(selectMethod(stopped, kit(drill, auger)).chosen).toBeUndefined();
    expect(selectMethod(stopped, kit(drill, forstner)).chosen?.id).toBe('stopped-bore-drill');
    expect(selectMethod(stopped, kit(press(4), forstner)).chosen?.id).toBe(
      'stopped-bore-drill-press',
    );
  });
});

describe('fit of bored holes within their part', () => {
  it('passes holes inside the wood, through or stopped as they say', () => {
    expect(problems(top)).toEqual([]);
    expect(problems(member)).toEqual([]);
  });

  it('reports a through hole that stops short, and a stopped one that comes out', () => {
    const short = { ...top, boredHoles: [{ ...holdingHole(12), depth: 1 }] };
    expect(problems(short)).toEqual([
      'A 0.75 hole for a hold-down at u 12, v 2, n 1.5 is through, but its 1 stops inside the part.',
    ]);
    // A cup 3/4" deep in 3/4" stock comes out the face shown.
    const deep = { ...member, boredHoles: [{ ...cup(3), depth: 0.75 }] };
    expect(problems(deep)).toEqual([
      'A 1.375 hole for a hinge cup at u 3, v 0.875, n 0 is stopped, but its 0.75 comes out the far side.',
    ]);
    // 7/8" deep runs past the far face.
    const past = { ...member, boredHoles: [{ ...cup(3), depth: 0.875 }] };
    expect(problems(past)).toEqual([
      'A 1.375 hole for a hinge cup at u 3, v 0.875, n 0 runs past the part.',
    ]);
  });

  it('reports a hole whose rim runs past an edge or end', () => {
    // 3/4" across, centered 1/4" from the front edge: the rim reaches 1/8" past it.
    const off = { ...top, boredHoles: [{ ...holdingHole(12), entry: { u: 12, v: 0.25, n: 1.5 } }] };
    expect(problems(off)).toEqual([
      'A 0.75 hole for a hold-down at u 12, v 0.25, n 1.5 runs past the part.',
    ]);
    // Centered 1/4" from the second end of the 48" top.
    const end = { ...top, boredHoles: [holdingHole(47.75)] };
    expect(problems(end)).toHaveLength(1);
  });

  it('reports a hole that does not start on the side it is bored into', () => {
    // Bored downward from n = 1, inside the 1-1/2" top rather than on its face.
    const inside = {
      ...top,
      boredHoles: [{ ...holdingHole(12), entry: { u: 12, v: 2, n: 1 }, depth: 1 }],
    };
    expect(problems(inside)).toEqual([
      'A 0.75 hole for a hold-down at u 12, v 2, n 1 does not start on the side it is bored into.',
    ]);
  });
});

describe('the round hole for hold-downs', () => {
  it('is 3/4", suggested from its source, for the owner to check', () => {
    expect(ROUND_HOLDING_HOLE.diameter).toBe(0.75);
    expect(ROUND_HOLDING_HOLE.basis.kind).toBe('source');
    expect(ROUND_HOLDING_HOLE.citation.source).toBe('popular-woodworking-round-holes-2010');
  });
});
