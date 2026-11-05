import { z } from 'zod';
import type { MovementResult } from '../movement/movement.ts';
import type { Plan } from '../outputs/plan.ts';
import type { BoltJoint } from '../structural/boltDistances.ts';
import type { CheckResult, Quantity } from '../structural/types.ts';
import type { TemplateDefinition } from './definition.ts';
import {
  enteredParts,
  type FormSection,
  type FormSource,
  formValues,
  readPath,
  type TemplateForm,
  writePath,
} from './form.ts';
import {
  describeBasis,
  entryText,
  findField,
  needsConfirming,
  type SuggestedField,
  type Suggestion,
  SuggestionBasis,
  suggestedValues,
} from './questions.ts';
import type { Issue } from './types.ts';

// Suggested structural inputs and hardware sizes, as a project stores them (hard rule 3 as
// amended, decision 0001, #417). A value Kerf suggested from a named source or a rule of thumb
// stays a suggestion, with its basis, until the owner confirms it in the structural review or
// changes it; saving the form does not confirm it. The server decides which values are
// suggestions, from the starting answers, so no client can store one as entered. A value not
// listed was entered by the owner.

export const SuggestedValue = z.object({
  from: z.enum(['params', 'structuralInputs']),
  /** The field's path in the template's form. */
  path: z.string(),
  basis: SuggestionBasis,
  /** True once the owner ticked it in the structural review. */
  confirmed: z.boolean(),
});
export type SuggestedValue = z.infer<typeof SuggestedValue>;

/** A field in a form, keyed as the editor keys its fields: `${from} ${path}`. */
export const suggestedKey = (field: { from: FormSource; path: string }) =>
  `${field.from} ${field.path}`;

const textAt = (sections: readonly FormSection[], object: unknown, path: string) =>
  formValues(sections, object)[path] ?? '';

/**
 * The suggestions a new project holds as it is created: those the template's questions make from
 * `answers` that wait for confirming, where the value created is still the one suggested (read as
 * form text, so a length written another way is the same value). A value the owner changed before
 * creating the project is entered.
 */
export function suggestedFor(
  template: TemplateDefinition,
  answers: unknown,
  params: unknown,
  structuralInputs: unknown,
): { ok: true; suggested: SuggestedValue[] } | { ok: false; issues: Issue[] } {
  const questions = template.questions;
  if (!questions) {
    return {
      ok: false,
      issues: [
        { code: 'no-questions', message: 'This template asks no questions.', params: ['answers'] },
      ],
    };
  }
  const parsed = questions.answers.safeParse(answers);
  if (!parsed.success) {
    return {
      ok: false,
      issues: [
        {
          code: 'invalid-answers',
          message: 'The starting answers do not read as answers to these questions.',
          params: ['answers'],
        },
      ],
    };
  }
  return {
    ok: true,
    suggested: waiting(template.form, questions.suggest(parsed.data), { params, structuralInputs }),
  };
}

type Values = { params: unknown; structuralInputs: unknown };

/**
 * Of these suggestions, those that wait for confirming and whose value is still the one suggested
 * (read as form text, so a length written another way is the same value).
 */
function waiting(
  form: TemplateForm,
  suggestions: readonly Suggestion[],
  values: Values,
): SuggestedValue[] {
  return suggestions.flatMap((s): SuggestedValue[] => {
    const field = findField(form[s.from], s.path);
    if (!field || s.value === null || !needsConfirming(form, s)) return [];
    if (textAt(form[s.from], values[s.from], s.path) !== entryText(field, s.value)) return [];
    return [{ from: s.from, path: s.path, basis: s.basis, confirmed: false }];
  });
}

const FILLED = 'Your plan was saved before Kerf asked for this, so Kerf suggests it.';

const copy = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null
    ? structuredClone(value as Record<string, unknown>)
    : {};

/**
 * A stored plan's values with each field it lacks filled from the template's `suggestMissing`,
 * and the suggestions filled. Upgrades never make up a value an older plan lacks, so the editor
 * and a regeneration start from these. A filled structural input or confirmed parameter stays a
 * suggestion until the owner confirms it; any other filled value is the owner's once saved, as a
 * new project's suggestions are.
 */
export function fillMissing(
  template: TemplateDefinition,
  stored: Values,
): Values & { filled: Suggestion[] } {
  const values = { params: copy(stored.params), structuralInputs: copy(stored.structuralInputs) };
  const filled = (template.suggestMissing?.(stored.params, stored.structuralInputs) ?? [])
    .filter(
      (s) =>
        s.value !== null &&
        findField(template.form[s.from], s.path) !== undefined &&
        readPath(stored[s.from], s.path) === undefined,
    )
    .map((s) => ({ ...s, note: s.note ? `${FILLED} ${s.note}` : FILLED }));
  for (const s of filled) writePath(values[s.from], s.path, s.value);
  return { ...values, filled };
}

/**
 * The suggestions a plan holds after a save or regeneration from `stored`: the stored ones it left
 * as they were, and the filled ones that wait for confirming and were left as filled.
 */
export function suggestedAfter(
  template: TemplateDefinition,
  stored: Values & { suggested: readonly SuggestedValue[] },
  after: Values,
): SuggestedValue[] {
  return [
    ...carrySuggested(template.form, stored.suggested, stored, after),
    ...waiting(template.form, fillMissing(template, stored).filled, after),
  ];
}

/** What the editor says under each filled field, keyed `${from} ${path}`. */
export function filledFields(
  form: TemplateForm,
  filled: readonly Suggestion[],
): ReadonlyMap<string, SuggestedField> {
  return suggestedValues(form, filled).about;
}

/**
 * The suggestions that stay after a save: each whose value the save left as it was. Changing a
 * value makes it entered, which confirms it; clearing it leaves nothing to confirm.
 */
export function carrySuggested(
  form: TemplateForm,
  previous: readonly SuggestedValue[],
  before: Values,
  after: Values,
): SuggestedValue[] {
  return previous.filter((s) => {
    const was = textAt(form[s.from], before[s.from], s.path);
    return was !== '' && was === textAt(form[s.from], after[s.from], s.path);
  });
}

export const SuggestedChange = z.object({
  from: z.enum(['params', 'structuralInputs']),
  path: z.string().min(1).max(200),
  confirmed: z.boolean(),
});
export type SuggestedChange = z.infer<typeof SuggestedChange>;

/** Confirms or unconfirms suggestions, or names the changes for values that are not suggestions. */
export function confirmSuggested(
  previous: readonly SuggestedValue[],
  changes: readonly SuggestedChange[],
):
  | { ok: true; suggested: SuggestedValue[] }
  | { ok: false; unknown: { from: FormSource; path: string }[] } {
  const known = new Set(previous.map(suggestedKey));
  const unknown = changes
    .filter((c) => !known.has(suggestedKey(c)))
    .map(({ from, path }) => ({ from, path }));
  if (unknown.length > 0) return { ok: false, unknown };
  const last = new Map(changes.map((c) => [suggestedKey(c), c.confirmed]));
  return {
    ok: true,
    suggested: previous.map((s) => ({ ...s, confirmed: last.get(suggestedKey(s)) ?? s.confirmed })),
  };
}

/** Where a suggested value came from and whether it is confirmed, for the working and the form. */
export function describeSuggested(s: SuggestedValue): string {
  return `${s.confirmed ? 'Suggested by Kerf, confirmed by you' : 'Suggested by Kerf, not confirmed yet'}. ${describeBasis(s.basis)}`;
}

const structuralInput = <S extends SuggestedValue>(
  suggested: readonly S[],
  path: string | undefined,
) =>
  path === undefined
    ? undefined
    : suggested.find((s) => s.from === 'structuralInputs' && s.path === path);

function labeled(q: Quantity, suggested: readonly SuggestedValue[]): Quantity {
  const s = structuralInput(suggested, q.input);
  return s ? { ...q, basis: describeSuggested(s) } : q;
}

/**
 * The plan with each quantity taken from a suggested structural input saying so, with its basis,
 * in place of "Entered". Margins and every other number are as stored: where a value came from
 * never changes what it computes.
 */
export function withSuggested(plan: Plan, suggested: readonly SuggestedValue[]): Plan {
  if (suggested.length === 0) return plan;
  const label = (qs: Quantity[]) => qs.map((q) => labeled(q, suggested));
  return {
    ...plan,
    checks: plan.checks.map((c) =>
      c.status === 'computed' ? { ...c, inputs: label(c.inputs), steps: label(c.steps) } : c,
    ),
    movement: plan.movement.map((m) =>
      m.status === 'computed' ? { ...m, inputs: label(m.inputs) } : m,
    ),
  };
}

/** The suggestions a check or estimate computed with, each once, in the order of its working. */
export function suggestionsUsed<S extends SuggestedValue>(
  result: CheckResult | MovementResult,
  suggested: readonly S[],
): S[] {
  if (result.status !== 'computed') return [];
  const quantities = 'steps' in result ? [...result.inputs, ...result.steps] : result.inputs;
  const used = quantities.flatMap((q) => structuralInput(suggested, q.input) ?? []);
  return used.filter((s, i) => used.indexOf(s) === i);
}

/** The suggestions a bolted joint's size and count come from. */
export function jointSuggestions<S extends SuggestedValue>(
  joint: BoltJoint,
  suggested: readonly S[],
): S[] {
  return suggested.filter((s) => s.from === 'params' && joint.params.includes(s.path));
}

/** A suggestion as the structural review lists it: its field, its value, and where it came from. */
export interface SuggestedItem extends SuggestedValue {
  key: string;
  label: string;
  /** The value through core's formatters. */
  text: string;
  about: string;
}

/** Each suggestion a project holds, in the form's order, with its field's label and value. */
export function suggestedItems(
  form: TemplateForm,
  snapshot: Values & { suggested: readonly SuggestedValue[] },
): SuggestedItem[] {
  const byKey = new Map(snapshot.suggested.map((s) => [suggestedKey(s), s]));
  return enteredParts(form, snapshot.params, snapshot.structuralInputs).flatMap((part) =>
    part.values.flatMap((v) => {
      const key = suggestedKey(v);
      const s = byKey.get(key);
      return s && v.text !== null
        ? [{ ...s, key, label: v.label, text: v.text, about: describeSuggested(s) }]
        : [];
    }),
  );
}

/**
 * What the editor says under each field that holds a suggestion, keyed `${from} ${path}`, for an
 * existing project: shown while the field holds the stored value.
 */
export function suggestedFields(
  form: TemplateForm,
  snapshot: Values & { suggested: readonly SuggestedValue[] },
): ReadonlyMap<string, SuggestedField> {
  return new Map(
    snapshot.suggested.map((s) => [
      suggestedKey(s),
      {
        text: textAt(form[s.from], snapshot[s.from], s.path),
        about: s.confirmed
          ? describeSuggested(s)
          : `${describeSuggested(s)} Confirm it in the structural review, or change it here.`,
      },
    ]),
  );
}
