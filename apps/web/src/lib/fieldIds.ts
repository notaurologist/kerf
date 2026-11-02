import type { FormSource, TemplateForm } from '@kerf/core';

// The ids of the editor's field controls, which the error summary, the progress links, and links
// from the plan to an input it needs point to.

/** The id of a field's control in the editor. */
export const fieldId = (from: FormSource, path: string) =>
  `${from === 'params' ? 'p' : 's'}-${path}`;

/**
 * The editor field for a structural input a check names as missing, by its key: the field with
 * that path, or the first one under it, such as `moisture.low` for `moisture`.
 */
export function inputFieldId(form: TemplateForm, key: string): string | undefined {
  const field = form.structuralInputs
    .flatMap((section) => section.fields)
    .find((f) => f.path === key || f.path.startsWith(`${key}.`));
  return field && fieldId('structuralInputs', field.path);
}
