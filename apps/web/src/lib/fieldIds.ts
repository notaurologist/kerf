import type { FormSource, TemplateForm } from '@kerf/core';

// The ids of the editor's field controls, which the error summary, the progress links, and links
// from the plan to an input it needs point to.

/** The id of a field's control in the editor. */
export const fieldId = (from: FormSource, path: string) =>
  `${from === 'params' ? 'p' : 's'}-${path}`;

/**
 * The editor field for an input a check names as missing, by its key: the structural input with
 * that path, or the first one under it, such as `moisture.low` for `moisture`; failing that, a
 * parameter with that path, such as a hardware rating entered beside its count.
 */
export function inputFieldId(form: TemplateForm, key: string): string | undefined {
  const field = form.structuralInputs
    .flatMap((section) => section.fields)
    .find((f) => f.path === key || f.path.startsWith(`${key}.`));
  if (field) return fieldId('structuralInputs', field.path);
  const param = form.params.flatMap((section) => section.fields).find((f) => f.path === key);
  return param && fieldId('params', param.path);
}
