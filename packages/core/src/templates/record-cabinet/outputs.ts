import { z } from 'zod';
import { CutListRow } from '../../outputs/cutList.ts';
import { HardwareLine } from '../../outputs/hardwareList.ts';
import { LumberPlan } from '../../outputs/shoppingList.ts';
import { CabinetGeometry } from './geometry.ts';
import { StoredRecordCabinetParams } from './params.ts';
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

/**
 * Outputs as stored: a plan from before the leg base (template version 8, #338) has no legs,
 * aprons, or cleats, so no lengths for them, and its design holds its parameters as stored.
 */
export const StoredRecordCabinetOutputs = RecordCabinetOutputs.extend({
  design: CabinetDesign.extend({
    params: StoredRecordCabinetParams,
    geometry: CabinetGeometry.partial({
      legLength: true,
      longApron: true,
      shortApron: true,
      cleatLength: true,
    }),
  }),
});
export type StoredRecordCabinetOutputs = z.infer<typeof StoredRecordCabinetOutputs>;
