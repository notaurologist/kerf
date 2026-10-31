import {
  buildFromForm,
  entryProblems,
  type FormValues,
  formValues,
  type StartingQuestions,
  type SuggestedField,
  suggestedValues,
  type TemplateDefinition,
  visibleFields,
} from '@kerf/core';
import { type FormEvent, type ReactNode, useState } from 'react';
import type { FieldIssue } from '../../lib/api.ts';
import { FieldInput } from '../../lib/FieldInput.tsx';
import { href } from '../../lib/route.ts';
import {
  Button,
  ButtonLink,
  Cluster,
  ErrorSummary,
  FieldGroup,
  InfoNotice,
  ScreenHeader,
  Stack,
  Text,
} from '../../ui/index.ts';
import { type FormIssues, NO_ISSUES, placeIssues, schemaIssues } from './issues.ts';

// A new project started from a few plain questions (#163). The template asks them as form data
// and suggests starting values from the answers with core's pure function; the editor then opens
// filled in, with the preview, and each suggested value says where it came from. Nothing is
// saved until Create.

/** The editor's starting values from a set of answers. */
export interface FromAnswers {
  params: FormValues;
  inputs: FormValues;
  about: ReadonlyMap<string, SuggestedField>;
}

/**
 * The answers' problems in the form's words, or the suggestions. Text Kerf cannot read says what
 * to type; the answers schema reports the rest.
 */
export function answer(
  template: TemplateDefinition,
  questions: StartingQuestions,
  values: FormValues,
): { ok: true; value: FromAnswers } | { ok: false; issues: FieldIssue[] } {
  const unread = entryProblems(questions.form, values);
  const unreadFields = new Set(unread.map((u) => u.field));
  const parsed = questions.answers.safeParse(buildFromForm(questions.form, values));
  const issues = [
    ...unread,
    ...(parsed.success
      ? []
      : schemaIssues(parsed.error, values, questions.form, questions.answers).filter(
          (i) => !unreadFields.has(i.field),
        )),
  ];
  if (issues.length > 0 || !parsed.success) return { ok: false, issues };
  return { ok: true, value: suggestedValues(template.form, questions.suggest(parsed.data)) };
}

export function StartQuestions(props: {
  template: TemplateDefinition;
  questions: StartingQuestions;
  title: string;
  starts: ReactNode;
  /** The editor, opened with the suggestions and a way back to the answers. */
  editor: (from: FromAnswers, changeAnswers: ReactNode) => ReactNode;
}) {
  const { template, questions } = props;
  const [values, setValues] = useState(() => formValues(questions.form, {}));
  const [issues, setIssues] = useState<FormIssues>(NO_ISSUES);
  const [suggested, setSuggested] = useState<FromAnswers | null>(null);

  if (suggested) {
    return props.editor(
      suggested,
      <InfoNotice>
        <Stack gap="xs">
          <Text>
            Filled in from your answers. Each suggested value says where it came from; change any of
            them. Hardware and the other structural inputs are yours to enter.
          </Text>
          <Cluster>
            <Button variant="link" onClick={() => setSuggested(null)}>
              Change your answers
            </Button>
          </Cluster>
        </Stack>
      </InfoNotice>,
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = answer(template, questions, values);
    if (result.ok) {
      setIssues(NO_ISSUES);
      setSuggested(result.value);
    } else {
      setIssues(placeIssues(questions.form, values, result.issues));
    }
  };

  const shown = new Set(visibleFields(questions.form, values).map((f) => f.path));
  const summary = questions.form.flatMap((section) =>
    section.fields.flatMap((field) => {
      const message = issues.fields[field.path];
      return message && shown.has(field.path)
        ? [{ field: questionId(field.path), message: `${field.label}: ${message}` }]
        : [];
    }),
  );

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="l">
        <ScreenHeader title={props.title} />
        <ErrorSummary items={summary} general={issues.general} />
        {props.starts}
        <Text tone="muted">
          A few questions about who will use it and where. Kerf fills in the rest from the worked
          example and stated rules of thumb, and you can change any value before creating the
          project.
        </Text>
        {questions.form.map((section) => (
          <FieldGroup key={section.title} legend={section.title} help={section.help}>
            {section.fields
              .filter((field) => shown.has(field.path))
              .map((field) => (
                <FieldInput
                  key={field.path}
                  id={questionId(field.path)}
                  field={field}
                  text={values[field.path] ?? ''}
                  issue={issues.fields[field.path]}
                  onChange={(text) => setValues({ ...values, [field.path]: text })}
                />
              ))}
          </FieldGroup>
        ))}
        <Cluster>
          <Button type="submit">Suggest dimensions</Button>
          <ButtonLink variant="secondary" href={href({ screen: 'projects' })}>
            Cancel
          </ButtonLink>
        </Cluster>
      </Stack>
    </form>
  );
}

const questionId = (path: string) => `q-${path}`;
