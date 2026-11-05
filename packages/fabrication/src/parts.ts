import { findTemplate, type Part } from '@kerf/core';

/**
 * The parts of one of a template's worked examples, by the example's position in its list, as
 * core generates them. Throws when the template, the example, or its plan is not there.
 */
export function exampleParts(templateId: string, example = 0): readonly Part[] {
  const template = findTemplate(templateId);
  if (!template) throw new Error(`No template ${templateId}`);
  const chosen = template.examples[example];
  if (!chosen) throw new Error(`${templateId} has no example ${example}`);
  const result = template.generate(chosen.params, chosen.structuralInputs);
  if (!result.ok) throw new Error(`${templateId} example ${example} did not generate`);
  const assembly = template.assembly(result.output);
  if (!assembly) throw new Error(`${templateId} example ${example} has no placements`);
  return assembly.scene.parts;
}
