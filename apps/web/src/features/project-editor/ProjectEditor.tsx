import {
  buildFromForm,
  entryProblems,
  type FormSection,
  type FormSource,
  type FormValues,
  type SuggestedField,
  type TemplateDefinition,
  visibleFields,
} from '@kerf/core';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { api, type FieldIssue, failureOf, send } from '../../lib/api.ts';
import { fieldId } from '../../lib/fieldIds.ts';
import { setFlash } from '../../lib/flash.ts';
import { readPlan } from '../../lib/plan.ts';
import { describeReset } from '../../lib/progress.ts';
import { projectStore } from '../../lib/projectStore.ts';
import { type EditFrom, editReturn, href, navigate } from '../../lib/route.ts';
import type { Project } from '../../lib/types.ts';
import {
  Button,
  ErrorSummary,
  InfoNotice,
  ScreenHeader,
  Stack,
  type SummaryItem,
  Text,
  useDraft,
  useFormIssues,
  WithAside,
} from '../../ui/index.ts';
import { EditorActions, type EditorSaveState } from './EditorActions.tsx';
import { EditorFields, shownParts } from './EditorFields.tsx';
import { belongsTo, NO_ISSUES, placeIssues, schemaIssues } from './issues.ts';
import { PreviewPane, usePreview, WhatChanges } from './Preview.tsx';
import { save } from './save.ts';
import { type Copied, type EditorValues, newTitle } from './start.ts';

// Create or edit a project's parameters and structural inputs (PRODUCT.md, MVP features 2 and
// 7). The template describes its form as data in core; this renders any template's form. Core's
// schemas check it before sending, and the API checks again, including combinations. The new
// and edit screens around it are in NewProject.tsx and EditProject.tsx.

export function ProjectEditor(props: {
  template: TemplateDefinition;
  project?: Project;
  /** The plan's section to return to after Save or Cancel; the summary when absent. */
  from?: EditFrom;
  /** The id of a field to start on, such as an input a check needs. */
  field?: string;
  /** Loads the project again, for when another device saved it after this form opened. */
  onReload?: () => void;
  initial: EditorValues;
  /** A new project's values copied from an earlier one, to confirm (#98). */
  copied?: Copied;
  /**
   * Where each suggested value came from, keyed `${from} ${path}` (#163). Shown under a field
   * while it holds the suggestion.
   */
  suggested?: ReadonlyMap<string, SuggestedField>;
  /**
   * A new project's answers to the starting questions, sent with Create and the preview so the
   * server records which values are still suggestions (#417).
   */
  answers?: unknown;
  /** A new project's choice of start, shown above the form. */
  starts?: ReactNode;
}) {
  const { template, project, copied } = props;
  const form = template.form;
  const { draft, setDraft, dialog } = useDraft(props.initial);
  // After the screen's heading has taken focus (a child's effect runs first), so this one wins.
  const startField = props.field;
  useEffect(() => {
    if (!startField) return;
    const target = document.getElementById(startField);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'center' });
  }, [startField]);
  const { name, status, params, inputs } = draft;
  const { issues, attempt, report } = useFormIssues({
    name: undefined as string | undefined,
    confirm: undefined as string | undefined,
    params: NO_ISSUES,
    inputs: NO_ISSUES,
  });
  // The copied fields the tick confirmed, by form and path: only those shown when it was ticked,
  // so a copied field a later answer reveals still asks to be confirmed.
  const [confirmed, setConfirmed] = useState<ReadonlySet<string>>(new Set());
  const [saveState, setSaveState] = useState<EditorSaveState>({ state: 'idle' });
  // Copied values the owner has neither changed nor confirmed, among the fields shown. Changing
  // one confirms it; clearing a structural input makes it input needed.
  const waiting = (
    source: FormSource,
    sections: readonly FormSection[],
    values: FormValues,
    from: FormValues,
  ) =>
    new Set(
      copied
        ? visibleFields(sections, values)
            .map((f) => f.path)
            .filter(
              (path) =>
                (values[path] ?? '').trim() !== '' &&
                values[path] === from[path] &&
                !confirmed.has(`${source} ${path}`),
            )
        : [],
    );
  const unconfirmed = {
    params: waiting('params', form.params, params, copied?.params ?? {}),
    structuralInputs: waiting(
      'structuralInputs',
      form.structuralInputs,
      inputs,
      copied?.inputs ?? {},
    ),
  };
  const toConfirm = unconfirmed.params.size + unconfirmed.structuralInputs.size;
  const confirm = (tick: boolean) =>
    setConfirmed(
      tick
        ? new Set([
            ...confirmed,
            ...[...unconfirmed.params].map((path) => `params ${path}`),
            ...[...unconfirmed.structuralInputs].map((path) => `structuralInputs ${path}`),
          ])
        : new Set(),
    );
  const saving = saveState.state === 'saving';

  const show = (fieldIssues: FieldIssue[], nameIssue?: string, confirmIssue?: string) => {
    const forParams = fieldIssues.filter(
      (i) => belongsTo(form.params, i.field) || !belongsTo(form.structuralInputs, i.field),
    );
    const forInputs = fieldIssues.filter((i) => !forParams.includes(i));
    const found = fieldIssues.length > 0 || nameIssue !== undefined || confirmIssue !== undefined;
    report(
      {
        name: nameIssue,
        confirm: confirmIssue,
        params: placeIssues(form.params, params, forParams),
        inputs: placeIssues(form.structuralInputs, inputs, forInputs),
      },
      found,
    );
    return found;
  };

  /** `revision` is the plan the changes are saved against: the one opened, unless overridden. */
  const submit = async (e?: FormEvent, revision = project?.revision) => {
    e?.preventDefault();
    setSaveState({ state: 'idle' });
    const builtParams = buildFromForm(form.params, params);
    const builtInputs = buildFromForm(form.structuralInputs, inputs);
    const p = template.params.safeParse(builtParams);
    const i = template.structuralInputs.safeParse(builtInputs);
    const nameIssue = name.trim() ? undefined : 'Enter a project name.';
    const copyIssue = toConfirm > 0 ? 'Confirm the copied values, or change them.' : undefined;
    // Text Kerf cannot read says what to type; the schema's problems cover the rest.
    const unread = [
      ...entryProblems(form.params, params),
      ...entryProblems(form.structuralInputs, inputs),
    ];
    const unreadFields = new Set(unread.map((u) => u.field));
    const found = [
      ...unread,
      ...[
        ...(p.success ? [] : schemaIssues(p.error, params, form.params, template.params)),
        ...(i.success
          ? []
          : schemaIssues(i.error, inputs, form.structuralInputs, template.structuralInputs)),
      ].filter((issue) => !unreadFields.has(issue.field)),
    ];
    if (show(found, nameIssue, copyIssue)) return;

    setSaveState({ state: 'saving' });
    const result = project
      ? await save(project, revision ?? project.revision, {
          name: name.trim(),
          status: status ?? project.status,
          params: builtParams,
          inputs: builtInputs,
        })
      : await send(
          api.api.projects.$post({
            json: {
              name: name.trim(),
              templateId: template.id,
              params: builtParams,
              structuralInputs: builtInputs,
              ...(props.answers !== undefined ? { answers: props.answers } : {}),
            },
          }),
        );
    setSaveState({ state: 'idle' });
    if (result.ok) {
      const reset = 'progressReset' in result.value ? result.value.progressReset : undefined;
      setFlash(
        project
          ? ['Saved.', describeReset(reset, result.value)].filter(Boolean).join(' ')
          : 'Created.',
      );
      projectStore.set(result.value);
      navigate(editReturn(result.value.id, props.from));
      return;
    }
    if (result.error.kind === 'invalid') {
      show(result.error.issues);
      return;
    }
    if (result.error.kind === 'stale') {
      setSaveState({ state: 'stale', revision: result.error.revision });
      return;
    }
    setSaveState({ state: 'failed', failure: failureOf(result.error) });
  };

  const values = { params, structuralInputs: inputs };
  const fieldIssues = { params: issues.params, structuralInputs: issues.inputs };
  const parts = shownParts(template, params, inputs);
  const shown = parts.flatMap((p) => p.fields);
  const summary: SummaryItem[] = [
    ...(issues.name ? [{ field: 'project-name', message: issues.name }] : []),
    // In the order the fields are on the screen.
    ...shown.flatMap(({ from, field }) => {
      const message = fieldIssues[from].fields[field.path];
      return message
        ? [{ field: fieldId(from, field.path), message: named(field.label, message) }]
        : [];
    }),
    ...(issues.confirm && toConfirm > 0
      ? [{ field: 'confirm-copied', message: issues.confirm }]
      : []),
  ];
  const general = [...issues.params.general, ...issues.inputs.general];

  const empty = ({ from, field }: (typeof shown)[number]) =>
    !field.optional && (values[from][field.path] ?? '').trim() === '';
  const counted = shown.filter(
    ({ from, field }) => !field.optional || (values[from][field.path] ?? '').trim() !== '',
  );
  const submitButton = (
    <Button type="submit" busy={saving} busyLabel="Saving…">
      {project ? 'Save changes' : 'Create project'}
    </Button>
  );

  // A saved project's output shows beside the form, previewed before saving (#39, L-A; #56).
  // Read once per saved project, not per keystroke, so the preview pane keeps its saved plan.
  const saved = useMemo(() => (project ? readPlan(project) : null), [project]);
  const showsPlan = saved?.ok || !project;
  const preview = usePreview(template, project ?? null, params, inputs, !showsPlan, props.answers);
  // The plan for the values in the form, when there is one: for comparing a value against.
  const current =
    preview.kind === 'ready'
      ? preview.plan
      : preview.kind === 'saved' && saved?.ok
        ? saved.plan
        : null;

  const actions = (
    <EditorActions
      progress={{
        entered: counted.length - counted.filter(empty).length,
        total: counted.length,
        empty: parts.flatMap((part) => {
          const first = part.fields.find(empty);
          return first ? [{ group: part.title, field: fieldId(first.from, first.field.path) }] : [];
        }),
      }}
      saveState={saveState}
      onSaveOver={(revision) => void submit(undefined, revision)}
      onReload={props.onReload}
      submit={submitButton}
      cancelHref={project ? href(editReturn(project.id, props.from)) : href({ screen: 'projects' })}
    />
  );

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="l">
        <ScreenHeader
          title={project ? `Edit ${project.name}` : newTitle(template)}
          actions={submitButton}
        />
        <ErrorSummary items={summary} general={general} attempt={attempt} />
        {props.starts}
        {project?.version?.status === 'behind' && (
          <InfoNotice>
            <Text>
              Saving changed parameters or structural inputs regenerates this plan with template
              version {project.version.currentVersion}. It was made with version{' '}
              {project.version.storedVersion}.
            </Text>
          </InfoNotice>
        )}
        {project?.version?.status === 'carry-length' && (
          <InfoNotice>
            <Text>
              Saving changed parameters or structural inputs also plans this project's boards for
              your carry length now.
            </Text>
          </InfoNotice>
        )}
        {/* The changed numbers beside the header's Save, while the preview is below the form. */}
        <WithAside head={actions} lead={showsPlan && <WhatChanges state={preview} />}>
          <EditorFields
            template={template}
            draft={draft}
            setDraft={setDraft}
            hasStatus={project !== undefined}
            saving={saving}
            parts={parts}
            issues={{ name: issues.name, fields: fieldIssues, confirm: issues.confirm }}
            waiting={unconfirmed}
            suggested={props.suggested}
            current={current}
            copied={copied}
            confirmed={confirmed.size > 0 && toConfirm === 0}
            toConfirm={toConfirm}
            onConfirm={confirm}
          />
          {showsPlan && <PreviewPane saved={saved?.ok ? saved.plan : null} state={preview} />}
        </WithAside>
      </Stack>
      {dialog}
    </form>
  );
}

/** A summary line that names its field, unless the message already does. */
function named(label: string | undefined, message: string): string {
  if (!label || message.startsWith(label)) return message;
  return `${label}: ${message.charAt(0).toLowerCase()}${message.slice(1)}`;
}
