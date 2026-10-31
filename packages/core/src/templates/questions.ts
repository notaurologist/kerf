// Starting questions (#163): a third way to start a project, beside a worked example and an
// earlier project. A template asks a few plain questions as form data and suggests starting
// parameters from the answers with a pure function. Generic: nothing here knows what the
// questions are about. Suggestions are template code, never AI (decision 0001).

import type { z } from 'zod';
import { lengthForEntry } from '../units/parse.ts';
import type { FormField, FormSection, FormSource, FormValues, TemplateForm } from './form.ts';
import { formValues } from './form.ts';

/**
 * Where a suggested value came from, shown beside it:
 * - `answer`: the owner's own answer, put straight in.
 * - `source`: a published source, cited.
 * - `convention`: a named convention for this kind of project.
 * - `example`: the template's worked example.
 * - `rule-of-thumb`: a rule with nothing better behind it, said in a few words.
 */
export type SuggestionBasis =
  | { kind: 'answer' }
  | { kind: 'source'; citation: string }
  | { kind: 'convention'; name: string }
  | { kind: 'example' }
  | { kind: 'rule-of-thumb'; rule: string };

export interface Suggestion {
  from: FormSource;
  /** The field's path in the template's form. */
  path: string;
  /** Null when no value fits the answers; `note` says why, and the field stays empty. */
  value: string | number | boolean | null;
  basis: SuggestionBasis;
  /** What the owner should know about this value, such as a limit the answers set on it. */
  note?: string;
}

/** A template's starting questions, as the web app renders and answers them. */
export interface StartingQuestions {
  /** The questions, entered like the template's own form. */
  form: readonly FormSection[];
  /** What a complete set of answers is. */
  answers: z.ZodType;
  /**
   * Pure: the same answers always give the same suggestions. Throws on answers the schema
   * rejects; parse them with `answers` first.
   */
  suggest(answers: unknown): Suggestion[];
}

/** Ties a template's answers schema to its suggestion function. */
export function startingQuestions<Answers>(questions: {
  form: readonly FormSection[];
  answers: z.ZodType<Answers>;
  suggest(answers: Answers): Suggestion[];
}): StartingQuestions {
  return {
    form: questions.form,
    answers: questions.answers,
    suggest: (answers) => questions.suggest(questions.answers.parse(answers)),
  };
}

/** The basis in words, for the line under a suggested field. */
export function describeBasis(basis: SuggestionBasis): string {
  switch (basis.kind) {
    case 'answer':
      return 'From your answers.';
    case 'source':
      return `Source: ${basis.citation}.`;
    case 'convention':
      return `Convention: ${basis.name}.`;
    case 'example':
      return "From the template's worked example.";
    case 'rule-of-thumb':
      return `Rule of thumb: ${basis.rule}.`;
  }
}

/** A suggestion as the editor shows it: the form's text for it, and where it came from. */
export interface SuggestedField {
  /** The form text the suggestion fills in; empty when there was no value to suggest. */
  text: string;
  /** `describeBasis`, then the note. */
  about: string;
}

/**
 * The form's starting values from suggestions, and what to say beside each suggested field,
 * keyed `${from} ${path}`. Fields with no suggestion start empty. Lengths are written as the form
 * writes a stored length (`lengthForEntry`). A suggestion for a path the form lacks throws: it is
 * a mistake in the template.
 */
export function suggestedValues(
  form: TemplateForm,
  suggestions: readonly Suggestion[],
): { params: FormValues; inputs: FormValues; about: ReadonlyMap<string, SuggestedField> } {
  const values: Record<FormSource, Record<string, string>> = {
    params: { ...formValues(form.params, {}) },
    structuralInputs: { ...formValues(form.structuralInputs, {}) },
  };
  const about = new Map<string, SuggestedField>();
  for (const s of suggestions) {
    const field = findField(form[s.from], s.path);
    if (!field) throw new Error(`No ${s.from} field at ${s.path} to suggest a value for.`);
    const text = s.value === null ? '' : entryText(field, s.value);
    values[s.from][s.path] = text;
    about.set(`${s.from} ${s.path}`, {
      text,
      about: [describeBasis(s.basis), s.note].filter(Boolean).join(' '),
    });
  }
  return { params: values.params, inputs: values.structuralInputs, about };
}

function findField(sections: readonly FormSection[], path: string): FormField | undefined {
  return sections.flatMap((s) => s.fields).find((f) => f.path === path);
}

function entryText(field: FormField, value: string | number | boolean): string {
  return field.kind === 'length' && typeof value === 'number'
    ? lengthForEntry(value)
    : String(value);
}
