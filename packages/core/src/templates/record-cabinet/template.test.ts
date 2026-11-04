import { describe, expect, it } from 'vitest';
import { solid } from '../../geometry/solid.ts';
import { cross, dot, sub, unit } from '../../geometry/vec.ts';
import { isPanel } from '../../lumber/partStock.ts';
import type { Part, Placement, Vec3 } from '../../model/types.ts';
import { createSnapshot } from '../../snapshot/snapshot.ts';
import { recordCabinet } from './definition.ts';
import { EXAMPLES, WORKED_EXAMPLE } from './examples.ts';
import type { RecordCabinetOutputs } from './outputs.ts';
import type { RecordCabinetParams } from './params.ts';

// docs/templates/record-cabinet.md: every number here is from the spec's hand-checked worked
// examples (Worked example, Edge of range, Structural model, The Shaker-modern base, Sliding doors
// on the end bays). With the doors, the worked example's case is 17" deep.

function made(index: number): RecordCabinetOutputs {
  const example = EXAMPLES[index];
  if (!example) throw new Error(`no example ${index}`);
  const result = recordCabinet.generate(example.params, example.structuralInputs);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.output;
}

const worked = made(0);
const edge = made(2);
const part = (o: RecordCabinetOutputs, id: string): Part => {
  const found = o.design.parts.find((p) => p.id === id);
  if (!found) throw new Error(`no part ${id}`);
  return found;
};
const placed = (o: RecordCabinetOutputs, id: string, instance = 0): Placement => {
  const pl = o.design.placements.find((x) => x.partId === id && x.instance === instance);
  if (!pl) throw new Error(`${id}/${instance} is not placed`);
  return pl;
};
/** A point in a part's frame, in the cabinet's coordinates. */
const world = (pl: Placement, u: number, v: number, n: number): Vec3 => ({
  x: pl.origin.x + pl.along.x * u + pl.across.x * v + pl.through.x * n,
  y: pl.origin.y + pl.along.y * u + pl.across.y * v + pl.through.y * n,
  z: pl.origin.z + pl.along.z * u + pl.across.z * v + pl.through.z * n,
});

describe('the worked example (spec, Worked example and The Shaker-modern base)', () => {
  const g = worked.design.geometry;

  it('derives the case, bays, base, and heights', () => {
    expect([g.caseWidth, g.clearWidth, g.bayWidth]).toEqual([52.5, 51, 16.5]);
    expect(g.panelX).toEqual([0.75, 18, 35.25, 52.5]);
    expect(g.topDepth).toBe(17.75);
    // 5 + 2-1/2 = 7-1/2 to the case bottom; + 3/4 + 13-1/4 + 3/4 = 22-1/4 to the top.
    expect([g.baseHeight, g.height]).toEqual([7.5, 22.25]);
    // 13-1/4 + 2 × 3/16 between the dadoes' bottoms; 16-1/2 + 2 × 3/16 for a rail.
    expect([g.panelLength, g.railLength, g.partitionLeft]).toEqual([13.625, 16.875, 0.375]);
    // 52-1/2 − 2 × 1-1/2 + 2 × 1 = 51-1/2; 17 − 3 + 2 = 16; 17 − 3 = 14.
    expect([g.legLength, g.longApron, g.shortApron, g.cleatLength]).toEqual([7.5, 51.5, 16, 14]);
  });

  it('lists the parts in cut-list order, the legs from leg stock', () => {
    expect(worked.cutList.map((r) => [r.letter, r.name, r.quantity, r.length])).toEqual([
      ['A', 'Top', 1, '54"'],
      ['B', 'Case bottom', 1, '52-1/2"'],
      ['C', 'Left side', 1, '13-5/8"'],
      ['D', 'Right side', 1, '13-5/8"'],
      ['E', 'Partition', 2, '13-5/8"'],
      ['F', 'Back rail', 3, '16-7/8"'],
      ['G', 'Leg', 4, '7-1/2"'],
      ['H', 'Front and back apron', 2, '51-1/2"'],
      ['I', 'Side apron', 2, '16"'],
      ['J', 'Cleat', 2, '14"'],
      ['K', 'Outer stile', 2, '13-3/4"'],
      ['L', 'Inner stile', 2, '13-3/4"'],
      ['M', 'Door rail', 4, '14-1/2"'],
      ['N', 'Door panel', 2, '10-7/16"'],
    ]);
    expect(worked.cutList.map((r) => r.stock)).toEqual([
      'Panel (3/4" x 17-3/4")',
      'Panel (3/4" x 17")',
      'Panel (3/4" x 17")',
      'Panel (3/4" x 17")',
      'Panel (3/4" x 14-1/2")',
      // One board, not flattened, keeps the 13/16" board's thickness.
      'Board (13/16" x 3")',
      '1-1/2" x 1-1/2"',
      'Board (13/16" x 2-1/2")',
      'Board (13/16" x 2-1/2")',
      'Board (13/16" x 1")',
      'Board (13/16" x 2")',
      'Board (13/16" x 2")',
      'Board (13/16" x 2")',
      'Panel (3/4" x 14-5/16")',
    ]);
  });

  it('glues the top and case bottom from four boards each', () => {
    // ⌈(17-3/4 + 3/8) / 5-3/8⌉ = ⌈3.37⌉ = 4, and ⌈(17 + 3/8) / 5-3/8⌉ = ⌈3.23⌉ = 4.
    for (const id of ['top', 'bottom']) {
      const s = part(worked, id).stock;
      expect(isPanel(s) && s.boards).toBe(4);
    }
  });

  it('houses the sides and partitions in stopped dadoes in the top and case bottom', () => {
    // Top: from o_f + s_d = 1-1/4 to its back edge, at each panel's x. Case bottom: from s_d to
    // the back, at each panel's x less o_s, so the sides' are rabbets at its ends. The
    // partitions' start behind the tracks, d_t = 2-1/2 farther back.
    const housings = (id: string) =>
      part(worked, id).dadoes.filter((d) => d.withPart !== 'door-rail');
    expect(housings('top').map((d) => [d.face, d.u0, d.v0, d.v1])).toEqual([
      ['near', 0.75, 1.25, 17.75],
      ['near', 18, 3.75, 17.75],
      ['near', 35.25, 3.75, 17.75],
      ['near', 52.5, 1.25, 17.75],
    ]);
    expect(housings('bottom').map((d) => [d.face, d.u0, d.u1, d.v0])).toEqual([
      ['far', 0, 0.75, 0.5],
      ['far', 17.25, 18, 3],
      ['far', 34.5, 35.25, 3],
      ['far', 51.75, 52.5, 0.5],
    ]);
    const ops = worked.design.operations.filter((o) => 'partId' in o && o.partId === 'bottom');
    expect(
      ops.map((o) => o.type).filter((t) => t.includes('dado') || t.includes('rabbet')),
    ).toEqual([
      'stopped-rabbet',
      'stopped-dado',
      'stopped-dado',
      'stopped-rabbet',
      'double-stopped-dado',
      'double-stopped-dado',
    ]);
    // Each side and partition is notched at both front corners to fit them.
    expect(part(worked, 'side-left').notches).toEqual([
      { end: 0, edge: 'reference', along: 0.1875, across: 0.5 },
      { end: 1, edge: 'reference', along: 0.1875, across: 0.5 },
    ]);
  });

  it('tapers each leg on its two inside faces to a 1" foot, and mortises them for the aprons', () => {
    const leg = part(worked, 'leg');
    expect(leg.tapers.map((t) => [t.start, t.end, t.plane ?? 'width'])).toEqual([
      [{ u: 5, v: 0 }, { u: 0, v: 0.5 }, 'width'],
      [{ u: 5, v: 0 }, { u: 0, v: 0.5 }, 'thickness'],
    ]);
    // Tenons 2" wide from 1/4" above the apron's bottom edge at h_l = 5, 1/4" thick, centered in
    // the 13/16" apron set back 1/8": 1-1/2 − 1/8 − 13/16 + 9/32 = 27/32 from the inside face.
    expect(leg.mortises?.map((m) => [m.side, m.u0, m.u1, m.a0, m.a1, m.depth])).toEqual([
      ['near', 5.25, 7.25, 0.84375, 1.09375, 1],
      ['reference-edge', 5.25, 7.25, 0.84375, 1.09375, 1],
    ]);
    expect(part(worked, 'apron-long').tenons?.[0]).toEqual({
      end: 0,
      length: 1,
      n0: 0.28125,
      thickness: 0.25,
      v0: 0.25,
      width: 2,
    });
  });

  it('slots the cleats by the case bottom’s movement: 17 × 0.00248 × 4 + 1/16 = 0.2311"', () => {
    const holes = part(worked, 'cleat').screwHoles ?? [];
    expect(holes.map((h) => h.u)).toEqual([1, 7, 13]);
    expect(holes[0]?.slot).toBe(0);
    for (const h of holes.slice(1)) expect(h.slot).toBeCloseTo(17 * 0.00248 * 4 + 0.0625, 12);
  });

  it('sizes the slots for the species that moves most when none is entered', () => {
    // White oak's C_T, 0.00376, the largest in Kerf's list: 17 × 0.00376 × 4 + 1/16 = 0.318".
    const none = made(1);
    const slot = part(none, 'cleat').screwHoles?.[1]?.slot;
    expect(slot).toBeCloseTo(17 * 0.00376 * 4 + 0.0625, 12);
    expect(part(none, 'cleat').notes.join(' ')).toContain('since the species and moisture');
  });
});

describe('fit (spec, Placements)', () => {
  const p = WORKED_EXAMPLE;
  const g = worked.design.geometry;

  it('stands every side and partition in the case bottom’s dadoes, its top end in the top’s', () => {
    for (const pl of worked.design.placements.filter(
      (x) => x.partId.startsWith('side') || x.partId === 'partition',
    )) {
      // From z_b + t − j = 8-1/16 to H − t + j = 21-11/16.
      expect(pl.origin.z).toBe(g.baseHeight + p.panelThickness - p.dadoDepth);
      expect(pl.origin.z + g.panelLength).toBe(g.height - p.panelThickness + p.dadoDepth);
    }
  });

  it('puts the legs’ outside faces flush with the case’s corners', () => {
    const corners = [0, 1, 2, 3].map((i) => {
      const pl = placed(worked, 'leg', i);
      // The outside corner is at v = s and n = s, at the floor.
      const c = world(pl, 0, 1.5, 1.5);
      return [c.x, c.y, c.z];
    });
    expect(corners).toEqual([
      [0.75, 0, 0],
      [53.25, 0, 0],
      [0.75, 17, 0],
      [53.25, 17, 0],
    ]);
  });

  it('sets each apron’s tenon into its leg’s mortise', () => {
    // The front apron's first tenon: from its end to its shoulder, in the front-left leg.
    const apron = placed(worked, 'apron-long', 0);
    const tip = world(apron, 0, 0.25, 0.28125);
    const shoulder = world(apron, 1, 0.25, 0.28125);
    expect([tip.x, shoulder.x]).toEqual([1.25, 2.25]);
    // The leg's inside face is at x = o_s + s = 2.25, so the tenon goes 1" into it.
    expect(world(placed(worked, 'leg', 0), 0, 0, 0).x).toBe(2.25);
    expect(tip.z).toBe(5.25);
  });

  it('lays each cleat flush with the side aprons’ tops, under the case bottom', () => {
    for (const i of [0, 1]) {
      const pl = placed(worked, 'cleat', i);
      const top = Math.max(world(pl, 0, 0, 0).z, world(pl, 0, 0, 0.8125).z);
      expect(top).toBeCloseTo(g.baseHeight, 12);
    }
  });
});

describe('sliding doors (spec, Sliding doors on the end bays)', () => {
  const p = WORKED_EXAMPLE;
  const g = worked.design.geometry;
  const door = g.door;
  if (!door) throw new Error('the worked example has doors');

  it('derives the tracks, the doors, and the panels', () => {
    // Tracks 13/16 + 1/16 = 7/8; the zone 3 × 1/4 + 2 × 7/8 = 2-1/2; partitions 17 − 2-1/2.
    expect([door.thickness, door.trackWidth, door.trackZone, door.partitionDepth]).toEqual([
      0.8125, 0.875, 2.5, 14.5,
    ]);
    // 13-1/4 + 2 × 1/4 high; 16-1/2 + 3/4 + 1/2 wide; rails 17-3/4 − 2 × 2 + 2 × 3/8.
    expect([door.height, door.width, door.railLength]).toEqual([13.75, 17.75, 14.5]);
    // Across the grain 13-3/4 + 2 × 3/8 = 14-1/2; along it 9-3/4 + 2 × 3/8 − 2 × 1/32.
    expect([door.panelSpan, door.panelLength]).toEqual([14.5, 10.4375]);
  });

  it('cuts each panel 0.103 narrow at each edge: 14.5 × 0.00248 × 4 / 2 + 1/32', () => {
    const gap = (14.5 * 0.00248 * 4) / 2 + 1 / 32;
    const panel = part(worked, 'door-panel');
    expect(panel.stock.width).toBeCloseTo(14.5 - 2 * gap, 12);
    expect(panel.stock.width).toBeCloseTo(14.2937, 4);
    // A tongue 1/4 thick, centered in the 3/4 panel, 3/8 long at every edge.
    expect(new Set(panel.rabbets?.map((r) => `${r.width} ${r.depth}`))).toEqual(
      new Set(['0.375 0.25']),
    );
    expect(panel.rabbets).toHaveLength(8);
  });

  it('routs each track between the sides, 1/4 deep in the case bottom and 9/16 in the top', () => {
    const tracks = (id: string) =>
      part(worked, id)
        .dadoes.filter((d) => d.withPart === 'door-rail')
        .map((d) => [d.face, d.u0, d.u1, d.v0, d.v1, d.depth]);
    expect(tracks('bottom')).toEqual([
      ['far', 0.75, 51.75, 0.25, 1.125, 0.25],
      ['far', 0.75, 51.75, 1.375, 2.25, 0.25],
    ]);
    // The top's are o_f = 3/4 farther back, and between x = 1-1/2 and 52-1/2.
    expect(tracks('top')).toEqual([
      ['near', 1.5, 52.5, 1, 1.875, 0.5625],
      ['near', 1.5, 52.5, 2.125, 3, 0.5625],
    ]);
  });

  it('seats each door 1/4 in its bottom track and 1/4 up into its top track, with 5/16 to lift', () => {
    // The case bottom's top face is at 7-1/2 + 3/4 = 8-1/4; the top's underside at 21-1/2.
    for (const k of [0, 1]) {
      const stile = placed(worked, 'door-stile-inner', k);
      const bottom = world(stile, 0, 0, 0).z;
      const top = world(stile, door.height, 0, 0).z;
      expect([bottom, top]).toEqual([8, 21.75]);
      // Lifted into the 9/16 top track, it rises 21-1/2 + 9/16 − 21-3/4 = 5/16, more than the
      // 1/4 it sits in the bottom track.
      expect(21.5 + p.door.topDepth - top).toBe(0.3125);
    }
  });

  it('runs the left door in the front track and the right in the back, each past its partition', () => {
    const left = placed(worked, 'door-stile-outer', 0);
    const right = placed(worked, 'door-stile-outer', 1);
    // Each centered in its 7/8 track, 1/32 from each wall: its far face is the front.
    expect(world(left, 0, 0, 0.8125).y).toBe(0.28125);
    expect(world(right, 0, 0, 0.8125).y).toBe(1.40625);
    // Closed, each is against its side, and runs 1/2 past its partition's far face.
    expect(world(left, 0, 0, 0).x).toBe(1.5);
    expect(world(placed(worked, 'door-stile-inner', 0), 0, 0, 0).x).toBe(18.75 + 0.5);
    expect(world(right, 0, 0, 0).x).toBe(52.5);
    expect(world(placed(worked, 'door-stile-inner', 1), 0, 0, 0).x).toBe(35.25 - 0.5);
    // The recess is in each outer stile's front face, its far face, centered on it.
    expect(part(worked, 'door-stile-outer').recesses).toEqual([
      // 3 up and down the stile, 3/4 across it.
      { face: 'far', u: 6.875, v: 1, width: 3, height: 0.75, depth: 0.25 },
    ]);
    for (const pl of [left, right]) expect(pl.through).toEqual({ x: 0, y: -1, z: 0 });
  });

  it('sets the rails’ stub tenons in the stiles’ grooves, and the panel in both', () => {
    // The left door's bottom rail: its first tenon's end at the outer stile's groove bottom,
    // 2 − 3/8 = 1-5/8 in from the door's edge at 1-1/2.
    const rail = placed(worked, 'door-rail', 0);
    expect(world(rail, 0, 0, 0).x).toBe(1.5 + 2 - 0.375);
    expect(world(rail, door.railLength, 0, 0).x).toBe(19.25 - 2 + 0.375);
    // The panel's edges stand 0.103 off the groove bottoms across its grain, 1/32 along it.
    const panel = placed(worked, 'door-panel', 0);
    const width = part(worked, 'door-panel').stock.width;
    const gap = (14.5 * 0.00248 * 4) / 2 + 1 / 32;
    expect(world(panel, 0, 0, 0).x).toBeCloseTo(3.125 + gap, 12);
    expect(world(panel, 0, width, 0).x).toBeCloseTo(3.125 + 14.5 - gap, 12);
    expect(world(panel, 0, 0, 0).z).toBe(8 + 2 - 0.375 + 1 / 32);
    // Centered in the door's thickness: (13/16 − 3/4) / 2 behind its front face.
    expect(world(panel, 0, 0, 0).y).toBe(0.28125 + 0.03125);
  });

  it('stands the partitions behind the tracks, with 13-11/16 of bay behind them for records', () => {
    expect(placed(worked, 'partition').origin.y).toBe(2.5);
    // 17 − 2-1/2 − 13/16 = 13-11/16, more than a 12-3/8 jacket.
    expect(door.partitionDepth - part(worked, 'rail').stock.thickness).toBe(13.6875);
  });

  it('rabbets a one-board panel from its own thickness, to a tongue as thick as the groove', () => {
    // A 42" case of 1" x 11-1/4" boards: bays (42 − 4 × 3/4 − 2 × 3/4) / 3 = 12-1/2, doors
    // 12-1/2 + 3/4 + 1/2 = 13-3/4 wide, the panel span 13-3/4 − 2 × 2 + 2 × 3/8 = 10-1/2, and the
    // panel 10.5 − 2 × (10.5 × 0.00248 × 4 / 2 + 1/32) = 10-1/3 wide, under the board's 11-1/8
    // after jointing: one board, not flattened, so 1" thick against t = 3/4.
    const board = { source: 'store' as const, thickness: 1, width: 11.25, lengths: [4, 6, 8] };
    const result = recordCabinet.generate(
      { ...p, width: 42, board },
      EXAMPLES[0]?.structuralInputs ?? {},
    );
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    const one = result.output;
    const panel = part(one, 'door-panel');
    expect(panel.stock.width).toBeCloseTo(10.5 - 2 * ((10.5 * 0.00248 * 4) / 2 + 1 / 32), 12);
    expect(panel.stock.thickness).toBe(1);
    // (1 − 1/4) / 2 = 3/8 on each face, not (3/4 − 1/4) / 2 = 1/4, which left a 1/2 tongue.
    expect(new Set(panel.rabbets?.map((r) => `${r.width} ${r.depth}`))).toEqual(
      new Set(['0.375 0.375']),
    );
    expect(1 - 2 * 0.375).toBe(p.tenonThickness);
    // The frame is the same 1" board, so the panel is flush with the door's front face, at
    // 1/4 + 1/32, not 1/8 behind it.
    expect(world(placed(one, 'door-stile-outer', 0), 0, 0, 1).y).toBe(0.28125);
    expect(world(placed(one, 'door-panel', 0), 0, 0, 0).y).toBe(0.28125);
  });

  it('has no doors and full-depth partitions in the edge of range', () => {
    expect(edge.design.geometry.door).toBeUndefined();
    expect(edge.design.parts.filter((x) => x.id.startsWith('door'))).toEqual([]);
    expect(part(edge, 'partition').stock.width).toBe(13);
  });
});

describe('the edge of the range (spec, Edge of range)', () => {
  const g = edge.design.geometry;

  it('derives a two-bay case with 1" panels on 1-3/4" legs', () => {
    expect([g.caseWidth, g.clearWidth, g.bayWidth]).toEqual([28, 26, 12.5]);
    // 3 + 2 + 1 + 15 + 1 = 22.
    expect([g.topDepth, g.bayHeight, g.panelLength, g.height]).toEqual([14, 15, 15.5, 22]);
  });
});

describe('refusals (spec, Validation)', () => {
  const refused = (over: Partial<RecordCabinetParams>) => {
    const result = recordCabinet.generate({ ...WORKED_EXAMPLE, ...over }, {});
    return result.ok ? [] : result.issues.map((i) => i.code);
  };

  it('refuses a bay lower than a record and dadoes that meet', () => {
    expect(refused({ jacket: 13.5 })).toEqual(['bay-too-low']);
    expect(refused({ dadoDepth: 0.375 })).toEqual(['dadoes-meet']);
  });

  it('refuses a leg with no taper, a tenon through the leg, and an apron off the leg', () => {
    expect(refused({ footSize: 1.5 })).toEqual(['foot-not-tapered']);
    expect(refused({ tenonLength: 1.5 })).toEqual(['tenon-too-long']);
    expect(refused({ apronSetback: 1.25 })).toEqual(['apron-off-leg']);
  });

  it('refuses aprons that put the mortises outside the leg', () => {
    const board = (thickness: number) => ({ ...WORKED_EXAMPLE.board, thickness });
    // #561, draw 31: the mortise starts 1.0625 − 0.8125 − (1.1873 + 0.1875)/2 = −0.437 from the
    // leg's inside face and ends at −0.250, entirely outside the leg.
    const outside = {
      legStock: { size: 1.0625, lengths: [3] },
      footSize: 0.6875,
      apronSetback: 0.8125,
      board: board(1.1873),
      tenonThickness: 0.1875,
    };
    expect(refused(outside)).toEqual(['mortise-off-leg']);
    const result = recordCabinet.generate({ ...WORKED_EXAMPLE, ...outside }, {});
    expect(result.ok ? [] : result.issues[0]?.message).toBe(
      `Aprons 1-3/16" thick, set back 13/16" on 1-1/16" legs, would put each mortise past the leg's inside face. To fix it, use legs larger than 1-1/2", or set the aprons back less than 3/8", or use thinner boards.`,
    );
    // #561, draw 25: 1.1875 − 0.5625 − (1.25 + 0.25)/2 = −0.125 to 0.125, half outside.
    const half = {
      legStock: { size: 1.1875, lengths: [3] },
      footSize: 0.75,
      apronSetback: 0.5625,
      board: board(1.25),
    };
    expect(refused(half)).toEqual(['mortise-off-leg']);
    // A mortise whose wall is flush with the inside face is open there: 1.1875 − 0.4375 − 0.75 = 0.
    expect(refused({ ...half, apronSetback: 0.4375 })).toEqual(['mortise-off-leg']);
  });

  it("refuses aprons that stand past the leg's inside face", () => {
    const legs = { legStock: { size: 1.1875, lengths: [3] }, footSize: 0.75 };
    // 13/16 aprons on 1-3/16 legs: 3/8 + 13/16 = 1-3/16 is flush with the inside face.
    expect(refused({ ...legs, apronSetback: 0.375 })).toEqual([]);
    expect(refused({ ...legs, apronSetback: 0.4375 })).toEqual(['apron-past-leg']);
    // #561, draw 25 with the mortise back in the leg: 3/8 + 1-1/4 = 1-5/8, past the 1-3/16 leg.
    const result = recordCabinet.generate(
      {
        ...WORKED_EXAMPLE,
        ...legs,
        apronSetback: 0.375,
        board: { ...WORKED_EXAMPLE.board, thickness: 1.25 },
      },
      {},
    );
    expect(result.ok ? [] : result.issues.map((i) => i.message)).toEqual([
      `Aprons 1-1/4" thick, set back 3/8" on 1-3/16" legs, would stand past the leg's inside face, where the two aprons at each leg would run into each other. To fix it, use legs at least 1-5/8", or use thinner boards.`,
    ]);
  });

  it('refuses a largest item wider than the 54" top or deeper than its 17-3/4"', () => {
    const item = WORKED_EXAMPLE.topItem;
    expect(refused({ topItem: { ...item, width: 54.0625 } })).toEqual(['top-item-too-wide']);
    expect(refused({ topItem: { ...item, depth: 17.8125 } })).toEqual(['top-item-too-deep']);
    expect(refused({ topItem: { ...item, width: 54, depth: 17.75 } })).toEqual([]);
  });

  it('refuses doors that leave no room for records, cannot lift in, or have no tongue', () => {
    const door = WORKED_EXAMPLE.door;
    // 15 − 2-1/2 − 13/16 = 11-11/16 behind the tracks, less than a 12-3/8 jacket.
    expect(refused({ caseDepth: 15 })).toEqual(['records-behind-tracks']);
    expect(refused({ caseDepth: 15, doors: 'none' })).toEqual([]);
    // Seated 1/4 in the bottom, a door needs a top track at least 1/2 deep to lift out of it.
    expect(refused({ door: { ...door, topDepth: 0.4375 } })).toEqual(['door-cannot-lift']);
    expect(refused({ door: { ...door, topDepth: 0.5 } })).toEqual([]);
    expect(refused({ tenonThickness: 0.75 })).toEqual(['panel-no-tongue']);
    // A 1-1/2 stile with 1/2 grooves: the recess, 3/8 each side of 3/4, overlaps the groove from
    // 1, and a 3/8 groove leaves (13/16 − 3/8)/2 = 7/32 above it, less than the 1/4 recess.
    expect(
      refused({ door: { ...door, frameWidth: 1.5, grooveDepth: 0.5 }, tenonThickness: 0.375 }),
    ).toEqual(['recess-into-groove']);
  });

  it('refuses a top track as deep as the top is thick (#574)', () => {
    const door = (topDepth: number, bottomDepth = 0.25) => ({
      ...WORKED_EXAMPLE.door,
      topDepth,
      bottomDepth,
    });
    // t = 3/4: a 3/4 track cuts through, and 11/16 leaves 1/16.
    expect(refused({ door: door(0.75) })).toEqual(['track-through-top']);
    expect(refused({ door: door(0.6875) })).toEqual([]);
    expect(refused({ door: door(0.75), doors: 'none' })).toEqual([]);
    const issue = (over: Partial<RecordCabinetParams>) => {
      const result = recordCabinet.generate({ ...WORKED_EXAMPLE, ...over }, {});
      return result.ok ? undefined : result.issues.find((i) => i.code === 'track-through-top');
    };
    expect(issue({ door: door(0.875) })?.message).toBe(
      'Top tracks 7/8" deep cut through the 3/4" top. Make the tracks at least 1/2" deep, enough to lift a door in, and less than 3/4", or make the top thicker.',
    );
    // Seated 3/8, a door needs a 3/4 top track to lift in, which no 3/4 top can hold.
    expect(issue({ door: door(0.75, 0.375) })?.message).toMatch(
      /needs a top track 3\/4" deep to lift in, so the top must be thicker than that/,
    );
  });

  it('refuses a door frame wider than one board gives (#563)', () => {
    // From 3-1/2" boards with the 1/2" rip allowance, a stile or rail is at most 3" wide. Wider,
    // it would be glued up and flattened thinner than the door the tracks are cut for.
    const narrow = { ...WORKED_EXAMPLE.board, width: 3.5 };
    const door = (frameWidth: number) => ({ ...WORKED_EXAMPLE.door, frameWidth });
    expect(refused({ board: narrow, door: door(3) })).toEqual([]);
    expect(refused({ board: narrow, door: door(3.0625) })).toEqual(['door-frame-wider-than-board']);
    expect(refused({ board: narrow, door: door(3.0625), doors: 'none' })).toEqual([]);
    const made = recordCabinet.generate(
      { ...WORKED_EXAMPLE, board: narrow, door: door(3.0625) },
      {},
    );
    expect(!made.ok && made.issues[0]?.message).toContain(
      'Make the frame 3" wide or less, or use wider boards.',
    );
  });

  it('refuses a panel that would pull out of its grooves at its narrowest', () => {
    // No species entered: span 17.75 + 1.5 − 4 + 0.5 = 15.75, so a gap of
    // 15.75 × 0.00376 × 4 / 2 + 1/32 = 0.1497 at each edge, and 2 × 0.1497 − 1/32 ≥ 1/4.
    const door = { ...WORKED_EXAMPLE.door, grooveDepth: 0.25, overlap: 2 };
    expect(refused({ door })).toEqual(['panel-out-of-groove']);
    expect(refused({ door: { ...door, overlap: 0.5 } })).toEqual([]);
  });
});

describe('a cabinet with no doors (#501)', () => {
  const { door: _, ...noSizes } = { ...WORKED_EXAMPLE, caseDepth: 15, doors: 'none' as const };

  it('needs no door sizes, and makes the same plan without them', () => {
    const plan = (params: RecordCabinetParams) => {
      const made = recordCabinet.generate(params, {});
      if (!made.ok) throw new Error(JSON.stringify(made.issues));
      const { params: echoed, ...design } = made.output.design;
      return { echoed, output: { ...made.output, design } };
    };
    const without = plan(recordCabinet.params.parse(noSizes));
    expect(without.echoed.door).toBeUndefined();
    expect(without.output).toEqual(plan({ ...noSizes, door: WORKED_EXAMPLE.door }).output);
  });

  it('asks for the door sizes when the doors slide', () => {
    const parsed = recordCabinet.params.safeParse({ ...noSizes, doors: 'sliding' });
    expect(parsed.error?.issues.map((i) => i.path)).toEqual([['door']]);
  });
});

describe('flags', () => {
  it('shows the wood left above the top’s door tracks: 3/4 − 9/16 = 3/16 (#574)', () => {
    const flag = worked.review.flags.find((f) => f.ask.includes('door tracks'));
    expect(flag).toMatchObject({ category: 'load-bearing', partIds: ['top'] });
    expect(flag?.ask).toMatch(/whether 3\/16" of wood above the door tracks/);
    expect(flag?.why).toMatch(/Tracks 9\/16" deep in the underside of a 3\/4" top leave 3\/16"/);
  });

  it('has no track flag without doors', () => {
    const result = recordCabinet.generate({ ...WORKED_EXAMPLE, doors: 'none' }, {});
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.output.review.flags.some((f) => f.ask.includes('door tracks'))).toBe(false);
  });
});

describe('structural (spec, Structural model, Worked examples)', () => {
  it('works out the case bottom’s long-term sag in each bay: 1.5 × 0.0043156"', () => {
    // L = 16.5 + 0.75 = 17.25; I = 17 × 0.75³ / 12 = 0.597656 in⁴; w = 40/12 = 3.3333 lb/in.
    // δ = 5 × 3.3333 × 17.25⁴ / (384 × 1,490,000 × 0.597656) = 1,475,724 / 341,953,500
    // = 0.0043156".
    const d = worked.review.bottom?.deflection;
    if (d?.status !== 'computed') throw new Error(d?.status);
    expect(d.computed.value).toBeCloseTo(0.0064733, 6);
  });

  it('works out the edge of range’s case bottom, walnut: 1.5 × 0.000792"', () => {
    // L = 12.5 + 1 = 13.5; I = 13 × 1³ / 12 = 1.083333 in⁴; E = 1,680,000 psi.
    // δ = 5 × 3.3333 × 13.5⁴ / (384 × 1,680,000 × 1.083333) = 553,584 / 698,880,000 = 0.000792".
    const d = edge.review.bottom?.deflection;
    if (d?.status !== 'computed') throw new Error(d?.status);
    expect(d.computed.value).toBeCloseTo(0.0011882, 6);
  });

  it('works out the front and back aprons’ long-term sag: 1.5 × 0.10019"', () => {
    // L = 52.5 − 3 = 49.5; records 40/12 × 3 × 16.5 = 165 lb and 35 lb on the top, 200 lb, half
    // on each apron: w = 200 / 49.5 / 2 = 2.0202 lb/in. I = 13/16 × 2.5³ / 12 = 1.057943 in⁴.
    // δ = 5 × 2.0202 × 49.5⁴ / (384 × 1,490,000 × 1.057943) = 0.10019".
    const d = worked.review.apron.deflection;
    if (d.status !== 'computed') throw new Error(d.status);
    expect(d.computed.value).toBeCloseTo(0.150279, 6);
  });

  it('works out the top under 35 lb at midspan: 1.5 × 0.0040254"', () => {
    // I = 17.75 × 0.75³ / 12 = 0.624023 in⁴; δ = 35 × 17.25³ / (48 × 1,490,000 × 0.624023)
    // = 179,653.4 / 44,629,725 = 0.0040254".
    const d = worked.review.top.deflection;
    if (d.status !== 'computed') throw new Error(d.status);
    expect(d.computed.value).toBeCloseTo(0.006038, 6);
  });

  it('says what is needed when no structural inputs are entered', () => {
    const none = made(1);
    expect(none.review.apron.deflection.status).toBe('input-needed');
    expect(none.review.bottom?.deflection.status).toBe('input-needed');
    expect(none.review.movement.every((m) => m.status === 'input-needed')).toBe(true);
  });
});

describe('wood movement', () => {
  it('estimates each part across its grain: width × 0.00248 × (10 − 6) for flatsawn cherry', () => {
    const change = worked.review.movement.map((m) => [
      m.subject,
      m.status === 'computed' ? m.change.value : null,
    ]);
    expect(change).toEqual([
      ['Top', expect.closeTo(17.75 * 0.00248 * 4, 12)],
      ['Left and right sides', expect.closeTo(17 * 0.00248 * 4, 12)],
      ['Partition', expect.closeTo(14.5 * 0.00248 * 4, 12)],
      ['Case bottom', expect.closeTo(17 * 0.00248 * 4, 12)],
      ['Back rail', expect.closeTo(3 * 0.00248 * 4, 12)],
      ['Door panel', expect.closeTo(14.5 * 0.00248 * 4, 12)],
    ]);
  });
});

describe('plan and drawings', () => {
  const plan = recordCabinet.plan(worked);
  const drawings = recordCabinet.drawings(worked);

  it('shows the case bottom’s, aprons’, and top’s checks and the movement estimates', () => {
    expect(plan.checks.map((c) => `${c.subject}: ${c.loadCase}`)).toEqual([
      'Case bottom, in each bay: Records along the bay, for years',
      'Front and back aprons: Records and everything on the top, for years',
      'Top: Everything on the top at the middle of a span, for years',
    ]);
    expect(plan.movement).toHaveLength(6);
  });

  it('draws no line across a leg’s flat faces, only where two faces meet at an angle', () => {
    // Each leg's outside faces are flat from top to foot; a line at the taper's start is no edge
    // of the wood (#351). The crease where a tapered face meets the straight part above stays.
    const leg = part(worked, 'leg');
    const key = (p: Vec3) => [p.x, p.y, p.z].map((c) => c.toFixed(6)).join(',');
    const normalOf = (ps: Vec3[]) =>
      unit(cross(sub(ps[1] as Vec3, ps[0] as Vec3), sub(ps[2] as Vec3, ps[0] as Vec3)));
    let creases = 0;
    for (let instance = 0; instance < leg.quantity; instance++) {
      const faces = solid(leg, placed(worked, 'leg', instance)).faces;
      const edges = faces.flatMap((f, i) =>
        f.points.map((a, j) => ({
          face: i,
          from: key(a),
          to: key(f.points[(j + 1) % f.points.length] as Vec3),
          drawn: f.edge?.[j] ?? true,
        })),
      );
      for (const e of edges.filter((x) => x.drawn)) {
        const other = edges.find((x) => x.from === e.to && x.to === e.from);
        if (!other) throw new Error(`leg ${instance}: edge ${e.from} to ${e.to} has one face`);
        const [a, b] = [faces[e.face], faces[other.face]].map((f) => normalOf(f?.points ?? []));
        const angle = 1 - dot(a as Vec3, b as Vec3);
        expect(angle, `leg ${instance}: a drawn edge between faces in one plane`).toBeGreaterThan(
          1e-9,
        );
        if (angle < 0.1 && e.from < e.to) creases++;
      }
    }
    // Each leg's two tapered faces meet the straight faces above them in two shallow creases.
    expect(creases).toBe(leg.quantity * 2);
  });

  it('draws a cut detail per part, front and end elevations, and a section through a bay', () => {
    expect(drawings.cutDetails).toHaveLength(14);
    expect(drawings.elevations?.map((d) => d.title)).toEqual([
      'Front elevation',
      'End elevation',
      'Section through the first bay',
    ]);
    const section = drawings.elevations?.[2];
    const lined = section?.primitives.filter((p) => p.kind === 'polygon' && p.fill === 'section');
    // The plane cuts the case bottom, the first bay's back rail, the top, the long aprons, and
    // the left door's rails and panel.
    expect(new Set(lined?.map((p) => p.part?.partId))).toEqual(
      new Set(['bottom', 'rail', 'top', 'apron-long', 'door-rail', 'door-panel']),
    );
  });

  it('dimensions each bay’s clear width and the base’s heights on the front elevation', () => {
    const front = drawings.elevations?.[0];
    const texts = front?.primitives.flatMap((p) =>
      p.kind === 'text' && p.role === 'dimension' ? [p.text] : [],
    );
    expect(texts?.filter((t) => t === '16-1/2"')).toHaveLength(3);
    // Leg showing 5, apron 2-1/2, case bottom 3/4, bay 13-1/4, top 3/4.
    for (const t of ['5"', '2-1/2"', '13-1/4"']) expect(texts).toContain(t);
  });

  // The screws fasten the case to the base and no check reads them (spec, Hardware), so hard rule 3
  // does not ask the owner to confirm them. If a check ever depends on screw size, this fails.
  it.each(EXAMPLES.map((example, i) => [example.name, i] as const))(
    'has only non-structural hardware, and the screws’ note says how to find the size: %s',
    (_name, i) => {
      const hardware = made(i).design.hardware;
      expect(hardware.length).toBeGreaterThan(0);
      expect(hardware.filter((item) => item.structural)).toEqual([]);
      const notes = hardware.find((item) => item.id === 'screws')?.notes.join(' ') ?? '';
      expect(notes).toMatch(/measure/i);
      expect(notes).toMatch(/ask/i);
    },
  );

  // Spec, Hardware: the cleat's thickness plus two-thirds of the case bottom's, to the nearest
  // quarter inch (#449). Worked example: 13/16 + 2/3 × 3/4 = 1.3125, so 1-1/4", and the points stop
  // 0.8125 + 0.75 − 1.25 = 5/16" short of the top face. Edge of range: 1-1/16 + 2/3 × 1 = 1.729, so
  // 1-3/4", stopping 2.0625 − 1.75 = 5/16" short.
  it('names the screw length to buy, and how far short of the top face the points stop', () => {
    for (const [o, length] of [
      [worked, '1-1/4"'],
      [edge, '1-3/4"'],
    ] as const) {
      const line = o.hardware.find((h) => h.description.startsWith('Wood screws'));
      expect(line?.description).toBe(`Wood screws, ${length} long`);
      expect(line?.notes[0]).toContain('the points stop 5/16" short of its top face');
    }
    expect(worked.hardware[0]?.notes[0]).toContain('the cleat’s 13/16" plus');
  });
});

describe('ranges that bound generation (spec, Ranges that bound generation)', () => {
  const store = WORKED_EXAMPLE.board.source === 'store' ? WORKED_EXAMPLE.board : undefined;
  if (!store) throw new Error('the worked example buys boards at a store');
  const issueParams = (params: unknown) => {
    const result = createSnapshot(recordCabinet, params, {});
    return result.ok ? [] : result.issues.map((i) => i.params[0]);
  };

  it('refuses the values that ran without end or threw (#421) as entries out of range', () => {
    expect(issueParams({ ...WORKED_EXAMPLE, board: { ...store, width: 0.13 } })).toEqual(['board']);
    expect(issueParams({ ...WORKED_EXAMPLE, board: { ...store, width: 0.1251 } })).toEqual([
      'board',
    ]);
    expect(issueParams({ ...WORKED_EXAMPLE, dadoDepth: 1e-12 })).toEqual(['dadoDepth']);
    expect(issueParams({ ...WORKED_EXAMPLE, footSize: Number.MAX_VALUE })).toEqual(['footSize']);
    expect(issueParams({ ...WORKED_EXAMPLE, tenonLength: Number.MAX_VALUE })).toEqual([
      'tenonLength',
    ]);
  });

  it('glues the top from 18 boards at the narrowest board and the most jointing', () => {
    // ⌈(17-3/4 + 1/2 − 2 × 1/4) / (1-1/2 − 2 × 1/4)⌉ = ⌈17.75⌉ = 18. No doors: a 2" frame can't
    // be ripped from 1-1/2" boards (#563).
    const result = recordCabinet.generate(
      {
        ...WORKED_EXAMPLE,
        doors: 'none',
        board: { ...store, width: 1.5 },
        allowances: { ...WORKED_EXAMPLE.allowances, jointPerEdge: 0.25 },
      },
      {},
    );
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    const s = part(result.output, 'top').stock;
    expect(isPanel(s) && s.boards).toBe(18);
  });
});
