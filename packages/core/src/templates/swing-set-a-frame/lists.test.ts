import { describe, expect, it } from 'vitest';
import type { Part } from '../../model/types.ts';
import { cutList } from '../../outputs/cutList.ts';
import { hardwareList } from '../../outputs/hardwareList.ts';
import { planLumber } from '../../outputs/shoppingList.ts';
import type { CheckResult } from '../../structural/types.ts';
import { swingSetAFrame } from './definition.ts';
import { EXAMPLES } from './examples.ts';
import type { SwingSetParams } from './params.ts';
import { generate } from './template.ts';

// The swing-set worked example run through the generic cut list and shopping lists
// (docs/templates/swing-set-a-frame.md).
const example: SwingSetParams = {
  beamLength: 120,
  beamHeight: 96,
  splay: { kind: 'angle', degrees: 20 },
  beamStock: '4x6',
  beamPlies: 1,
  legStock: '4x4',
  crossbarStock: '2x6',
  crossbarHeight: 40,
  gussetStock: '2x8',
  frameInset: 12,
  groundSlope: 1,
  burialDepth: 24,
  swings: { centers: [40, 80], hangerSpacing: 20, seatWidth: 20, seatHeight: 16 },
  hardware: {
    legBoltDiameter: 0.5,
    crossbarBolts: { diameter: 0.5, perJoint: 2 },
    gussetBolts: { diameter: 0.5, perJoint: 2 },
  },
};

function output(params: SwingSetParams) {
  const result = generate(params);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.output;
}

function parts(params: SwingSetParams): Part[] {
  return output(params).parts;
}

describe('cutList', () => {
  const rows = cutList(parts(example));
  const row = (id: string) => rows.find((r) => r.partId === id);

  it('shows nominal and actual stock, and lengths to the nearest 1/16', () => {
    expect(row('leg-back')).toMatchObject({
      name: 'Back leg (uphill)',
      quantity: 2,
      stock: '4x4 (3-1/2" x 3-1/2")',
      length: '131-1/2"',
    });
    expect(row('leg-front')?.length).toBe('138-3/8"');
    // 58.993 and 19.502 to the nearest 1/16 (spec, Bolt layout).
    expect(row('crossbar')?.length).toBe('59"');
    expect(row('gusset')?.length).toBe('19-1/2"');
  });

  // Hand-written from the spec's cut-list order (#66): beam, back legs, front legs, crossbars,
  // gussets. Each pair shares one letter, since a pair is one row.
  it('letters the parts A to E in cut-list order, the same letters as the parts', () => {
    expect(rows.map((r) => [r.letter, r.name])).toEqual([
      ['A', 'Beam'],
      ['B', 'Back leg (uphill)'],
      ['C', 'Front leg (downhill)'],
      ['D', 'Crossbar'],
      ['E', 'Gusset'],
    ]);
    expect(parts(example).map((p) => p.letter)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('gives every part of every worked example a unique letter, and every placement a lettered part', () => {
    for (const e of EXAMPLES) {
      const design = output(e.params);
      const letters = design.parts.map((p) => p.letter);
      expect(letters.every((l) => /^[A-Z]+$/.test(l))).toBe(true);
      expect(new Set(letters).size).toBe(letters.length);
      const placements = design.placements ?? [];
      expect(placements.length).toBeGreaterThan(0);
      for (const placement of placements) {
        expect(design.parts.find((p) => p.id === placement.partId)?.letter).toBeDefined();
      }
    }
  });

  it('labels every angled end with the saw setting and the angle to the edge', () => {
    expect(row('leg-back')?.ends).toEqual([
      'Top: level cut; saw at 20.0°, 70.0° to the edge',
      'Foot: level cut; saw at 20.0°, 70.0° to the edge',
    ]);
    expect(row('beam')?.ends).toEqual(['Square', 'Square']);
  });

  it('formats mark lengths through the same formatter', () => {
    expect(row('crossbar')?.marks).toEqual([
      { label: 'Top edge', value: '55"' },
      { label: 'Bottom edge', value: '59"' },
    ]);
  });
});

describe('planLumber, worked example', () => {
  // Hand-checked with 1/8" kerf per piece and 1/2" trim at each end (1" per board):
  // beam 120 + 0.125 + 1 = 121.125 -> 12'; legs 139.479 and 132.635 each -> 12', one per board;
  // crossbars 1 + 2 x (58.993 + 0.125) = 119.236 -> 10'; gussets 1 + 2 x 19.627 = 40.254 -> 8'.
  const plan = planLumber(parts(example));

  it('lists boards to buy', () => {
    expect(plan.lines.map(({ nominal, feet, count }) => ({ nominal, feet, count }))).toEqual([
      { nominal: '4x6', feet: 12, count: 1 },
      { nominal: '4x4', feet: 12, count: 4 },
      { nominal: '2x6', feet: 10, count: 1 },
      { nominal: '2x8', feet: 8, count: 1 },
    ]);
    expect(plan.issues).toEqual([]);
  });

  it("carries what to look for in each part's board, by part ID (#53)", () => {
    // Legs stand in or on the ground whether buried or on pads.
    const onPads = planLumber(
      parts({ ...example, burialDepth: 0, hardware: { ...example.hardware, anchorsPerFoot: 2 } }),
    );
    for (const lumber of [plan, onPads]) {
      expect(lumber.selection).toEqual([
        { partId: 'beam', guides: ['structural', 'span', 'bolted'] },
        { partId: 'leg-back', guides: ['structural', 'along-length', 'bolted', 'ground-contact'] },
        { partId: 'leg-front', guides: ['structural', 'along-length', 'bolted', 'ground-contact'] },
        { partId: 'crossbar', guides: ['structural', 'bolted'] },
        { partId: 'gusset', guides: ['structural', 'bolted'] },
      ]);
    }
  });

  it('records what comes from each board and the offcut', () => {
    const crossbarBoard = plan.boards.find((b) => b.nominal === '2x6');
    expect(crossbarBoard?.pieces.map((p) => p.partId)).toEqual(['crossbar', 'crossbar']);
    expect(crossbarBoard?.offcut).toBeCloseTo(120 - 119.236, 3);
    const legBoards = plan.boards.filter((b) => b.nominal === '4x4');
    expect(legBoards.map((b) => b.offcut)).toEqual([
      expect.closeTo(144 - 139.479, 3),
      expect.closeTo(144 - 139.479, 3),
      expect.closeTo(144 - 132.635, 3),
      expect.closeTo(144 - 132.635, 3),
    ]);
  });

  it("notes on the beam's line when a board one size down works if the store boards run long", () => {
    expect(plan.lines[0]?.notes).toEqual([
      `Beam: listed as 12' to leave room for trimming the ends. A 10' board works if it measures at least 121-1/8".`,
    ]);
    expect(plan.lines.slice(1).flatMap((l) => l.notes)).toEqual([]);
    expect(plan.notes).toEqual([
      'Allows 1/8" for each saw cut and trims 1/2" off each factory end.',
    ]);
  });

  // Hand-checked against the needs above, with lengths of 8, 10, 12, 14 and 16 feet (#450):
  // - Beam, 121.125 on a 12': a 10' (120) misses by 1.125, no more than 1" trim and a 1/8" kerf,
  //   so a 10' that measures 121.125; the beam is longer than 10' less trim, so no shorter boards.
  // - Legs, 139.479 and 132.635 on 12's: more than 10' even uncut, so only longer boards.
  // - Crossbars, 119.236 on a 10': each alone needs 1 + 59.118 = 60.118, under 96, and both
  //   together are over 96, so two 8's.
  // - Gussets, 40.254 on an 8': no shorter length is sold, so only a 10'.
  it("lists what else holds each line's pieces when the store has none", () => {
    expect(plan.lines.map((l) => l.alternatives)).toEqual([
      [
        { kind: 'measured', feet: 10, count: 1, atLeast: expect.closeTo(121.125, 3) },
        { kind: 'lengths', boards: [{ feet: 14, count: 1 }] },
      ],
      [{ kind: 'lengths', boards: [{ feet: 14, count: 4 }] }],
      [
        { kind: 'lengths', boards: [{ feet: 8, count: 2 }] },
        { kind: 'lengths', boards: [{ feet: 12, count: 1 }] },
      ],
      [{ kind: 'lengths', boards: [{ feet: 10, count: 1 }] }],
    ]);
  });
});

describe('planLumber, built-up beam', () => {
  // Two 2x6 plies (120) and two crossbars (58.493 with the narrower beam) share 2x6 boards:
  // 120 + 58.493 + 2 kerf + 1 trim = 179.743, so two 16' boards, each with one ply and one crossbar.
  const plan = planLumber(
    parts({
      ...example,
      beamStock: '2x6',
      beamPlies: 2,
      hardware: { ...example.hardware, plyBolts: { diameter: 0.5, count: 6 } },
    }),
  );

  it('puts each ply and a crossbar on one 16 foot board', () => {
    const twoBySix = plan.boards.filter((b) => b.nominal === '2x6');
    expect(twoBySix.map((b) => [b.feet, b.pieces.map((p) => p.partId)])).toEqual([
      [16, ['beam', 'crossbar']],
      [16, ['beam', 'crossbar']],
    ]);
    expect(twoBySix[0]?.offcut).toBeCloseTo(192 - 179.743, 3);
  });
});

describe('hardwareList', () => {
  // Spec, Hardware example: 2 leg bolts (grip 8.947) and 16 bolts with a 5" grip, all 1/2".
  const out = output(example);
  const list = hardwareList(out.hardware);

  it('groups bolts by diameter and length and totals the fittings', () => {
    const bolts = 'Bolts and fittings';
    const swing = 'Swing hardware';
    expect(list.map(({ notes, bolt, ...line }) => line)).toEqual([
      { description: '1/2" × 10" through-bolt', quantity: 2, group: bolts },
      { description: '1/2" × 6" through-bolt', quantity: 16, group: bolts },
      { description: '1/2" flat washers', quantity: 36, group: bolts },
      { description: '1/2" locking nuts', quantity: 18, group: bolts },
      { description: '1/2" bolt caps', quantity: 18, group: bolts },
      { description: 'Swing hangers', quantity: 4, group: swing },
      { description: 'Swing seats with chain', quantity: 2, group: swing },
      { description: 'Wood preservative for cut ends', quantity: 1, group: 'Paint and stain' },
    ]);
  });

  // Hand check (#449; spec, Hardware), 1/2" bolts: a USS washer is at most 0.132 thick and a
  // nylon-insert locknut at most 0.609 high. Leg to beam, grip 8.947: 8.947 + 2 × 0.132 + 0.609 =
  // 9.820 to 9.820 + 0.5 = 10.320, so 10", shown inward as 9-7/8" (157.1 sixteenths up to 158) to
  // 10-5/16" (165.1 down to 165). Crossbars and gussets, grip 5: 5.873 to 6.373, so 6", shown as
  // 5-7/8" (93.97 up to 94) to 6-5/16" (101.97 down to 101).
  it('gives each bolt the length to buy, with its grip and the lengths that fit', () => {
    const legBolt = out.hardware.find((h) => h.id === 'leg-beam-bolts');
    expect(legBolt?.bolt?.grip).toBeCloseTo(8.947, 3);
    expect(legBolt?.bolt?.length).toBe(10);
    expect(legBolt?.bolt?.fits?.min).toBeCloseTo(9.82, 3);
    expect(legBolt?.bolt?.fits?.max).toBeCloseTo(10.32, 3);
    expect(list[1]?.bolt).toEqual({
      diameter: 0.5,
      grip: 5,
      length: 6,
      fits: { min: expect.closeTo(5.873, 3), max: expect.closeTo(6.373, 3) },
      items: ['crossbar-bolts', 'gusset-bolts'],
    });
    expect(list[0]?.notes).toEqual([
      'Grip 8-15/16". Any length from 9-7/8" to 10-5/16" fits: through the grip, two USS flat washers, and a nylon-insert locking nut, and no more than 1/2" past the nut (CPSC Pub. 324, p. 3).',
    ]);
    expect(list[1]?.notes).toEqual([
      'Grip 5". Any length from 5-7/8" to 6-5/16" fits: through the grip, two USS flat washers, and a nylon-insert locking nut, and no more than 1/2" past the nut (CPSC Pub. 324, p. 3).',
    ]);
    // Swing hardware keeps its notes on its lines too.
    expect(list[5]?.notes).toEqual([
      'Rated for swing use. The rating is checked in the structural review.',
    ]);
  });

  it('puts ground anchors in their own group when the legs stand on pads', () => {
    const onPads = hardwareList(
      output({ ...example, burialDepth: 0, hardware: { ...example.hardware, anchorsPerFoot: 1 } })
        .hardware,
    );
    expect(onPads.find((l) => l.group === 'Ground anchors')).toEqual({
      description: 'Ground anchors',
      quantity: 4,
      group: 'Ground anchors',
      notes: ['Bury or cover the anchors (CPSC Pub. 324, p. 4).'],
    });
  });

  // The count is read from the anchor maker's instructions at the store (#406): until then the
  // anchors are listed with the input their count waits for, and no count.
  it('lists the ground anchors on pads before their count is entered', () => {
    const onPads = hardwareList(output({ ...example, burialDepth: 0 }).hardware);
    expect(onPads.find((l) => l.group === 'Ground anchors')).toEqual({
      description: 'Ground anchors',
      quantityNeeded: { key: 'hardware.anchorsPerFoot', label: 'Ground anchors per leg foot' },
      group: 'Ground anchors',
      notes: ['Bury or cover the anchors (CPSC Pub. 324, p. 4).'],
    });
  });

  it('keeps lines from different groups apart', () => {
    const bolt = (group: string) => ({
      id: 'b',
      name: 'B',
      quantity: 1,
      bolt: { diameter: 0.5, grip: 5, washers: 2, nut: 'locking' as const, cap: false },
      structural: true,
      notes: [],
      group,
    });
    expect(hardwareList([bolt('A'), bolt('B'), bolt('C')]).map((l) => l.group)).toEqual([
      'A',
      'B',
      'C',
      'A',
      'A',
      'B',
      'B',
      'C',
      'C',
    ]);
  });

  it('states treatment compatibility and the materials the IRC names for treated lumber', () => {
    expect(out.hardwareNotes.join(' ')).toContain('pressure treatment');
    expect(out.hardwareNotes[1]).toBe(
      'Bolts, washers, and nuts in pressure-treated lumber: hot-dip galvanized steel (zinc coating to ASTM A153), stainless steel, silicon bronze, or copper, or mechanically galvanized steel to ASTM B695 Class 55 or heavier (IRC 2021 R317.3.1).',
    );
  });

  it('keeps different diameters apart', () => {
    const mixed = hardwareList(
      output({
        ...example,
        hardware: { ...example.hardware, legBoltDiameter: 0.625 },
      }).hardware,
    );
    expect(mixed.filter((l) => l.description.includes('washers'))).toEqual([
      { description: '1/2" flat washers', quantity: 32, group: 'Bolts and fittings', notes: [] },
      { description: '5/8" flat washers', quantity: 4, group: 'Bolts and fittings', notes: [] },
    ]);
    // 5/8": 8.947 + 2 × 0.160 + 0.765 = 10.032 to 10.657, so 10-1/2".
    expect(mixed[0]?.description).toBe('5/8" × 10-1/2" through-bolt');
  });
});

describe('planLumber, edge of range', () => {
  it('reports legs longer than any board', () => {
    const plan = planLumber(
      parts({
        ...example,
        beamLength: 240,
        beamHeight: 144,
        splay: { kind: 'angle', degrees: 35 },
        beamStock: '2x6',
        beamPlies: 2,
        groundSlope: -3,
        burialDepth: 48,
        crossbarHeight: 100,
        swings: { ...example.swings, centers: [80, 160] },
        hardware: { ...example.hardware, plyBolts: { diameter: 0.5, count: 10 } },
      }),
    );
    // The longest board is 16' (192"). Too long: both 240" beam plies, the two 282.2" back
    // legs, and the two 216.4" front legs.
    expect(
      plan.issues.map(
        (i) =>
          i.message.split(' (')[0] +
          (i.message.includes('(downhill)')
            ? ' (downhill)'
            : i.message.includes('(uphill)')
              ? ' (uphill)'
              : ''),
      ),
    ).toEqual([
      'Beam ply',
      'Beam ply',
      'Back leg (downhill)',
      'Back leg (downhill)',
      'Front leg (uphill)',
      'Front leg (uphill)',
    ]);
  });
});

describe('other stock sizes when the store has none (#450)', () => {
  const [entered, noInputs] = EXAMPLES;
  if (!entered || !noInputs) throw new Error('worked examples missing');
  const made = (params: SwingSetParams, inputs: typeof entered.structuralInputs) => {
    const result = swingSetAFrame.generate(params, inputs);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    return swingSetAFrame.plan(result.output);
  };
  const plan = made(entered.params, entered.structuralInputs);
  const lowestOfBeamChecks = (checks: readonly CheckResult[]) =>
    Math.min(...checks.slice(0, 3).map((c) => (c.status === 'computed' ? c.margin : 0)));

  // The beam is the one member a check computes. Its checks also read the legs' and gussets'
  // sizes, through the span, but a margin for them would say nothing about the legs or gussets.
  it('offers each beam size that keeps the beam checks at their margin, as regenerating gives it', () => {
    const now = lowestOfBeamChecks(plan.checks);
    const stock = (plan.lumber.lines[0]?.alternatives ?? []).filter((a) => a.kind === 'stock');
    for (const alternative of stock) {
      const other = made(
        { ...entered.params, beamStock: alternative.nominal as SwingSetParams['beamStock'] },
        entered.structuralInputs,
      );
      expect(alternative.margin).toBe(lowestOfBeamChecks(other.checks));
      expect(alternative.margin).toBeGreaterThanOrEqual(now);
    }
    // A deeper beam has more margin than the 4x6; a 4x4 has less.
    expect(stock.map((a) => a.nominal)).toEqual(['4x8']);
    for (const line of plan.lumber.lines.slice(1)) {
      expect(line.alternatives.some((a) => a.kind.startsWith('stock'))).toBe(false);
    }
  });

  it('says the margins need the structural inputs while they are missing', () => {
    const missing = made(noInputs.params, noInputs.structuralInputs);
    expect(missing.lumber.lines[0]?.alternatives.at(-1)).toEqual({
      kind: 'stock-needs-inputs',
      name: 'Beam',
      field: 'beamStock',
    });
  });
});
