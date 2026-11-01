import { describe, expect, it } from 'vitest';
import type { Inventory } from '../../inventory/tools.ts';
import { buildSteps } from '../../steps/build.ts';
import { stepDrawings } from '../../steps/drawings.ts';
import { recordCabinet } from './definition.ts';
import { WORKED_EXAMPLE } from './examples.ts';

// The worked example's build steps after the cutting steps (spec, Build steps), through fitting,
// gluing, and finishing. Its case is W − 2·o_s = 54 − 1.5 = 52-1/2" wide, and the top stands
// H = 20" above the floor, so the clamps must open that far across the case and from the top down.

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
  it('runs from the joinery to a dry fit, the case, the top, easing, and finishing', () => {
    const ids = recordCabinet.steps(outputs).map((s) => s.id);
    expect(ids.slice(ids.indexOf('feet'))).toEqual([
      'feet',
      'dry-fit',
      'case',
      'top',
      'ease',
      'finish',
    ]);
  });

  it('clamps across the 52-1/2" case and down the 20" height', () => {
    const op = (id: string) => outputs.design.operations.find((o) => o.id === id);
    expect(op('case/dry-fit')).toMatchObject({ reach: 52.5 });
    expect(op('case/glue')).toMatchObject({
      reach: 52.5,
      partIds: ['side-left', 'side-right', 'partition', 'shelf', 'rail'],
    });
    expect(op('top/glue')).toMatchObject({
      reach: 20,
      partIds: ['top', 'side-left', 'side-right', 'partition'],
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
    // 24" clamps reach down the 20" height for the top but not across the 52-1/2" case.
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

  it('draws the dry fit with every part, then adds the case, then the top', () => {
    const drawings = stepDrawings(recordCabinet, outputs);
    const described = (id: string) =>
      drawings.find((d) => d.stepId === id)?.drawing.description ?? '';
    expect(drawings.map((d) => d.stepId)).toEqual(['panels', 'dry-fit', 'case', 'top']);
    expect(described('dry-fit')).toMatch(/^Fits A Top, .* together without glue\./);
    expect(described('case')).toMatch(/^Adds B Left side, .*F Back rail\./);
    expect(described('top')).toMatch(/^Adds A Top, to .* already built\./);
  });
});
