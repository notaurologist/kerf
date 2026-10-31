import type { z } from 'zod';
import type { Drawings, Explode, Isometric, Scene } from '../geometry/index.ts';
import type { Plan } from '../outputs/plan.ts';
import type { StepOutline } from '../steps/build.ts';
import type { TemplateForm } from './form.ts';
import type { StartingQuestions } from './questions.ts';
import type { GenerateResult } from './types.ts';

/** Turns a stored snapshot of one shape version into the next (decision 0014). */
export type SnapshotUpgrade = (snapshot: Record<string, unknown>) => Record<string, unknown>;

/**
 * What generic code needs from a template to make and read project snapshots. Each template
 * exports one, and `templates/index.ts` lists them, so nothing outside a template's folder has to
 * know what it builds (ARCHITECTURE.md, principle 6).
 *
 * `Outputs` is what `generate` makes now. `StoredOutputs` is what a stored snapshot of any shape
 * holds once upgraded (decision 0014): the same, except for fields older shapes lack. Everything
 * that reads a snapshot takes `StoredOutputs`, and the template fills in what generic code needs.
 */
export interface TemplateDefinition<
  Params = unknown,
  Inputs = unknown,
  StoredOutputs = unknown,
  Outputs extends StoredOutputs = StoredOutputs,
> {
  id: string;
  /** Bumped whenever output for the same parameters would change (decision 0008). */
  version: number;
  name: string;
  /**
   * Words only this template's folder uses, such as the names of its parts, so a test can check
   * that generic code never mentions them (ARCHITECTURE.md, principle 6). Its ID is checked too.
   */
  ownWords: readonly string[];
  params: z.ZodType<Params>;
  /** Structural inputs. Every one is optional: a missing input makes its checks "input needed". */
  structuralInputs: z.ZodType<Inputs>;
  /** How the parameters and structural inputs are entered, for the web app's editor. */
  form: TemplateForm;
  /** Everything this version generates. Every field generic code reads is required. */
  outputs: z.ZodType<Outputs>;
  /**
   * Reads the outputs of a stored snapshot, after its upgrades. Relaxes only the fields that
   * snapshots stored in an older shape lack; a template with one shape uses `outputs`.
   */
  storedOutputs: z.ZodType<StoredOutputs>;
  /**
   * The outputs in the shape every display shares. Picks values out and fills in what an older
   * snapshot lacks, such as an empty list; never computes.
   */
  plan(outputs: StoredOutputs): Plan;
  /**
   * The plan's drawings (#90), drawn from stored outputs: a view of the numbers already there,
   * so they are not stored and a plan's drawings show the numbers it was made with.
   */
  drawings(outputs: StoredOutputs): Drawings;
  /**
   * What the 3D views are drawn from, as data: the scene, the viewpoint, and how parts are pulled
   * apart. Generic code draws each assembly step's action drawing from it (#118). Null for a plan
   * made before placements, which has no 3D views.
   */
  assembly(outputs: StoredOutputs): { scene: Scene; view: Isometric; explode: Explode[] } | null;
  /**
   * The order of the build steps (#105), as groups of the plan's operation IDs. Like drawings, made
   * from stored outputs on read; generic code chooses each operation's method from the inventory.
   */
  steps(outputs: StoredOutputs): StepOutline[];
  /** Pure: the same parameters and inputs always give the same outputs. */
  generate(params: Params, structuralInputs: Inputs): GenerateResult<Outputs>;
  /**
   * The shape of this template's stored snapshot. Bumped, with an upgrade and a new fixture,
   * whenever the shape changes (decision 0014). Independent of `version`: a new template version
   * can change numbers without changing the shape, and the reverse.
   */
  snapshotVersion: number;
  /**
   * `snapshotUpgrades[n]` turns a shape-n snapshot into shape n + 1. Upgrades only restructure
   * what is stored; they never recompute, so an old plan keeps its numbers.
   */
  snapshotUpgrades: Readonly<Record<number, SnapshotUpgrade>>;
  /**
   * Worked examples, used to write each shape version's fixture and to test its shape. One with a
   * `start` is also offered as a new project's starting point under that name (#98): its
   * parameters only, since structural inputs are never filled in for the owner (hard rule 3).
   */
  examples: readonly {
    name: string;
    start?: string;
    params: Params;
    structuralInputs: Inputs;
  }[];
  /**
   * A few plain questions whose answers suggest starting parameters (#163). Offered as a new
   * project's start when present. Only the answers that are structural inputs themselves are
   * filled in as inputs; hardware and the other inputs are never suggested (hard rule 3).
   */
  questions?: StartingQuestions;
}
