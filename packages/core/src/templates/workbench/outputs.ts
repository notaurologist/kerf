import { z } from 'zod';
import { CutListRow } from '../../outputs/cutList.ts';
import { HardwareLine } from '../../outputs/hardwareList.ts';
import { LumberPlan } from '../../outputs/shoppingList.ts';
import { WorkbenchReview } from './structural.ts';
import { WorkbenchDesign } from './template.ts';

/** Everything a workbench's project snapshot holds besides its parameters and inputs. */
export const WorkbenchOutputs = z.object({
  design: WorkbenchDesign,
  cutList: z.array(CutListRow),
  lumber: LumberPlan,
  hardware: z.array(HardwareLine),
  review: WorkbenchReview,
});
export type WorkbenchOutputs = z.infer<typeof WorkbenchOutputs>;
