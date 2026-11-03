import {
  type FormSource,
  type FormValues,
  formParts,
  type Plan,
  type SuggestedField,
  structural,
  type TemplateDefinition,
  visibleFields,
} from '@kerf/core';
import type { SetStateAction } from 'react';
import { FieldInput } from '../../lib/FieldInput.tsx';
import { fieldId } from '../../lib/fieldIds.ts';
import { STATUS_LABELS, STATUSES } from '../../lib/types.ts';
import {
  ErrorText,
  Field,
  FieldGroup,
  InfoNotice,
  Select,
  Stack,
  Text,
  TextInput,
  Tick,
} from '../../ui/index.ts';
import type { FormIssues } from './issues.ts';
import type { Copied, EditorValues } from './start.ts';

// The editor's fields: the project's name and status, then the template's form by part, each
// field with its issue, where its value came from, and what the checks need of it.

type BySource<T> = Record<FormSource, T>;

/** The form's values for a field, by the form it is from. */
const valuesOf = (draft: EditorValues): BySource<FormValues> => ({
  params: draft.params,
  structuralInputs: draft.inputs,
});

export function EditorFields(props: {
  template: TemplateDefinition;
  draft: EditorValues;
  setDraft: (next: SetStateAction<EditorValues>) => void;
  /** Whether the project has a status to set: an existing one (#355). */
  hasStatus: boolean;
  saving: boolean;
  parts: ShownPart[];
  issues: { name?: string; fields: BySource<FormIssues>; confirm?: string };
  /** Copied values still to confirm, by form and path. */
  waiting: BySource<ReadonlySet<string>>;
  suggested?: ReadonlyMap<string, SuggestedField>;
  /** The plan for the values in the form, when there is one: for comparing a value against. */
  current: Plan | null;
  copied?: Copied;
  confirmed: boolean;
  toConfirm: number;
  onConfirm: (confirmed: boolean) => void;
}) {
  const { draft, setDraft, saving, copied, issues } = props;
  const { name, status } = draft;
  const values = valuesOf(draft);
  const setName = (next: string) => setDraft((d) => ({ ...d, name: next }));
  const setStatus = (next: string) =>
    setDraft((d) => ({ ...d, status: STATUSES.find((s) => s === next) ?? d.status }));
  const onChange = (from: FormSource, next: FormValues) =>
    setDraft((d) => (from === 'params' ? { ...d, params: next } : { ...d, inputs: next }));
  return (
    <Stack gap="l">
      <Field id="project-name" label="Project name" error={issues.name} width="medium">
        {(c) => <TextInput {...c} value={name} onChange={setName} readOnly={saving} />}
      </Field>
      {props.hasStatus && status && (
        <Field
          id="project-status"
          label="Status"
          hint="Follows your progress: In progress at the first tick, Built when the last step is done. Set it here for a project built without ticking its steps."
          width="medium"
        >
          {(c) => (
            <Select
              {...c}
              value={status}
              onChange={setStatus}
              placeholder={false}
              options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
            />
          )}
        </Field>
      )}
      <Stack gap="xs">
        <Text tone="muted">
          Fields marked "Input needed" are yours to enter or check. Structural inputs can wait:
          leave any you have not settled empty, and the checks that need it will say "Input needed".{' '}
          {copied && `Values copied from ${copied.from} say so until you confirm them below.`}
        </Text>
        {props.template.form.help && <Text tone="muted">{props.template.form.help}</Text>}
      </Stack>
      {props.parts.map((part) => (
        <FieldGroup key={part.title} legend={part.title} help={part.help}>
          {part.fields.map(({ from, field }) => (
            <FieldInput
              key={`${from} ${field.path}`}
              id={fieldId(from, field.path)}
              field={field}
              text={values[from][field.path] ?? ''}
              issue={issues.fields[from].fields[field.path]}
              readOnly={saving}
              needed={from === 'structuralInputs' || field.confirmed}
              confirm={props.waiting[from].has(field.path) ? 'Copied, confirm' : undefined}
              about={aboutField(props.suggested, from, field.path, values[from][field.path])}
              compare={
                from === 'structuralInputs' ? compareWith(props.current, field.path) : undefined
              }
              onChange={(text) => onChange(from, { ...values[from], [field.path]: text })}
            />
          ))}
        </FieldGroup>
      ))}
      {copied && (
        <CopiedNotice
          from={copied.from}
          confirmed={props.confirmed}
          waiting={props.toConfirm}
          issue={props.toConfirm > 0 ? issues.confirm : undefined}
          onConfirm={props.onConfirm}
        />
      )}
    </Stack>
  );
}

export type ShownPart = ReturnType<typeof shownParts>[number];

/** The form's parts with only the fields that apply to the values typed so far. */
export function shownParts(template: TemplateDefinition, params: FormValues, inputs: FormValues) {
  const visible = new Set([
    ...visibleFields(template.form.params, params).map((f) => `params ${f.path}`),
    ...visibleFields(template.form.structuralInputs, inputs).map(
      (f) => `structuralInputs ${f.path}`,
    ),
  ]);
  return formParts(template.form)
    .map((part) => ({
      ...part,
      fields: part.fields.filter((f) => visible.has(`${f.from} ${f.field.path}`)),
    }))
    .filter((part) => part.fields.length > 0);
}

/**
 * Where each check that uses this input reaches margin 1.0 as it grows, from the plan for the
 * values in the form (#401), so a value can be chosen against it.
 */
function compareWith(plan: Plan | null, path: string): string | undefined {
  const lines = (plan?.checks ?? []).flatMap((c) =>
    c.status !== 'not-computed' && c.breakEven?.key === path
      ? [`${c.subject}, ${c.title.toLowerCase()}: ${structural.formatBreakEven(c.breakEven)}`]
      : [],
  );
  return lines.length > 0 ? `With the other inputs as entered: ${lines.join('; ')}.` : undefined;
}

/**
 * Says where copied values came from, and asks the owner to confirm them (#98, hard rule 3).
 * Changing a copied value confirms that one; the checkbox confirms the rest.
 */
function CopiedNotice(props: {
  from: string;
  confirmed: boolean;
  waiting: number;
  issue?: string;
  onConfirm: (confirmed: boolean) => void;
}) {
  return (
    <InfoNotice>
      <Stack gap="xs">
        <Text>
          The values marked "Copied, confirm" are from {props.from}. They decide the structural
          checks, so check that each still fits this project: the lumber you will buy, the loads,
          and the hardware.
        </Text>
        {props.issue && <ErrorText id="confirm-copied-error">{props.issue}</ErrorText>}
        {(props.waiting > 0 || props.confirmed) && (
          <Tick id="confirm-copied" done={props.confirmed} onChange={props.onConfirm}>
            The copied values are right for this project
          </Tick>
        )}
      </Stack>
    </InfoNotice>
  );
}

/** Where a field's suggested value came from, while it still holds the suggestion. */
function aboutField(
  suggested: ReadonlyMap<string, SuggestedField> | undefined,
  from: FormSource,
  path: string,
  text: string | undefined,
): string | undefined {
  const entry = suggested?.get(`${from} ${path}`);
  return entry && entry.text === (text ?? '') ? entry.about : undefined;
}
