import type { TemplateDefinition } from './definition.ts';
import { confirmedPaths, type FormValues, formValues } from './form.ts';

/**
 * A new project's form values from a worked example offered as a start (#98): its parameters,
 * except those the owner enters or confirms, and no structural inputs. Those are never filled in
 * for the owner (hard rule 3). Null when the example is not offered as a start.
 */
export function exampleStart(
  template: TemplateDefinition,
  index: number,
): { params: FormValues; inputs: FormValues } | null {
  const example = template.examples[index];
  if (!example?.start) return null;
  const { form } = template;
  const confirm = confirmedPaths(form.params);
  const params = Object.fromEntries(
    Object.entries(formValues(form.params, example.params)).map(([path, text]) => [
      path,
      confirm.has(path) ? '' : text,
    ]),
  );
  return { params, inputs: formValues(form.structuralInputs, {}) };
}
