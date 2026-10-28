import { z } from 'zod';
import { CutListRow, cutList } from '../../outputs/cutList.ts';
import { HardwareLine, hardwareList } from '../../outputs/hardwareList.ts';
import { LumberPlan, planLumber } from '../../outputs/shoppingList.ts';
import type { TemplateDefinition } from '../definition.ts';
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
