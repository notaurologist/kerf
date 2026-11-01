import { z } from 'zod';
import { CutListRow } from '../../outputs/cutList.ts';
import { HardwareLine } from '../../outputs/hardwareList.ts';
import { LumberPlan } from '../../outputs/shoppingList.ts';
import { RecordCabinetReview } from './structural.ts';
import { CabinetDesign } from './template.ts';

/** Everything a record cabinet's project snapshot holds besides its parameters and inputs. */
export const RecordCabinetOutputs = z.object({
  design: CabinetDesign,
  cutList: z.array(CutListRow),
  lumber: LumberPlan,
  hardware: z.array(HardwareLine),
  review: RecordCabinetReview,
});
export type RecordCabinetOutputs = z.infer<typeof RecordCabinetOutputs>;
