import type { z } from 'zod';
import type { TemplateForm } from './form.ts';
import type { GenerateResult } from './types.ts';

/** Turns a stored snapshot of one shape version into the next (decision 0014). */
export type SnapshotUpgrade = (snapshot: Record<string, unknown>) => Record<string, unknown>;

/**
 * What generic code needs from a template to make and read project snapshots. Each template
 * exports one, and `templates/index.ts` lists them, so nothing outside a template's folder has to
 * know what it builds (ARCHITECTURE.md, principle 6).
 */
export interface TemplateDefinition<Params = unknown, Inputs = unknown, Outputs = unknown> {
  id: string;
  /** Bumped whenever output for the same parameters would change (decision 0008). */
  version: number;
  name: string;
  params: z.ZodType<Params>;
  /** Structural inputs. Every one is optional: a missing input makes its checks "input needed". */
  structuralInputs: z.ZodType<Inputs>;
  /** How the parameters and structural inputs are entered, for the web app's editor. */
  form: TemplateForm;
  /** Everything this version generates, as stored in a project snapshot. */
  outputs: z.ZodType<Outputs>;
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
  /** Worked examples, used to write each shape version's fixture and to test its shape. */
  examples: readonly { name: string; params: Params; structuralInputs: Inputs }[];
}
