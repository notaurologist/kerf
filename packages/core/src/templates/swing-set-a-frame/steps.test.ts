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
const operations = plan.operations;

function steps(inventory: Inventory): BuildStep[] {
  return buildSteps(swingSetAFrame.steps(outputs), operations, inventory, plan.flags);
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
  it('puts every operation in one step, in build order', () => {
    const built = steps(fullShop);
    expect(built.map((s) => [s.id, s.operations.length])).toEqual([
      ['cut-beam', 2],
      ['cut-legs', 6],
      ['cut-boards', 4],
      ['ease-edges', 5],
      ['site', 1],
      ['frames', 2],
      ['beam', 1],
    ]);
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
        'cut-beam': [],
        'cut-legs': ['load-bearing', 'load-bearing'],
        'cut-boards': [],
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
    // Leg length depends on the slope and the burial depth, so both are asked before cutting.
    expect(stepOf('Confirm the frame on sloped ground')).toEqual(['cut-legs']);
    expect(stepOf('Confirm the burial depth (24")')).toEqual(['cut-legs']);
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
    const padsPlan = swingSetAFrame.plan(onPads.output);
    const built = buildSteps(
      swingSetAFrame.steps(onPads.output),
      padsPlan.operations,
      fullShop,
      padsPlan.flags,
    );
    const site = built.find((s) => s.id === 'site');
    expect(site?.title).toBe('Level the pads');
    expect(site?.operations[0]?.method).toBeUndefined();
    expect(site?.operations[0]?.needed?.methodId).toBe('level-pads-straight-board');
  });
});
