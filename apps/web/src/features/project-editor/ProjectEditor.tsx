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
  type TemplateDefinition,
  visibleFields,
} from '@kerf/core';
import { type FormEvent, type ReactNode, useState } from 'react';
import { api, type FieldIssue, failureOf, type SaveState, send } from '../../lib/api.ts';
import { FieldInput } from '../../lib/FieldInput.tsx';
import { setFlash } from '../../lib/flash.ts';
import { Loaded } from '../../lib/Loaded.tsx';
import { readPlan } from '../../lib/plan.ts';
import { describeReset } from '../../lib/progress.ts';
import { href, navigate, type ProjectStart } from '../../lib/route.ts';
import type { PlanSectionId } from '../../lib/sections.ts';
import type { Project, ProjectSummary } from '../../lib/types.ts';
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
  PlainList,
  SaveFailed,
  ScreenHeader,
  Stack,
  type SummaryItem,
  Text,
  TextInput,
  Tick,
  useFormIssues,
  useLeaveGuard,
  WithAside,
} from '../../ui/index.ts';
import { belongsTo, NO_ISSUES, placeIssues, schemaIssues } from './issues.ts';
import { PreviewPane, usePreview } from './Preview.tsx';
import { StartQuestions } from './StartQuestions.tsx';
import { sameJson } from './sameJson.ts';

// Create or edit a project's parameters and structural inputs (PRODUCT.md, MVP features 2 and
// 7). The template describes its form as data in core; this renders any template's form. Core's
// schemas check it before sending, and the API checks again, including combinations.

export function NewProjectScreen(props: { templateId: string; start?: ProjectStart }) {
  const template = findTemplate(props.templateId);
  if (!template) return <Notice>There is no template "{props.templateId}".</Notice>;
  return <NewProject template={template} start={props.start} />;
}

/**
 * A new project's form, empty or started from a worked example or an earlier project (#98). The
 * earlier projects of the template are loaded to offer as starts.
 */
function NewProject(props: { template: TemplateDefinition; start?: ProjectStart }) {
  const { template, start } = props;
  const key = `${template.id}/${JSON.stringify(start ?? null)}`;
  const { loaded } = useLoad<{ earlier: ProjectSummary[]; source: Project | null }>(async () => {
    const list = await send(api.api.projects.$get());
    if (!list.ok) return list;
    const earlier = list.value.projects.filter((p) => p.templateId === template.id);
    if (start?.kind !== 'project') return { ok: true as const, value: { earlier, source: null } };
    const source = await send(api.api.projects[':id'].$get({ param: { id: start.id } }));
    if (!source.ok) return source;
    return { ok: true as const, value: { earlier, source: source.value } };
  }, key);
  return (
    <Loaded state={loaded} loading="Loading…">
      {({ earlier, source }) => {
        const starts = <StartFrom template={template} start={start} earlier={earlier} />;
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

/**
 * The starts a new project can have: empty, each worked example offered as one, the template's
 * starting questions, each earlier project.
 */
function StartFrom(props: {
  template: TemplateDefinition;
  start?: ProjectStart;
  earlier: readonly ProjectSummary[];
}) {
  const { template, start } = props;
  const items = [
    { label: 'An empty form', start: undefined as ProjectStart | undefined },
    ...template.examples.flatMap((e, index) =>
      e.start ? [{ label: e.start, start: { kind: 'example', index } as ProjectStart }] : [],
    ),
    ...(template.questions
      ? [{ label: 'Answer a few questions', start: { kind: 'questions' } as ProjectStart }]
      : []),
    ...props.earlier.map((p) => ({
      label: `A copy of ${p.name}`,
      start: { kind: 'project', id: p.id } as ProjectStart,
    })),
  ];
  const isCurrent = (s: ProjectStart | undefined) => JSON.stringify(s) === JSON.stringify(start);
  return (
    <nav aria-labelledby="start-from">
      <Stack gap="2xs">
        <h2 id="start-from">Start from</h2>
        <PlainList>
          {items.map((item) => (
            <li key={item.label + JSON.stringify(item.start)}>
              {isCurrent(item.start) ? (
                <b aria-current="page">{item.label}</b>
              ) : (
                <a
                  href={href({
                    screen: 'new-project',
                    templateId: template.id,
                    ...(item.start ? { start: item.start } : {}),
                  })}
                >
                  {item.label}
                </a>
              )}
            </li>
          ))}
        </PlainList>
      </Stack>
    </nav>
  );
}

const newTitle = (template: TemplateDefinition) =>
  `New ${template.name.charAt(0).toLowerCase()}${template.name.slice(1)}`;

/** `from` is the plan's section Edit was opened from: Save and Cancel go back to it (#156). */
export function EditProjectScreen(props: { id: string; from?: PlanSectionId }) {
  const { loaded } = useLoad(
    () => send(api.api.projects[':id'].$get({ param: { id: props.id } })),
    props.id,
  );
  return (
    <Loaded state={loaded} loading="Loading project…">
      {(project) => <EditProject project={project} from={props.from} />}
    </Loaded>
  );
}

function EditProject(props: { project: Project; from?: PlanSectionId }) {
  const { project } = props;
  const template = findTemplate(project.templateId);
  if (!template) return <Notice>This project's template is no longer offered.</Notice>;
  if (!project.snapshot) {
    return (
      <Notice>
        This project's stored plan cannot be read ({project.unreadable?.message}), so it cannot be
        edited.
      </Notice>
    );
  }
  return (
    <ProjectEditor
      template={template}
      project={project}
      from={props.from}
      initial={{
        name: project.name,
        params: formValues(template.form.params, project.snapshot.params),
        inputs: formValues(template.form.structuralInputs, project.snapshot.structuralInputs),
      }}
    />
  );
}

interface EditorValues {
  name: string;
  params: FormValues;
  inputs: FormValues;
}

export function ProjectEditor(props: {
  template: TemplateDefinition;
  project?: Project;
  /** The plan's section to return to after Save or Cancel; the summary when absent. */
  from?: PlanSectionId;
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
  const [name, setName] = useState(props.initial.name);
  const [params, setParams] = useState(props.initial.params);
  const [inputs, setInputs] = useState(props.initial.inputs);
  const { issues, attempt, report } = useFormIssues({
    name: undefined as string | undefined,
    confirm: undefined as string | undefined,
    params: NO_ISSUES,
    inputs: NO_ISSUES,
  });
  const [confirmed, setConfirmed] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ state: 'idle' });
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
  const dirty =
    name !== props.initial.name ||
    !sameJson(params, props.initial.params) ||
    !sameJson(inputs, props.initial.inputs);
  const guard = useLeaveGuard(dirty && !saving);

  /** Shows what a save attempt found; returns whether it found anything. */
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
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
      ? await save(project, name.trim(), builtParams, builtInputs)
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
      navigate({ screen: 'project', id: result.value.id, section: props.from });
      return;
    }
    if (result.error.kind === 'invalid') {
      show(result.error.issues);
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
    (values[from][field.path] ?? '').trim() === '';
  const submitLabel = project ? 'Save changes' : 'Create project';
  const submitButton = (
    <Button type="submit" busy={saving} busyLabel="Saving…">
      {submitLabel}
    </Button>
  );

  const editing = (
    <Stack gap="l">
      <Field id="project-name" label="Project name" error={issues.name} width="medium">
        {(c) => <TextInput {...c} value={name} onChange={setName} readOnly={saving} />}
      </Field>
      <Stack gap="xs">
        <Text tone="muted">
          Fields marked "Input needed" are never filled in for you. Structural inputs can wait:
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

  // A saved project's output shows beside the form, previewed before saving (#39, L-A; #56).
  const saved = project ? readPlan(project) : null;
  const actions = (
    <Stack gap="s">
      <FormProgress
        entered={shown.length - shown.filter(empty).length}
        total={shown.length}
        empty={parts.flatMap((part) => {
          const first = part.fields.find(empty);
          return first ? [{ group: part.title, field: fieldId(first.from, first.field.path) }] : [];
        })}
      />
      {saveState.state === 'failed' && <SaveFailed failure={saveState.failure} />}
      <Cluster>
        {submitButton}
        <ButtonLink
          variant="secondary"
          href={
            project
              ? href({ screen: 'project', id: project.id, section: props.from })
              : href({ screen: 'projects' })
          }
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
          {(saved?.ok || !project) && (
            <EditPreview
              template={template}
              project={project ?? null}
              saved={saved?.ok ? saved.plan : null}
              params={params}
              inputs={inputs}
            />
          )}
        </WithAside>
      </Stack>
      {guard.dialog}
    </form>
  );
}

/** The id of a field's control, which the error summary and the progress links point to. */
const fieldId = (from: FormSource, path: string) => `${from === 'params' ? 'p' : 's'}-${path}`;

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

function EditPreview(props: {
  template: TemplateDefinition;
  project: Project | null;
  saved: Plan | null;
  params: FormValues;
  inputs: FormValues;
}) {
  const state = usePreview(props.template, props.project, props.params, props.inputs);
  return <PreviewPane saved={props.saved} state={state} />;
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

/**
 * What to send for an edit: only what changed, so renaming a project never regenerates it (and
 * never moves it to a newer template version without the owner changing a value).
 */
export function changesFor(
  project: Project,
  name: string,
  params: Record<string, unknown>,
  inputs: Record<string, unknown>,
) {
  const stored = project.snapshot;
  return {
    ...(name !== project.name ? { name } : {}),
    ...(stored && !sameJson(params, stored.params) ? { params } : {}),
    ...(stored && !sameJson(inputs, stored.structuralInputs) ? { structuralInputs: inputs } : {}),
  };
}

async function save(
  project: Project,
  name: string,
  params: Record<string, unknown>,
  inputs: Record<string, unknown>,
) {
  const changes = changesFor(project, name, params, inputs);
  if (Object.keys(changes).length === 0) return { ok: true as const, value: project };
  return send(api.api.projects[':id'].$put({ param: { id: project.id }, json: changes }));
}
