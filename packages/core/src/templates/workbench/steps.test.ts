import { describe, expect, it } from 'vitest';
import { boardCuts } from '../../model/operations.ts';
import { workbench } from './definition.ts';
import { WORKED_EXAMPLE } from './examples.ts';

// The worked example's build steps (spec, Build steps): glue up and flatten the top and the other
// strip glue-ups, cut the joinery, fit the bench together dry, build the end frames and join them,
// build the case, the drawers, and the doors, then bore for the vises and the dog holes.

const made = workbench.generate(WORKED_EXAMPLE, {});
if (!made.ok) throw new Error('worked example does not generate');
const outputs = made.output;
const steps = workbench.steps(outputs);
const ops = outputs.design.operations;

describe('building the workbench', () => {
  it('runs in the spec’s order', () => {
    expect(steps.map((s) => s.id)).toEqual([
      'settle',
      'strips',
      'panels',
      'plane',
      'size',
      'mortises',
      'tenons',
      'dadoes',
      'dovetails',
      'door-joints',
      'holes',
      'dry-fit',
      'end-frames',
      'frame',
      'case',
      'drawers',
      'drawer-screws',
      'doors',
      'vises',
      'ease',
      'finish',
    ]);
  });

  it('places every operation but the board cuts in exactly one step', () => {
    const cuts = new Set(boardCuts(ops).map((op) => op.id));
    const placed = steps.flatMap((s) => s.operationIds);
    expect(new Set(placed).size).toBe(placed.length);
    expect(placed.sort()).toEqual(
      ops
        .filter((op) => !cuts.has(op.id))
        .map((op) => op.id)
        .sort(),
    );
  });

  it('bores the dog holes and the vises’ holes after the bench is together', () => {
    const vises = steps.find((s) => s.id === 'vises')?.operationIds ?? [];
    const bored = ops.filter((op) => op.type === 'bore' || op.type === 'stopped-bore');
    expect(vises.sort()).toEqual(bored.map((op) => op.id).sort());
    // One operation for each size of hole in a part: the screw's, the guide bars', and on the end
    // chop a dog hole; through and stopped dog holes in the top.
    expect(bored.map((op) => 'partId' in op && op.partId).sort()).toEqual([
      'end-chop',
      'end-chop',
      'end-chop',
      'face-chop',
      'face-chop',
      'leg-vise',
      'leg-vise',
      'top',
      'top',
      'vise-block',
      'vise-block',
    ]);
  });

  it('cuts the case bottom’s rabbets for the sides across its ends', () => {
    const rabbets = ops.filter((op) => op.type === 'end-rabbet');
    expect(rabbets.map((op) => 'partId' in op && op.partId)).toEqual([
      'case-bottom',
      'case-bottom',
    ]);
    expect(steps.find((s) => s.id === 'dadoes')?.operationIds).toEqual(
      expect.arrayContaining(rabbets.map((op) => op.id)),
    );
  });
});
