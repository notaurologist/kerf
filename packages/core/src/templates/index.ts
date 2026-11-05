import type { TemplateDefinition } from '../model/definition.ts';
import { recordCabinet } from './record-cabinet/definition.ts';
import { SWEEP as recordCabinetSweep } from './record-cabinet/sweep.ts';
import type { SweepPlan } from './sweep.ts';
import { swingSetAFrame } from './swing-set-a-frame/definition.ts';
import { SWEEP as swingSetSweep } from './swing-set-a-frame/sweep.ts';
import { workbench } from './workbench/definition.ts';
import { SWEEP as workbenchSweep } from './workbench/sweep.ts';

export * as recordCabinet from './record-cabinet/index.ts';
export * as swingSetAFrame from './swing-set-a-frame/index.ts';
export * as workbench from './workbench/index.ts';

/** Every template the app offers, at its current version. */
export const TEMPLATES: readonly TemplateDefinition[] = [
  swingSetAFrame,
  recordCabinet as TemplateDefinition,
  workbench as TemplateDefinition,
];

/**
 * Each template's seeded sweep, by template ID: run by its sweep.test.ts and by the script that
 * writes each version's digest (decision 0014).
 */
export const SWEEPS: Readonly<Record<string, SweepPlan>> = {
  [swingSetAFrame.id]: swingSetSweep,
  [recordCabinet.id]: recordCabinetSweep,
  [workbench.id]: workbenchSweep,
};

export function findTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
