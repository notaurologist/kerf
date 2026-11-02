import { describe, expect, it } from 'vitest';
import type { Inventory } from '../../inventory/tools.ts';
import { buildSteps } from '../../steps/build.ts';
import { stepDrawings } from '../../steps/drawings.ts';
import { recordCabinet } from './definition.ts';
import { WORKED_EXAMPLE } from './examples.ts';

// The worked example's build steps after the cutting steps (spec, Build steps), through fitting,
// gluing, and finishing. Its case is W − 2·o_s = 54 − 1.5 = 52-1/2" wide, and its top stands
// H − z_b = 22-1/4 − 7-1/2 = 14-3/4" above the case bottom, so the clamps must open that far
// across the case and from the top down. Each door is 17-3/4" wide.

const made = recordCabinet.generate(WORKED_EXAMPLE, {});
if (!made.ok) throw new Error('worked example does not generate');
const outputs = made.output;
const plan = recordCabinet.plan(outputs);

const inventory = (maxOpening: number, ...more: string[]): Inventory => ({
  tools: [
    { toolTypeId: 'clamps', capabilities: { count: 6, maxOpening } },
    { toolTypeId: 'tape-measure', capabilities: {} },
    ...more.map((toolTypeId) => ({ toolTypeId, capabilities: {} })),
  ],
  other: [],
});
const chosen = (inv: Inventory) =>
  Object.fromEntries(
    buildSteps(recordCabinet.steps(outputs), plan, inv)
      .flatMap((s) => s.operations)
      .map((o) => [o.operation.id, o.method?.id ?? 'none']),
  );

describe('assembling and finishing the record cabinet', () => {
  it('runs from the joinery to a dry fit, the base, the case, the top, the doors, easing, and finishing', () => {
    const steps = recordCabinet.steps(outputs);
    const ids = steps.map((s) => s.id);
    expect(ids.slice(ids.indexOf('notches'))).toEqual([
      'notches',
      'mortises',
      'tenons',
      'screw-holes',
      'door-joints',
      'dry-fit',
      'base',
      'cleats',
      'case',
      'top',
      'fasten',
      'doors',
      'ease',
      'finish',
    ]);
    // The tracks are cut with the other dadoes; the aprons' tenons apart from the doors'.
    const step = (id: string) => steps.find((s) => s.id === id)?.operationIds ?? [];
    expect(step('dadoes')).toContain('top/dado-4');
    expect(step('tenons')).toEqual([
      'apron-long/tenon-0',
      'apron-long/tenon-1',
      'apron-short/tenon-0',
      'apron-short/tenon-1',
    ]);
    expect(step('door-joints')).toContain('door-rail/tenon-0');
    expect(step('door-joints')).toContain('door-stile-outer/finger-recess-0');
  });

  it('lets the lumber settle indoors before the first board is cut', () => {
    const steps = buildSteps(recordCabinet.steps(outputs), plan, inventory(60));
    expect(steps[0]?.id).toBe('settle');
    expect(steps[1]?.board?.number).toBe(1);
    // Every glued-up panel; the one-board rails, aprons, and cleats are only ripped.
    expect(steps[0]?.operations[0]?.partIds).toEqual([
      'top',
      'bottom',
      'side-left',
      'side-right',
      'partition',
      'door-panel',
    ]);
    expect(chosen(inventory(60))['lumber/acclimate']).toBe('acclimate-wait');
    expect(chosen(inventory(60, 'moisture-meter'))['lumber/acclimate']).toBe(
      'acclimate-moisture-meter',
    );
  });

  it('clamps across the 52-1/2" case and down the 14-3/4" from the top to the case bottom', () => {
    const op = (id: string) => outputs.design.operations.find((o) => o.id === id);
    expect(op('case/dry-fit')).toMatchObject({ reach: 52.5 });
    expect(op('case/glue')).toMatchObject({
      reach: 52.5,
      partIds: ['bottom', 'side-left', 'side-right', 'partition', 'rail'],
    });
    expect(op('base/glue')).toMatchObject({
      reach: 52.5,
      partIds: ['leg', 'apron-long', 'apron-short'],
    });
    // Six screws, three through each cleat.
    expect(op('case/fasten')).toMatchObject({ count: 6, partIds: ['bottom', 'cleat'] });
    expect(op('top/glue')).toMatchObject({
      reach: 14.75,
      partIds: ['top', 'side-left', 'side-right', 'partition'],
    });
    // Each door's frame around its panel, clamped across its width.
    expect(op('doors/glue')).toMatchObject({
      count: 2,
      reach: 17.75,
      partIds: ['door-stile-outer', 'door-stile-inner', 'door-rail', 'door-panel'],
    });
  });

  it('chooses methods by how far the clamps open', () => {
    const long = chosen(inventory(60, 'sander'));
    expect([
      long['case/dry-fit'],
      long['case/glue'],
      long['top/glue'],
      long['case/finish'],
    ]).toEqual([
      'dry-fit-clamps',
      'glue-assembly-clamps',
      'glue-assembly-clamps',
      'finish-wipe-on',
    ]);
    // 24" clamps reach down the 14-3/4" for the top but not across the 52-1/2" case.
    const short = chosen(inventory(24));
    expect([
      short['case/dry-fit'],
      short['case/glue'],
      short['top/glue'],
      short['case/finish'],
    ]).toEqual(['dry-fit-by-hand', 'none', 'glue-assembly-clamps', 'finish-hand-sanded']);
  });

  it('says what clamps the case needs when none open far enough', () => {
    const steps = buildSteps(recordCabinet.steps(outputs), plan, inventory(24));
    const needed = steps.find((s) => s.id === 'case')?.operations[0]?.needed;
    expect(needed?.methodId).toBe('glue-assembly-clamps');
    expect(needed?.gaps).toEqual([
      {
        use: 'clamping the assembly',
        anyOf: ['Clamps with widest opening at least 52-1/2" (you entered 24")'],
      },
    ]);
  });

  it('fills the clamp reach into the method and flags the finish', () => {
    const steps = buildSteps(recordCabinet.steps(outputs), plan, inventory(60, 'sander'));
    const glue = steps.find((s) => s.id === 'case')?.operations[0]?.method;
    expect(glue?.setup[1]).toContain('Open the clamps past 52-1/2"');
    const finish = steps.find((s) => s.id === 'finish');
    expect(finish?.flags.map((f) => f.category)).toEqual(['finishes']);
    expect(finish?.operations[0]?.method?.safety[0]?.text).toContain('metal container');
  });

  it('draws the dry fit with every part, then adds the base, the case, and the top', () => {
    const drawings = stepDrawings(recordCabinet, outputs);
    const described = (id: string) =>
      drawings.find((d) => d.stepId === id)?.drawing.description ?? '';
    expect(drawings.map((d) => d.stepId)).toEqual([
      'panels',
      'dry-fit',
      'base',
      'cleats',
      'case',
      'top',
      'fasten',
      'doors',
    ]);
    expect(described('dry-fit')).toMatch(/^Fits A Top, .* together without glue\./);
    expect(described('base')).toMatch(/^Adds G Leg, H Front and back apron, I Side apron\./);
    // The case goes onto the base and its cleats, already glued up.
    expect(described('case')).toMatch(
      /^Adds B Case bottom, .*F Back rail, to G Leg, .*J Cleat already built\./,
    );
    expect(described('top')).toMatch(/^Adds A Top, to .* already built\./);
    expect(described('doors')).toMatch(
      /^Adds K Outer stile, L Inner stile, M Door rail, N Door panel, to /,
    );
  });
});
