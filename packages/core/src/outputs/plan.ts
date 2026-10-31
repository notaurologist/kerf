import type { Operation } from '../model/operations.ts';
import type { ChecklistItem, EndCut, Flag } from '../model/types.ts';
import type { BoltJoint } from '../structural/boltDistances.ts';
import type { CheckResult } from '../structural/types.ts';
import type { CutListRow } from './cutList.ts';
import type { HardwareLine } from './hardwareList.ts';
import type { LumberPlan } from './shoppingList.ts';

/**
 * A project's generated outputs in the shape every template shares, for displays that know no
 * template (ARCHITECTURE.md, principle 6). Each template maps its stored outputs to this; the
 * mapping only picks values out, it never computes.
 */
/** A result the template counts as key, for the plan's summary (#119): formatted by core. */
export interface KeyResult {
  /** Such as a part's name. */
  label: string;
  /** Such as a length with its stock, or a saw setting with the angle to the edge. */
  value: string;
}

export interface Plan {
  /**
   * The results that say most about this design at a glance, chosen by the template and in its
   * order, for the top of the plan (#119). Picked from stored values and formatted by core.
   */
  keyResults: KeyResult[];
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
  /**
   * Each part's end cuts as the template describes them, and the edge its angles are laid out
   * from, for the cut card (#132). Picked from the stored parts; the cut list holds the same ends
   * already formatted. A stored plan that does not say which edge, or what an angle is measured
   * from, leaves it out, and the cut card does not say either.
   */
  cutEnds: {
    partId: string;
    /** Such as "inner edge, against the beam". */
    referenceEdge?: string;
    ends: { description: string; measuredFrom?: EndCut['measuredFrom'] }[];
  }[];
}
