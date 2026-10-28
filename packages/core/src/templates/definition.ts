import type { z } from 'zod';
import type { GenerateResult } from './types.ts';

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
  /** Everything this version generates, as stored in a project snapshot. */
  outputs: z.ZodType<Outputs>;
  /** Pure: the same parameters and inputs always give the same outputs. */
  generate(params: Params, structuralInputs: Inputs): GenerateResult<Outputs>;
}
