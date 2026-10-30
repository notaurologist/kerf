import { z } from 'zod';
import { CutListRow, cutList } from '../../outputs/cutList.ts';
import { HardwareLine, hardwareList } from '../../outputs/hardwareList.ts';
import { LumberPlan, planLumber } from '../../outputs/shoppingList.ts';
import type { SnapshotUpgrade, TemplateDefinition } from '../definition.ts';
import { withLetters } from '../letters.ts';
import { drawings } from './drawings.ts';
import { EXAMPLES } from './examples.ts';
import { SWING_SET_FORM } from './form.ts';
import { SwingSetParams } from './params.ts';
import { stepOutline } from './steps.ts';
import {
  SwingSetStructuralInputs,
  SwingSetStructuralReview,
  structuralReview,
} from './structural.ts';
import { generate, SwingSetOutput, TEMPLATE_ID, TEMPLATE_VERSION } from './template.ts';

/** Everything a swing-set project snapshot holds besides its parameters and inputs. */
export const SwingSetOutputs = z.object({
  design: SwingSetOutput,
  cutList: z.array(CutListRow),
  lumber: LumberPlan,
  hardware: z.array(HardwareLine),
  structuralReview: SwingSetStructuralReview,
});
export type SwingSetOutputs = z.infer<typeof SwingSetOutputs>;

/**
 * Shape 4 to 5: letters each stored part and its cut-list row by position. The cut list is made
 * from the parts in order, so row i is part i and gets the same letter a regeneration would give.
 */
const addPartLetters: SnapshotUpgrade = (snapshot) => {
  const outputs = snapshot.outputs as {
    design: { parts: object[] };
    cutList: object[];
  };
  return {
    ...snapshot,
    outputs: {
      ...outputs,
      design: { ...outputs.design, parts: withLetters(outputs.design.parts) },
      cutList: withLetters(outputs.cutList),
    },
  };
};

export const swingSetAFrame: TemplateDefinition<
  SwingSetParams,
  SwingSetStructuralInputs,
  SwingSetOutputs
> = {
  id: TEMPLATE_ID,
  version: TEMPLATE_VERSION,
  name: 'Two-swing A-frame swing set',
  params: SwingSetParams,
  structuralInputs: SwingSetStructuralInputs,
  outputs: SwingSetOutputs,
  form: SWING_SET_FORM,
  // One fixture per stored shape, snapshots/v<n>.json (decision 0014). Shape 2 adds sources to
  // the hanger check's inputs (#36). Shape 3 adds part placements (#49). Shape 4 adds holes,
  // bolt areas, tapers, reference edges, and each end cut's reference (#50). Those fields are
  // optional, so plans stored before them read as they are and keep their numbers. Shape 5 adds
  // part letters (#66), derived from the stored order of the parts, which is the cut-list order.
  // Shape 6 adds the bolt layout and each board's distance past the legs (#93); both optional.
  // Shape 7 adds each part's board selection guides and the lumber plan's copy of them (#53);
  // both optional. Shape 8 adds operations (#103), optional.
  snapshotVersion: 8,
  snapshotUpgrades: {
    1: (snapshot) => snapshot,
    2: (snapshot) => snapshot,
    3: (snapshot) => snapshot,
    4: addPartLetters,
    5: (snapshot) => snapshot,
    6: (snapshot) => snapshot,
    7: (snapshot) => snapshot,
  },
  examples: EXAMPLES,
  steps: (outputs) => stepOutline(outputs.design),
  plan(outputs) {
    const review = outputs.structuralReview;
    return {
      cutList: outputs.cutList,
      lumber: outputs.lumber,
      hardware: outputs.hardware,
      hardwareNotes: outputs.design.hardwareNotes,
      flags: outputs.design.flags,
      checks: [review.beam.bending, review.beam.shear, review.beam.deflection, review.hanger],
      checklist: review.checklist,
      boltLayout: outputs.design.boltLayout ?? [],
      operations: outputs.design.operations ?? [],
    };
  },
  drawings,
  generate(params, structuralInputs) {
    const design = generate(params);
    if (!design.ok) return design;
    const review = structuralReview(design.output, structuralInputs);
    if (!review.ok) return review;
    return {
      ok: true,
      output: {
        design: design.output,
        cutList: cutList(design.output.parts),
        lumber: planLumber(design.output.parts),
        hardware: hardwareList(design.output.hardware),
        structuralReview: review.review,
      },
    };
  },
};
