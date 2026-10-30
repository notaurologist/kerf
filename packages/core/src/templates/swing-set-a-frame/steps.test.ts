import { describe, expect, it } from 'vitest';
import type { Inventory } from '../../inventory/tools.ts';
import { BuildStep, buildSteps } from '../../steps/build.ts';
import { swingSetAFrame } from './definition.ts';
import { EXAMPLES } from './examples.ts';

// The spec's worked example (Build steps): a 4x6 beam, 4x4 legs at 20°, 2x6 crossbars, 2x8
// gussets, legs buried 24". The numbers each method is checked against are the operations':
// 3-1/2" thick legs and beam, 1-1/2" boards 5-1/2" and 7-1/4" wide, leg-to-beam holes 8.947
// deep (the grip), board holes 5 deep.

const example = EXAMPLES[0];
if (!example) throw new Error('no worked example');
const generated = swingSetAFrame.generate(example.params, example.structuralInputs);
if (!generated.ok) throw new Error('worked example does not generate');
const outputs = generated.output;
const plan = swingSetAFrame.plan(outputs);

function steps(inventory: Inventory): BuildStep[] {
  return buildSteps(swingSetAFrame.steps(outputs), plan, inventory);
}

function inventory(...tools: [string, Record<string, number>?][]): Inventory {
  return {
    tools: tools.map(([id, caps]) => ({ toolTypeId: id, capabilities: caps ?? {} })),
    other: [],
  };
}

/** Each operation ID with its chosen method, or "none". */
function chosen(built: BuildStep[]): Record<string, string> {
  return Object.fromEntries(
    built.flatMap((s) => s.operations.map((o) => [o.operation.id, o.method?.id ?? 'none'])),
  );
}

// A miter saw that cuts a 4x4 and a 2x8 square, a jigsaw that reaches through 3-1/2", and auger
// bits that reach 10" (more than the 8.947 grip), with clamps that open 12".
const fullShop = inventory(
  ['miter-saw', { crosscutWidth: 12, cutDepth: 4, maxMiter: 50 }],
  ['jigsaw', { depthOfCut: 4 }],
  ['hand-saw'],
  ['tape-measure'],
  ['combination-square'],
  ['clamps', { count: 4, maxOpening: 12 }],
  ['drill-driver'],
  ['auger-bits', { reach: 10 }],
  ['block-plane'],
  ['sander'],
  ['post-hole-digger'],
  ['shovel'],
  ['tamper'],
  ['string-line'],
);

// A circular saw that cuts 2-3/8" (through a 2x but only past halfway in a 4x: 1.75), spade bits
// that reach 6" (past halfway in 8.947, through 5), clamps that open 10", and no digger.
const circularSawKit = inventory(
  ['circular-saw', { depthOfCut: 2.375, maxBevel: 45 }],
  ['hand-saw'],
  ['tape-measure'],
  ['rafter-square'],
  ['clamps', { count: 4, maxOpening: 10 }],
  ['drill-driver'],
  ['spade-bits', { reach: 6 }],
  ['block-plane'],
  ['shovel'],
  ['tamper'],
  ['string-line'],
);

describe('swing-set build steps (#105)', () => {
  // The board plan, by hand (1/2" trim per end, 1/8" kerf per piece): the 120" beam on a 12' 4x6
  // leaves 144 − (1 + 120.125) = 22.875. The front legs (138.354) and back legs (131.510) take a
  // 12' 4x4 each, since two do not fit. Both crossbars (58.993) fit a 10' 2x6: 1 + 2 · 59.118 =
  // 119.236. Both gussets (19.502) fit an 8' 2x8: 1 + 2 · 19.627 = 40.254, leaving 55.746.
  it('cuts board by board in the board plan order, then assembles (#58)', () => {
    const built = steps(fullShop);
    expect(
      built.map((s) => [
        s.id,
        s.board ? `${s.board.nominal} ${s.board.feet}'` : s.title,
        s.board?.pieces.map((p) => `${p.partId} ${p.instance}`) ?? [],
      ]),
    ).toEqual([
      ['board-1', "4x6 12'", ['beam 0']],
      ['board-2', "4x4 12'", ['leg-front 0']],
      ['board-3', "4x4 12'", ['leg-front 1']],
      ['board-4', "4x4 12'", ['leg-back 0']],
      ['board-5', "4x4 12'", ['leg-back 1']],
      ['board-6', "2x6 10'", ['crossbar 0', 'crossbar 1']],
      ['board-7', "2x8 8'", ['gusset 0', 'gusset 1']],
      ['ease-edges', 'Ease the edges of every part', []],
      ['site', 'Dig the leg holes', []],
      ['frames', 'Bolt the crossbars and gussets across the legs', []],
      ['beam', 'Bolt the beam between the leg tops', []],
    ]);
    const board = (n: number) => built[n - 1]?.board;
    expect(board(1)?.offcut).toBeCloseTo(22.875, 9);
    expect(board(6)?.offcut).toBeCloseTo(120 - 119.236, 2);
    expect(board(7)?.offcut).toBeCloseTo(55.746, 2);
    expect([board(1)?.trimPerEnd, board(1)?.kerf]).toEqual([0.5, 0.125]);
    // Each board's cuts are done once per piece on it: a leg's end cuts and flush cut once on its
    // own board, a crossbar's end cuts twice on the board that holds both.
    const counts = (n: number) =>
      built[n - 1]?.operations.map((o) => [o.operation.id, o.operation.count]);
    expect(counts(2)).toEqual([
      ['leg-front/end-0', 1],
      ['leg-front/end-1', 1],
      ['leg-front/taper-0', 1],
    ]);
    expect(counts(6)).toEqual([
      ['crossbar/end-0', 2],
      ['crossbar/end-1', 2],
    ]);
    expect(built[1]?.operations[0]?.method?.technique).toContain('Cut 1 this way.');
    expect(built.find((s) => s.id === 'site')?.title).toBe('Dig the leg holes');
    expect(built.find((s) => s.id === 'beam')?.partIds).toEqual(['beam', 'leg-back', 'leg-front']);
  });

  it('chooses the stationary saw, jigsaw, and auger bits from the full shop', () => {
    expect(chosen(steps(fullShop))).toEqual({
      'beam/end-0': 'crosscut-miter-saw',
      'beam/end-1': 'crosscut-miter-saw',
      'leg-back/end-0': 'miter-miter-saw',
      'leg-back/end-1': 'miter-miter-saw',
      'leg-back/taper-0': 'taper-jigsaw',
      'leg-front/end-0': 'miter-miter-saw',
      'leg-front/end-1': 'miter-miter-saw',
      'leg-front/taper-0': 'taper-jigsaw',
      'crossbar/end-0': 'miter-miter-saw',
      'crossbar/end-1': 'miter-miter-saw',
      'gusset/end-0': 'miter-miter-saw',
      'gusset/end-1': 'miter-miter-saw',
      'beam/ease-edges': 'ease-edges-sander',
      'leg-back/ease-edges': 'ease-edges-sander',
      'leg-front/ease-edges': 'ease-edges-sander',
      'crossbar/ease-edges': 'ease-edges-sander',
      'gusset/ease-edges': 'ease-edges-sander',
      'site/dig-holes': 'dig-holes-post-hole-digger',
      'crossbar-bolts/holes': 'bolt-holes-auger-one-side',
      'gusset-bolts/holes': 'bolt-holes-auger-one-side',
      'leg-beam-bolts/holes': 'bolt-holes-auger-one-side',
    });
  });

  it('cuts 4x stock from two faces and drills the deep holes from both sides with the circular saw kit', () => {
    expect(chosen(steps(circularSawKit))).toEqual({
      'beam/end-0': 'crosscut-circular-saw-two-faces',
      'beam/end-1': 'crosscut-circular-saw-two-faces',
      'leg-back/end-0': 'miter-circular-saw-two-faces',
      'leg-back/end-1': 'miter-circular-saw-two-faces',
      'leg-back/taper-0': 'taper-circular-saw',
      'leg-front/end-0': 'miter-circular-saw-two-faces',
      'leg-front/end-1': 'miter-circular-saw-two-faces',
      'leg-front/taper-0': 'taper-circular-saw',
      'crossbar/end-0': 'miter-circular-saw',
      'crossbar/end-1': 'miter-circular-saw',
      'gusset/end-0': 'miter-circular-saw',
      'gusset/end-1': 'miter-circular-saw',
      'beam/ease-edges': 'ease-edges-block-plane',
      'leg-back/ease-edges': 'ease-edges-block-plane',
      'leg-front/ease-edges': 'ease-edges-block-plane',
      'crossbar/ease-edges': 'ease-edges-block-plane',
      'gusset/ease-edges': 'ease-edges-block-plane',
      'site/dig-holes': 'dig-holes-shovel',
      'crossbar-bolts/holes': 'bolt-holes-spade-one-side',
      'gusset-bolts/holes': 'bolt-holes-spade-one-side',
      'leg-beam-bolts/holes': 'bolt-holes-spade-both-sides',
    });
  });

  it('suggests the tools that would allow an easier or more accurate method', () => {
    const op = steps(circularSawKit)
      .flatMap((s) => s.operations)
      .find((o) => o.operation.id === 'leg-beam-bolts/holes');
    expect(op?.suggestions.map((s) => [s.methodId, s.better])).toEqual([
      ['bolt-holes-auger-one-side', ['easier', 'more accurate']],
      ['bolt-holes-spade-one-side', ['easier', 'more accurate']],
      ['bolt-holes-auger-both-sides', ['easier', 'more accurate']],
    ]);
    // Spade bits that reach 8.947 (8-15/16" to the sixteenth).
    const longer = op?.suggestions[1]?.gaps.flatMap((g) => g.anyOf);
    expect(longer).toEqual([
      'Spade bits with deepest hole from one side at least 8-15/16" (you entered 6")',
    ]);
  });

  it('fills the angled-line offset for each part from its width: 1-1/4" on a 4x4, 2" on a 2x6', () => {
    const ops = steps(circularSawKit).flatMap((s) => s.operations);
    const technique = (id: string) =>
      ops.find((o) => o.operation.id === id)?.method?.technique ?? [];
    expect(technique('leg-back/end-0')).toContain(
      'On the opposite edge, measure 1-1/4" from that square line toward the rest of the part and mark the short point.',
    );
    expect(technique('crossbar/end-0')).toContain(
      'On the opposite edge, measure 2" from that square line toward the rest of the part and mark the short point.',
    );
  });

  it('parses with its schema, as the API sends it', () => {
    for (const step of steps(circularSawKit)) {
      expect(BuildStep.safeParse(JSON.parse(JSON.stringify(step))).error, step.id).toBeUndefined();
    }
  });

  it('with no tools, gives every operation a step that names the tools it needs', () => {
    const built = steps(inventory());
    for (const op of built.flatMap((s) => s.operations)) {
      expect(op.method, op.operation.id).toBeUndefined();
      expect(op.needed?.gaps.length, op.operation.id).toBeGreaterThan(0);
    }
    const dig = built.find((s) => s.id === 'site')?.operations[0];
    expect(dig?.needed?.methodId).toBe('dig-holes-shovel');
  });

  it("shows each step's expert checks: dust on sanding, loads on the site and the bolted joints", () => {
    for (const inv of [fullShop, circularSawKit, inventory()]) {
      const flags = Object.fromEntries(
        steps(inv).map((s) => [s.id, s.flags.map((f) => f.category)]),
      );
      // The plan's own flags are load-bearing: two on the legs, three on the boards' bolts, and
      // one on the leg-to-beam bolt (#51), each before the generic check for its step.
      expect(flags).toEqual({
        'board-1': [],
        'board-2': ['load-bearing', 'load-bearing'],
        'board-3': [],
        'board-4': [],
        'board-5': [],
        'board-6': [],
        'board-7': [],
        'ease-edges': ['dust-and-species'],
        site: ['load-bearing'],
        frames: ['load-bearing', 'load-bearing', 'load-bearing', 'load-bearing'],
        beam: ['load-bearing', 'load-bearing', 'dynamic-loads'],
      });
    }
  });

  // The worked example's flags (spec, Flags): a sloped site, legs buried 24", and 1/2" bolts with
  // 1-3/4" of leg edge distance, under NDS's 4D (2").
  it('shows each of the plan flags once, on the first step that does the work it concerns (#51)', () => {
    const built = steps(fullShop);
    const stepOf = (start: string) =>
      built.filter((s) => s.flags.some((f) => f.ask.startsWith(start))).map((s) => s.id);
    // Leg length depends on the slope and the burial depth, so both are asked before the first leg
    // is cut.
    expect(stepOf('Confirm the frame on sloped ground')).toEqual(['board-2']);
    expect(stepOf('Confirm the burial depth (24")')).toEqual(['board-2']);
    // Bolt flags go where their bolts are drilled.
    expect(stepOf('Crossbar to leg, 2 1/2" bolts')).toEqual(['frames']);
    expect(stepOf('Gusset to leg, 2 1/2" bolts')).toEqual(['frames']);
    expect(stepOf("For the bolts' end distance")).toEqual(['frames']);
    expect(stepOf('Confirm the bolt size for the leg-to-beam bolt')).toEqual(['beam']);
    // Every plan flag is on exactly one step.
    for (const flag of plan.flags) expect(stepOf(flag.ask), flag.ask).toHaveLength(1);
  });

  it('names only parts and hardware the plan has, in every flag and checklist item', () => {
    for (const ex of EXAMPLES) {
      const made = swingSetAFrame.generate(ex.params, ex.structuralInputs);
      if (!made.ok) throw new Error('worked example does not generate');
      const parts = new Set(made.output.design.parts.map((p) => p.id));
      const hardware = new Set(made.output.design.hardware.map((h) => h.id));
      const items = [...made.output.design.flags, ...made.output.structuralReview.checklist];
      for (const item of items) {
        expect(
          item.partIds?.every((id) => parts.has(id)),
          JSON.stringify(item),
        ).toBe(true);
        expect(
          item.hardwareIds?.every((id) => hardware.has(id)),
          JSON.stringify(item),
        ).toBe(true);
      }
    }
  });

  it('levels pads instead of digging when the legs are not buried', () => {
    const onPads = swingSetAFrame.generate(
      {
        ...example.params,
        burialDepth: 0,
        hardware: { ...example.params.hardware, anchorsPerFoot: 2 },
      },
      example.structuralInputs,
    );
    if (!onPads.ok) throw new Error('pads example does not generate');
    const built = buildSteps(
      swingSetAFrame.steps(onPads.output),
      swingSetAFrame.plan(onPads.output),
      fullShop,
    );
    const site = built.find((s) => s.id === 'site');
    expect(site?.title).toBe('Level the pads');
    expect(site?.operations[0]?.method).toBeUndefined();
    expect(site?.operations[0]?.needed?.methodId).toBe('level-pads-straight-board');
  });
});
