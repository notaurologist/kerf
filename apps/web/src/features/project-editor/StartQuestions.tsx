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
import { api, type FieldIssue, failureOf, send } from '../../lib/api.ts';
import { FieldInput } from '../../lib/FieldInput.tsx';
import { href } from '../../lib/route.ts';
import {
  Button,
  ButtonLink,
  Cluster,
  ErrorSummary,
  type Failure,
  FieldGroup,
  InfoNotice,
  SaveFailed,
  ScreenHeader,
  Stack,
  Text,
  useDraft,
  useFormIssues,
} from '../../ui/index.ts';
import { leaveGate } from '../../ui/leave.ts';
import { type FormIssues, NO_ISSUES, placeIssues, schemaIssues } from './issues.ts';

// A new project started from a few plain questions (#163). The template asks them as form data;
// the API suggests starting values from the answers with core's function, since a template may
// generate to make them. The editor then opens filled in, with the preview, and each suggested
// value says where it came from. Nothing is saved until Create.

/** The editor's starting values from a set of answers. */
export interface FromAnswers {
  params: FormValues;
  inputs: FormValues;
  about: ReadonlyMap<string, SuggestedField>;
  /** The answers the suggestions came from, which Create sends (#417). */
  answers: unknown;
}

/**
 * The answers' problems in the form's words, or the answers read from the form. Text Kerf cannot
 * read says what to type; the answers schema reports the rest.
 */
export function answer(
  questions: StartingQuestions,
  values: FormValues,
): { ok: true; answers: unknown } | { ok: false; issues: FieldIssue[] } {
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
  return { ok: true, answers: parsed.data };
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
  const [empty] = useState(() => formValues(questions.form, {}));
  const { issues, attempt, report } = useFormIssues<FormIssues>(NO_ISSUES);
  const [suggested, setSuggested] = useState<FromAnswers | null>(null);
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const {
    draft: values,
    setDraft: setValues,
    dialog,
  } = useDraft(empty, { holding: suggested === null });

  if (suggested) {
    return props.editor(
      suggested,
      <InfoNotice>
        <Stack gap="xs">
          <Text>
            Filled in from your answers. Each suggested value says where it came from; change any of
            them. A suggested structural input or bolt size stays a suggestion until you confirm it
            in the structural review or change it. The structural inputs Kerf does not suggest are
            yours to enter.
          </Text>
          <Cluster>
            {/* The editor's draft holds the gate while it has changes, so this asks first. */}
            <Button variant="link" onClick={() => leaveGate.confirm(() => setSuggested(null))}>
              Change your answers
            </Button>
          </Cluster>
        </Stack>
      </InfoNotice>,
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const checked = answer(questions, values);
    if (!checked.ok) {
      report(placeIssues(questions.form, values, checked.issues), true);
      return;
    }
    setAsking(true);
    setFailure(null);
    const result = await send(
      api.api.templates[':id'].suggestions.$post({
        param: { id: template.id },
        json: { answers: checked.answers },
      }),
    );
    setAsking(false);
    if (result.ok) {
      report(NO_ISSUES, false);
      setSuggested({
        ...suggestedValues(template.form, result.value.suggestions),
        answers: checked.answers,
      });
    } else if (result.error.kind === 'invalid') {
      const issues = result.error.issues.map((i) => ({
        ...i,
        field: i.field.replace(/^answers\.?/, ''),
      }));
      report(placeIssues(questions.form, values, issues), true);
    } else {
      setFailure(failureOf(result.error));
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
        <ErrorSummary items={summary} general={issues.general} attempt={attempt} />
        {props.starts}
        <Text tone="muted">
          A few questions about what you are building and where it goes. Kerf fills in the rest from
          the worked example and stated rules of thumb, and you can change any value before creating
          the project.
        </Text>
        {failure && (
          <SaveFailed
            failure={failure}
            title="No suggestions."
            kept="Your answers are still here."
          />
        )}
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
          <Button type="submit" busy={asking} busyLabel="Suggesting…">
            Suggest dimensions
          </Button>
          <ButtonLink variant="secondary" href={href({ screen: 'projects' })}>
            Cancel
          </ButtonLink>
        </Cluster>
      </Stack>
      {dialog}
    </form>
  );
}

const questionId = (path: string) => `q-${path}`;
