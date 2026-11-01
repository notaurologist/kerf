import type { TemplateDefinition } from '../model/definition.ts';
import { recordCabinet } from './record-cabinet/definition.ts';
import { swingSetAFrame } from './swing-set-a-frame/definition.ts';

export * as recordCabinet from './record-cabinet/index.ts';
export * as swingSetAFrame from './swing-set-a-frame/index.ts';

/** Every template the app offers, at its current version. */
export const TEMPLATES: readonly TemplateDefinition[] = [
  swingSetAFrame,
  recordCabinet as TemplateDefinition,
];

export function findTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
