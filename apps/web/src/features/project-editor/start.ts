import { confirmedPaths, type FormValues, formValues, type TemplateDefinition } from '@kerf/core';
import { newProjectLabel } from '../../lib/names.ts';
import type { ProjectStart } from '../../lib/route.ts';
import type { Project, ProjectStatus } from '../../lib/types.ts';

// What the editor starts from: a project's values, or a new project's start (#98, #358).

export interface EditorValues {
  name: string;
  /** An existing project's status, which follows progress and can be set here (#355). */
  status?: ProjectStatus;
  params: FormValues;
  inputs: FormValues;
}

/**
 * Values copied from an earlier project that the owner confirms before saving (#98, hard rule 3):
 * the form's confirmed parameters, such as hardware sizes, and the structural
 * inputs.
 */
export interface Copied {
  from: string;
  params: FormValues;
  inputs: FormValues;
}

/** The values of `values` at `paths` only. */
const only = (values: FormValues, paths: ReadonlySet<string>): FormValues =>
  Object.fromEntries(Object.entries(values).filter(([path]) => paths.has(path)));

/**
 * A new project's first values. A worked example gives its parameters, except those the owner
 * enters or confirms, and no structural inputs: those are never filled in for the owner (hard
 * rule 3). An earlier project gives every value, and those the owner confirms wait for it.
 */
export function startValues(
  template: TemplateDefinition,
  start: ProjectStart | undefined,
  source: Project | null,
): { ok: true; initial: EditorValues; copied?: Copied } | { ok: false; message: string } {
  const { form } = template;
  const empty = formValues(form.structuralInputs, {});
  if (start?.kind === 'example') {
    const example = template.examples[start.index];
    if (!example?.start) return { ok: false, message: 'There is no such example to start from.' };
    const confirm = confirmedPaths(form.params);
    const params = Object.fromEntries(
      Object.entries(formValues(form.params, example.params)).map(([path, text]) => [
        path,
        confirm.has(path) ? '' : text,
      ]),
    );
    return { ok: true, initial: { name: '', params, inputs: empty } };
  }
  if (start?.kind === 'questions') {
    return { ok: false, message: 'This template has no starting questions.' };
  }
  if (start?.kind === 'project') {
    if (!source || source.templateId !== template.id) {
      return { ok: false, message: "That project is not one of this template's." };
    }
    if (!source.snapshot) {
      return {
        ok: false,
        message: `${source.name}'s stored plan cannot be read, so it cannot be copied.`,
      };
    }
    const params = formValues(form.params, source.snapshot.params);
    const inputs = formValues(form.structuralInputs, source.snapshot.structuralInputs);
    return {
      ok: true,
      initial: { name: '', params, inputs },
      copied: { from: source.name, params: only(params, confirmedPaths(form.params)), inputs },
    };
  }
  return { ok: true, initial: { name: '', params: formValues(form.params, {}), inputs: empty } };
}

export const newTitle = (template: TemplateDefinition) => newProjectLabel(template.name);
