import type { TemplateDefinition } from './definition.ts';
import { swingSetAFrame } from './swing-set-a-frame/definition.ts';

/** Every template the app offers, at its current version. */
export const TEMPLATES: readonly TemplateDefinition[] = [swingSetAFrame];

export function findTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
