import type { BoltJoint } from '../structural/boltDistances.ts';
import type { CheckResult } from '../structural/types.ts';
import type { Operation } from '../templates/operations.ts';
import type { ChecklistItem, Flag } from '../templates/types.ts';
import type { CutListRow } from './cutList.ts';
import type { HardwareLine } from './hardwareList.ts';
import type { LumberPlan } from './shoppingList.ts';

/**
 * A project's generated outputs in the shape every template shares, for displays that know no
 * template (ARCHITECTURE.md, principle 6). Each template maps its stored outputs to this; the
 * mapping only picks values out, it never computes.
 */
export interface Plan {
  cutList: CutListRow[];
  lumber: LumberPlan;
  hardware: HardwareLine[];
  /** Notes to show with the hardware list. */
  hardwareNotes: readonly string[];
  /** Expert-check flags on the design. */
  flags: Flag[];
  /** Sanity checks, in the order to show them. */
  checks: CheckResult[];
  checklist: ChecklistItem[];
  /** Each bolted joint's distances against NDS 2024 (#93). Empty for plans made before it. */
  boltLayout: BoltJoint[];
  /** What needs doing to each part and on the site (#103). Empty for plans made before it. */
  operations: Operation[];
}
