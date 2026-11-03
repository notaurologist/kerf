import type { FormSource, TemplateForm } from '@kerf/core';

// The ids of the editor's field controls, which the error summary, the progress links, and links
// from the plan to an input it needs point to.

/** The id of a field's control in the editor. */
export const fieldId = (from: FormSource, path: string) =>
  `${from === 'params' ? 'p' : 's'}-${path}`;

/**
 * The editor field for an input a check names as missing, by its key: the field with that path, or
 * the first one under it, such as `moisture.low` for `moisture`. Structural inputs first, then
 * parameters, such as a hardware size read at the store.
 */
export function inputFieldId(form: TemplateForm, key: string): string | undefined {
  const matches = (f: { path: string }) => f.path === key || f.path.startsWith(`${key}.`);
  for (const from of ['structuralInputs', 'params'] as const) {
    const field = form[from].flatMap((section) => section.fields).find(matches);
    if (field) return fieldId(from, field.path);
  }
  return undefined;
}
