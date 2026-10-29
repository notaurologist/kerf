import type { FormField, FormSection, FormValues, TemplateDefinition } from '@kerf/core';
import { schemaProblemMessage, visibleFields } from '@kerf/core';
import type { FieldIssue } from '../../lib/api.ts';

// Problems with a form, pointed at the field they concern. Zod issues from core's schemas carry
// full paths; issues from the API's 422 name only top-level parameters, so both are matched to
// the nearest visible field.

/** The error core's schemas report, typed without importing Zod into the web app. */
type SchemaError = Extract<
  ReturnType<TemplateDefinition['params']['safeParse']>,
  { success: false }
>['error'];
type SchemaIssue = SchemaError['issues'][number];

export interface FormIssues {
  /** By field path. */
  fields: Record<string, string>;
  /** Problems no visible field matches. */
  general: string[];
}

export const NO_ISSUES: FormIssues = { fields: {}, general: [] };

/** The visible field an issue at `path` belongs to: the field itself, or the first under it. */
function fieldFor(fields: readonly FormField[], path: string): FormField | undefined {
  return (
    fields.find((f) => f.path === path) ??
    fields.find((f) => f.path.startsWith(`${path}.`)) ??
    fields.find((f) => path.startsWith(`${f.path}.`))
  );
}

export function placeIssues(
  sections: readonly FormSection[],
  values: FormValues,
  issues: readonly FieldIssue[],
): FormIssues {
  const fields = visibleFields(sections, values);
  const placed: FormIssues = { fields: {}, general: [] };
  for (const issue of issues) {
    const field = issue.field ? fieldFor(fields, issue.field) : undefined;
    if (field && !placed.fields[field.path]) placed.fields[field.path] = issue.message;
    else if (!field) placed.general.push(issue.message);
  }
  return placed;
}

/** True when an issue's path falls within the given form's fields. */
export function belongsTo(sections: readonly FormSection[], path: string): boolean {
  const all = sections.flatMap((s) => s.fields);
  return fieldFor(all, path) !== undefined;
}

/** Plain words for a schema problem with no single field, given what was typed. */
function message(issue: SchemaIssue, text: string): string {
  if (text.trim() === '') return 'Enter a value.';
  switch (issue.code) {
    case 'invalid_value':
    case 'invalid_union':
      return 'Choose one of the options.';
    default:
      return issue.message;
  }
}

/**
 * Issues from parsing a built form with its schema, by dotted path. Core words each one for its
 * field (content guide: say what to enter, with limits in the field's units).
 */
export function schemaIssues(
  error: SchemaError,
  values: FormValues,
  sections: readonly FormSection[],
  schema: TemplateDefinition['params'] | TemplateDefinition['structuralInputs'],
): FieldIssue[] {
  const fields = sections.flatMap((s) => s.fields);
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join('.');
    const text = values[path] ?? '';
    const field = fields.find((f) => f.path === path);
    return {
      field: path,
      message: field ? schemaProblemMessage(field, issue, text, schema) : message(issue, text),
    };
  });
}
