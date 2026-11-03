import {
  buildFromForm,
  confirmedPaths,
  entryProblems,
  type FormSection,
  type FormSource,
  type FormValues,
  findTemplate,
  formParts,
  formValues,
  type Plan,
  type SuggestedField,
  structural,
  type TemplateDefinition,
  visibleFields,
} from '@kerf/core';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { api, type FieldIssue, failureOf, type SaveState, send } from '../../lib/api.ts';
import { FieldInput } from '../../lib/FieldInput.tsx';
import { fieldId } from '../../lib/fieldIds.ts';
import { setFlash } from '../../lib/flash.ts';
import { Loaded } from '../../lib/Loaded.tsx';
import { newProjectLabel } from '../../lib/names.ts';
import { readPlan } from '../../lib/plan.ts';
import { describeReset } from '../../lib/progress.ts';
import { projectStore } from '../../lib/projectStore.ts';
import { type EditFrom, editReturn, href, navigate, type ProjectStart } from '../../lib/route.ts';
import { sameJson } from '../../lib/sameJson.ts';
import {
  type Project,
  type ProjectStatus,
  type ProjectSummary,
  STATUS_LABELS,
  STATUSES,
} from '../../lib/types.ts';
import { useLoad } from '../../lib/useLoad.ts';
import {
  Button,
  ButtonLink,
  Cluster,
  ErrorSummary,
  ErrorText,
  Field,
  FieldGroup,
  FormProgress,
  InfoNotice,
  Notice,
  ProblemScreen,
  SaveFailed,
  ScreenHeader,
  Select,
  Stack,
  type SummaryItem,
  Text,
  TextInput,
  Tick,
  useDraft,
  useFormIssues,
  useFrameProject,
  WithAside,
} from '../../ui/index.ts';
import { DeleteProject } from './DeleteProject.tsx';
import { belongsTo, NO_ISSUES, placeIssues, schemaIssues } from './issues.ts';
import { PreviewPane, usePreview } from './Preview.tsx';
import { StartChoice, StartedFrom } from './StartChoice.tsx';
import { StartQuestions } from './StartQuestions.tsx';

// Create or edit a project's parameters and structural inputs (PRODUCT.md, MVP features 2 and
// 7). The template describes its form as data in core; this renders any template's form. Core's
// schemas check it before sending, and the API checks again, including combinations.

export function NewProjectScreen(props: { templateId: string; start?: ProjectStart }) {
  const template = findTemplate(props.templateId);
  if (!template) {
    return (
      <ProblemScreen
        title="New project"
        back={{ href: href({ screen: 'projects' }), label: 'Projects' }}
      >
        There is no template "{props.templateId}".
      </ProblemScreen>
    );
  }
  return <NewProject template={template} start={props.start} />;
}

/**
 * A new project: first how to start (#358), then its form, empty or started from a worked example,
 * an earlier project (#98), or the template's questions (#163). The earlier projects of the
 * template are loaded to offer as starts.
 */
function NewProject(props: { template: TemplateDefinition; start?: ProjectStart }) {
  const { template, start } = props;
  const key = `${template.id}/${JSON.stringify(start ?? null)}`;
  const { loaded, reload } = useLoad<{ earlier: ProjectSummary[]; source: Project | null }>(
    async () => {
      const list = await send(api.api.projects.$get());
      if (!list.ok) return list;
      const earlier = list.value.projects.filter((p) => p.templateId === template.id);
      if (start?.kind !== 'project') return { ok: true as const, value: { earlier, source: null } };
      const source = await send(api.api.projects[':id'].$get({ param: { id: start.id } }));
      if (!source.ok) return source;
      return { ok: true as const, value: { earlier, source: source.value } };
    },
    key,
  );
  return (
    <Loaded state={loaded} loading="Loading…" onRetry={reload} title={newTitle(template)}>
      {({ earlier, source }) => {
        if (!start) {
          return <StartChoice template={template} title={newTitle(template)} earlier={earlier} />;
        }
        const starts = <StartedFrom template={template} start={start} earlier={earlier} />;
        if (start?.kind === 'questions' && template.questions) {
          return (
            <StartQuestions
              key={key}
              template={template}
              questions={template.questions}
              title={newTitle(template)}
              starts={starts}
              editor={(suggested, changeAnswers) => (
                <ProjectEditor
                  template={template}
                  initial={{ name: '', params: suggested.params, inputs: suggested.inputs }}
                  suggested={suggested.about}
                  starts={
                    <>
                      {starts}
                      {changeAnswers}
                    </>
                  }
                />
              )}
            />
          );
        }
        const starting = startValues(template, start, source);
        if (!starting.ok) {
          return (
            <Stack gap="l">
              <ScreenHeader title={newTitle(template)} />
              <Notice>{starting.message}</Notice>
              {starts}
            </Stack>
          );
        }
        return (
          <ProjectEditor
            key={key}
            template={template}
            initial={starting.initial}
            copied={starting.copied}
            starts={starts}
          />
        );
      }}
    </Loaded>
  );
}

/**
 * Values copied from an earlier project that the owner confirms before saving (#98, hard rule 3):
 * the form's confirmed parameters, such as hardware sizes, and the structural
 * inputs.
 */
interface Copied {
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

const newTitle = (template: TemplateDefinition) => newProjectLabel(template.name);

/**
 * `from` is the plan's section Edit was opened from, or Shopping mode: Save and Cancel go back to
 * it (#156, #390).
 */
export function EditProjectScreen(props: { id: string; from?: EditFrom; field?: string }) {
  const { loaded, reload } = useLoad(
    () => send(api.api.projects[':id'].$get({ param: { id: props.id } })),
    props.id,
  );
  return (
    <Loaded state={loaded} loading="Loading project…" onRetry={reload} title="Edit project">
      {(project) => (
        // A newer revision, loaded after a save was refused, starts the form again from it.
        <EditProject
          key={project.revision}
          project={project}
          from={props.from}
          field={props.field}
          onReload={reload}
        />
      )}
    </Loaded>
  );
}

export function EditProject(props: {
  project: Project;
  from?: EditFrom;
  field?: string;
  onReload: () => void;
}) {
  const { project } = props;
  // Outside the form, so Enter in the name it asks for never submits the edit.
  return (
    <Stack gap="xl">
      <EditProjectForm {...props} />
      <DeleteProject id={project.id} name={project.name} />
    </Stack>
  );
}

/** The form, or why it cannot be shown; the project can still be deleted either way. */
function EditProjectForm(props: {
  project: Project;
  from?: EditFrom;
  field?: string;
  onReload: () => void;
}) {
  const { project } = props;
  const template = findTemplate(project.templateId);
  const back = { href: href({ screen: 'project', id: project.id }), label: project.name };
  // The title bar's back link names the project (#265).
  useFrameProject({ name: back.label, href: back.href });
  if (!template) {
    return (
      <ProblemScreen title={`Edit ${project.name}`} back={back}>
        This project's template is no longer offered.
      </ProblemScreen>
    );
  }
  if (!project.snapshot) {
    return (
      <ProblemScreen title={`Edit ${project.name}`} back={back}>
        This project's stored plan cannot be read ({project.unreadable?.message}), so it cannot be
        edited.
      </ProblemScreen>
    );
  }
  return (
    <ProjectEditor
      template={template}
      project={project}
      from={props.from}
      field={props.field}
      onReload={props.onReload}
      initial={{
        name: project.name,
        status: project.status,
        params: formValues(template.form.params, project.snapshot.params),
        inputs: formValues(template.form.structuralInputs, project.snapshot.structuralInputs),
      }}
    />
  );
}

interface EditorValues {
  name: string;
  /** An existing project's status, which follows progress and can be set here (#355). */
  status?: ProjectStatus;
  params: FormValues;
  inputs: FormValues;
}

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
  const setName = (next: string) => setDraft((d) => ({ ...d, name: next }));
  const setStatus = (next: string) =>
    setDraft((d) => ({ ...d, status: STATUSES.find((s) => s === next) ?? d.status }));
  const setParams = (next: FormValues) => setDraft((d) => ({ ...d, params: next }));
  const setInputs = (next: FormValues) => setDraft((d) => ({ ...d, inputs: next }));
  const { issues, attempt, report } = useFormIssues({
    name: undefined as string | undefined,
    confirm: undefined as string | undefined,
    params: NO_ISSUES,
    inputs: NO_ISSUES,
  });
  const [confirmed, setConfirmed] = useState(false);
  const [saveState, setSaveState] = useState<SaveState | { state: 'stale'; revision: number }>({
    state: 'idle',
  });
  // Copied values the owner has neither changed nor confirmed, among the fields shown. Changing
  // one confirms it; clearing a structural input makes it input needed.
  const waiting = (sections: readonly FormSection[], values: FormValues, from: FormValues) =>
    new Set(
      copied && !confirmed
        ? visibleFields(sections, values)
            .map((f) => f.path)
            .filter((path) => (values[path] ?? '').trim() !== '' && values[path] === from[path])
        : [],
    );
  const unconfirmed = {
    params: waiting(form.params, params, copied?.params ?? {}),
    inputs: waiting(form.structuralInputs, inputs, copied?.inputs ?? {}),
  };
  const toConfirm = unconfirmed.params.size + unconfirmed.inputs.size;
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
            },
          }),
        );
    setSaveState({ state: 'idle' });
    if (result.ok) {
      const reset = 'progressReset' in result.value ? result.value.progressReset : undefined;
      setFlash(project ? ['Saved.', describeReset(reset)].filter(Boolean).join(' ') : 'Created.');
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
  const onChange = { params: setParams, structuralInputs: setInputs };
  const fieldIssues = { params: issues.params, structuralInputs: issues.inputs };
  const waitingFor = { params: unconfirmed.params, structuralInputs: unconfirmed.inputs };
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
  const submitLabel = project ? 'Save changes' : 'Create project';
  const submitButton = (
    <Button type="submit" busy={saving} busyLabel="Saving…">
      {submitLabel}
    </Button>
  );

  // A saved project's output shows beside the form, previewed before saving (#39, L-A; #56).
  // Read once per saved project, not per keystroke, so the preview pane keeps its saved plan.
  const saved = useMemo(() => (project ? readPlan(project) : null), [project]);
  const showsPlan = saved?.ok || !project;
  const preview = usePreview(template, project ?? null, params, inputs, !showsPlan);
  // The plan for the values in the form, when there is one: for comparing a value against.
  const current =
    preview.kind === 'ready'
      ? preview.plan
      : preview.kind === 'saved' && saved?.ok
        ? saved.plan
        : null;

  const editing = (
    <Stack gap="l">
      <Field id="project-name" label="Project name" error={issues.name} width="medium">
        {(c) => <TextInput {...c} value={name} onChange={setName} readOnly={saving} />}
      </Field>
      {project && status && (
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
        {form.help && <Text tone="muted">{form.help}</Text>}
      </Stack>
      {parts.map((part) => (
        <FieldGroup key={part.title} legend={part.title} help={part.help}>
          {part.fields.map(({ from, field }) => (
            <FieldInput
              key={`${from} ${field.path}`}
              id={fieldId(from, field.path)}
              field={field}
              text={values[from][field.path] ?? ''}
              issue={fieldIssues[from].fields[field.path]}
              readOnly={saving}
              needed={from === 'structuralInputs' || field.confirmed}
              confirm={waitingFor[from].has(field.path) ? 'Copied, confirm' : undefined}
              about={aboutField(props.suggested, from, field.path, values[from][field.path])}
              compare={from === 'structuralInputs' ? compareWith(current, field.path) : undefined}
              onChange={(text) => onChange[from]({ ...values[from], [field.path]: text })}
            />
          ))}
        </FieldGroup>
      ))}
      {copied && (
        <CopiedNotice
          from={copied.from}
          confirmed={confirmed}
          waiting={toConfirm}
          issue={toConfirm > 0 ? issues.confirm : undefined}
          onConfirm={setConfirmed}
        />
      )}
    </Stack>
  );

  const actions = (
    <Stack gap="s">
      <FormProgress
        entered={counted.length - counted.filter(empty).length}
        total={counted.length}
        empty={parts.flatMap((part) => {
          const first = part.fields.find(empty);
          return first ? [{ group: part.title, field: fieldId(first.from, first.field.path) }] : [];
        })}
      />
      {saveState.state === 'failed' && <SaveFailed failure={saveState.failure} />}
      {saveState.state === 'stale' && (
        <Stack gap="xs">
          <Notice>
            <b>Changed on another device.</b> This project was saved somewhere else after you opened
            it here. Your changes are still in the form.
          </Notice>
          <Cluster>
            <Button
              variant="secondary"
              onClick={() =>
                void submit(undefined, saveState.state === 'stale' ? saveState.revision : undefined)
              }
            >
              Save my changes over it
            </Button>
            {props.onReload && (
              <Button variant="secondary" onClick={props.onReload}>
                Load the newer version
              </Button>
            )}
          </Cluster>
        </Stack>
      )}
      <Cluster>
        {submitButton}
        <ButtonLink
          variant="secondary"
          href={project ? href(editReturn(project.id, props.from)) : href({ screen: 'projects' })}
        >
          Cancel
        </ButtonLink>
      </Cluster>
    </Stack>
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
        <WithAside head={actions}>
          {editing}
          {showsPlan && <PreviewPane saved={saved?.ok ? saved.plan : null} state={preview} />}
        </WithAside>
      </Stack>
      {dialog}
    </form>
  );
}

/** The form's parts with only the fields that apply to the values typed so far. */
function shownParts(template: TemplateDefinition, params: FormValues, inputs: FormValues) {
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

/** A summary line that names its field, unless the message already does. */
function named(label: string | undefined, message: string): string {
  if (!label || message.startsWith(label)) return message;
  return `${label}: ${message.charAt(0).toLowerCase()}${message.slice(1)}`;
}

/** What the editor holds for an existing project, as it would be saved. */
interface Edited {
  name: string;
  status: ProjectStatus;
  params: Record<string, unknown>;
  inputs: Record<string, unknown>;
}

/**
 * What to send for an edit: only what changed, so renaming a project never regenerates it (and
 * never moves it to a newer template version without the owner changing a value).
 */
export function changesFor(project: Project, edited: Edited) {
  const { name, status, params, inputs } = edited;
  const stored = project.snapshot;
  return {
    ...(name !== project.name ? { name } : {}),
    ...(status !== project.status ? { status } : {}),
    ...(stored && !sameJson(params, stored.params) ? { params } : {}),
    ...(stored && !sameJson(inputs, stored.structuralInputs) ? { structuralInputs: inputs } : {}),
  };
}

/** Saves the changed fields against `revision`; another device's other changes stand. */
async function save(project: Project, revision: number, edited: Edited) {
  const changes = changesFor(project, edited);
  if (Object.keys(changes).length === 0) return { ok: true as const, value: project };
  return send(
    api.api.projects[':id'].$put({ param: { id: project.id }, json: { ...changes, revision } }),
  );
}
