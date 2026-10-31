import { describe, expect, it } from 'vitest';
import { enteredValues } from '../../model/form.ts';
import { planDigests } from '../../outputs/digests.ts';
import { createSnapshot } from '../../snapshot/index.ts';
import { buildSteps } from '../../steps/build.ts';
import { swingSetAFrame } from './definition.ts';
import { EXAMPLES } from './examples.ts';

// The summary's line for each section (#156), for the worked example in
// docs/templates/swing-set-a-frame.md, counted by hand from the spec:
// - Cut list: five parts (beam, back leg, front leg, crossbar, gusset); one beam and two of each
//   of the others, so 1 + 2 + 2 + 2 + 2 = 9 pieces.
// - Boards (Worked example, the boards): the beam alone on a 12' 4x6, each leg on its own 12'
//   4x4, both crossbars on a 10' 2x6, both gussets on an 8' 2x8: 1 + 4 + 1 + 1 = 7 boards
//   holding the 9 pieces.
// - Shopping list: those boards in four sizes (4x6 12', 4x4 12', 2x6 10', 2x8 8').
// - Build steps: one cutting step per board (7), then the template's four (ease the edges, dig the
//   leg holes, bolt the crossbars and gussets, bolt the beam): 11.
// - Hardware: the two bolt lengths (leg to beam, boards to legs), washers, nuts, bolt caps,
//   hangers, and seats with chain: 7 lines.
// - Structural review: four checks (bending, shear, deflection, hanger); the lowest margin is
//   bending, 1.08 (spec, Structural model), shown to one place. Six expert checks: the leg-to-beam
//   bolt, sloped ground, burial, the crossbar's and the gusset's edge distances, and the
//   projecting board ends. Seven checklist items (spec, Confirmation checklist).

function made(index: number) {
  const example = EXAMPLES[index];
  const snapshot = createSnapshot(swingSetAFrame, example?.params, example?.structuralInputs);
  if (!snapshot.ok) throw new Error('The worked example does not generate.');
  const outputs = swingSetAFrame.outputs.parse(snapshot.output.outputs);
  const plan = swingSetAFrame.plan(outputs);
  return { snapshot: snapshot.output, outputs, plan };
}

describe('section digests', () => {
  const { snapshot, outputs, plan } = made(0);
  const digests = planDigests(plan, {
    drawings: swingSetAFrame.drawings(outputs),
    steps: buildSteps(swingSetAFrame.steps(outputs), plan, { tools: [], other: [] }),
    structuralInputs: enteredValues(
      swingSetAFrame.form.structuralInputs,
      snapshot.structuralInputs,
    ),
  });

  it('count the parts and pieces, the boards, and the lines to buy', () => {
    expect(digests.cutList).toBe('5 parts, 9 pieces');
    expect(digests.boards).toBe('9 pieces from 7 boards');
    expect(digests.shoppingList).toBe('4 lumber lines, 7 hardware lines');
  });

  it('give the checks with the lowest margin, the expert checks, and the items to confirm', () => {
    expect(digests.structuralReview).toBe(
      '4 checks, lowest margin 1.1x · 6 expert checks · 7 items to confirm',
    );
  });

  it('count the build steps, cutting first', () => {
    expect(digests.buildSteps).toBe('11 steps: 7 boards to cut, then 4 more');
  });

  it('name the drawings', () => {
    expect(digests.diagrams).toBe('Assembled, exploded, and site views · 5 cut details');
  });

  it('say every structural input is entered', () => {
    expect(digests.parameters).toBe('Every structural input entered');
  });

  it('say how many checks and inputs are waiting when none is entered', () => {
    const example = EXAMPLES[0];
    const none = createSnapshot(swingSetAFrame, example?.params, {});
    if (!none.ok) throw new Error('The worked example does not generate without inputs.');
    const empty = planDigests(
      swingSetAFrame.plan(swingSetAFrame.outputs.parse(none.output.outputs)),
      {
        structuralInputs: enteredValues(swingSetAFrame.form.structuralInputs, {}),
      },
    );
    expect(empty.structuralReview).toBe(
      '4 checks, 4 need structural inputs · 6 expert checks · 7 items to confirm',
    );
    // The form's nine: species and grade, incised, moisture content, the heaviest rider on each
    // swing, swing angle, dynamic factor, deflection limit, and hanger rating.
    expect(empty.parameters).toBe('9 of 9 structural inputs needed');
    expect(empty.diagrams).toBeNull();
    expect(empty.buildSteps).toBeNull();
  });
});
