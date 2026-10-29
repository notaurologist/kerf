import { z } from 'zod';
import { CutListRow, cutList } from '../../outputs/cutList.ts';
import { HardwareLine, hardwareList } from '../../outputs/hardwareList.ts';
import { LumberPlan, planLumber } from '../../outputs/shoppingList.ts';
import type { TemplateDefinition } from '../definition.ts';
import { EXAMPLES } from './examples.ts';
import { SWING_SET_FORM } from './form.ts';
import { SwingSetParams } from './params.ts';
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
  // the hanger check's inputs (#36). Shape 3 adds part placements (#49). Both fields are
  // optional, so plans stored before them read as they are and keep their numbers.
  snapshotVersion: 3,
  snapshotUpgrades: { 1: (snapshot) => snapshot, 2: (snapshot) => snapshot },
  examples: EXAMPLES,
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
    };
  },
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
