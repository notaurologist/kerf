import {
  buildFromForm,
  entryProblems,
  type FormSection,
  type FormValues,
  findTemplate,
  formValues,
  type Plan,
  type TemplateDefinition,
  visibleFields,
} from '@kerf/core';
import { type FormEvent, useState } from 'react';
import { api, describeError, type FieldIssue, send } from '../../lib/api.ts';
import { FieldInput } from '../../lib/FieldInput.tsx';
import { setFlash } from '../../lib/flash.ts';
import { readPlan } from '../../lib/plan.ts';
import { describeReset } from '../../lib/progress.ts';
import { href, navigate } from '../../lib/route.ts';
import type { Project } from '../../lib/types.ts';
import { useLoad } from '../../lib/useLoad.ts';
import {
  Button,
  ButtonLink,
  Card,
  Cluster,
  ErrorSummary,
  Field,
  FieldGroup,
  Grid,
  Loading,
  Notice,
  Sidebar,
  Stack,
  type SummaryItem,
  Text,
  TextInput,
  useLeaveGuard,
} from '../../ui/index.ts';
import { belongsTo, type FormIssues, NO_ISSUES, placeIssues, schemaIssues } from './issues.ts';
import { PreviewPane, usePreview } from './Preview.tsx';
import { sameJson } from './sameJson.ts';

// Create or edit a project's parameters and structural inputs (PRODUCT.md, MVP features 2 and
// 7). The template describes its form as data in core; this renders any template's form. Core's
// schemas check it before sending, and the API checks again, including combinations.

export function NewProjectScreen(props: { templateId: string }) {
  const template = findTemplate(props.templateId);
  if (!template) return <Notice>There is no template "{props.templateId}".</Notice>;
  return (
    <ProjectEditor
      template={template}
      initial={{
        name: '',
        params: formValues(template.form.params, {}),
        inputs: formValues(template.form.structuralInputs, {}),
      }}
    />
  );
}

export function EditProjectScreen(props: { id: string }) {
  const { loaded } = useLoad(
    () => send(api.api.projects[':id'].$get({ param: { id: props.id } })),
    props.id,
  );
  if (loaded.state === 'loading') return <Loading>Loading project…</Loading>;
  if (loaded.state === 'error') return <Notice>{describeError(loaded.error)}</Notice>;
  const project = loaded.value;
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
  initial: EditorValues;
}) {
  const { template, project } = props;
  const form = template.form;
  const [name, setName] = useState(props.initial.name);
  const [params, setParams] = useState(props.initial.params);
  const [inputs, setInputs] = useState(props.initial.inputs);
  const [issues, setIssues] = useState({
    name: undefined as string | undefined,
    params: NO_ISSUES,
    inputs: NO_ISSUES,
  });
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<{ message: string; connection: boolean } | null>(null);
  const dirty =
    name !== props.initial.name ||
    !sameJson(params, props.initial.params) ||
    !sameJson(inputs, props.initial.inputs);
  const guard = useLeaveGuard(dirty && !saving);

  const show = (fieldIssues: FieldIssue[], nameIssue?: string) => {
    const forParams = fieldIssues.filter(
      (i) => belongsTo(form.params, i.field) || !belongsTo(form.structuralInputs, i.field),
    );
    const forInputs = fieldIssues.filter((i) => !forParams.includes(i));
    setIssues({
      name: nameIssue,
      params: placeIssues(form.params, params, forParams),
      inputs: placeIssues(form.structuralInputs, inputs, forInputs),
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFailure(null);
    const builtParams = buildFromForm(form.params, params);
    const builtInputs = buildFromForm(form.structuralInputs, inputs);
    const p = template.params.safeParse(builtParams);
    const i = template.structuralInputs.safeParse(builtInputs);
    const nameIssue = name.trim() ? undefined : 'Enter a project name.';
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
    show(found, nameIssue);
    if (found.length > 0 || nameIssue) return;

    setSaving(true);
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
    setSaving(false);
    if (result.ok) {
      const reset = 'progressReset' in result.value ? result.value.progressReset : undefined;
      setFlash(project ? ['Saved.', describeReset(reset)].filter(Boolean).join(' ') : 'Created.');
      navigate({ screen: 'project', id: result.value.id });
      return;
    }
    if (result.error.kind === 'invalid') {
      show(result.error.issues);
      return;
    }
    setFailure({
      message: describeError(result.error),
      connection: result.error.kind === 'failed' && result.error.status === 0,
    });
  };

  const fieldLabel = (path: string) =>
    [...form.params, ...form.structuralInputs].flatMap((s) => s.fields).find((f) => f.path === path)
      ?.label;
  const summary: SummaryItem[] = [
    ...(issues.name ? [{ field: 'project-name', message: issues.name }] : []),
    ...Object.entries(issues.params.fields).map(([path, message]) => ({
      field: `p-${path}`,
      message: named(fieldLabel(path), message),
    })),
    ...Object.entries(issues.inputs.fields).map(([path, message]) => ({
      field: `s-${path}`,
      message: named(fieldLabel(path), message),
    })),
  ];
  const general = [...issues.params.general, ...issues.inputs.general];

  // A saved project's output shows beside the form, previewed before saving (#39, L-A; #56).
  const saved = project ? readPlan(project) : null;
  const editing = (
    <Stack gap="l">
      <Field id="project-name" label="Project name" error={issues.name}>
        {(c) => <TextInput {...c} value={name} onChange={setName} readOnly={saving} />}
      </Field>

      <h2>Dimensions and hardware</h2>
      <FormSections
        sections={form.params}
        values={params}
        issues={issues.params}
        onChange={setParams}
        prefix="p"
        readOnly={saving}
      />

      <h2>Structural inputs</h2>
      <Text tone="muted">
        These decide the structural checks. Leave any you have not settled empty; the checks that
        need them will say "Input needed". Nothing here is filled in for you.
      </Text>
      <FormSections
        sections={form.structuralInputs}
        values={inputs}
        issues={issues.inputs}
        onChange={setInputs}
        prefix="s"
        readOnly={saving}
        structural
      />

      {failure &&
        (failure.connection ? (
          <Notice icon="connection">
            <b>Not saved.</b> {failure.message} Your changes are still here.
          </Notice>
        ) : (
          <Notice>
            <b>Not saved.</b> {failure.message}
          </Notice>
        ))}
      <Cluster>
        <Button type="submit" busy={saving}>
          {saving ? 'Saving…' : project ? 'Save changes' : 'Create project'}
        </Button>
        <ButtonLink
          variant="secondary"
          href={
            project ? href({ screen: 'project', id: project.id }) : href({ screen: 'projects' })
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
        <h1>
          {project
            ? `Edit ${project.name}`
            : `New ${template.name.charAt(0).toLowerCase()}${template.name.slice(1)}`}
        </h1>
        <ErrorSummary items={summary} general={general} />
        {project?.version?.status === 'behind' && (
          <Card>
            <Text>
              Saving changed parameters or structural inputs regenerates this plan with template
              version {project.version.currentVersion}. It was made with version{' '}
              {project.version.storedVersion}.
            </Text>
          </Card>
        )}
        {saved?.ok && project ? (
          <Sidebar sideWidth="24rem" gap="l">
            {editing}
            <EditPreview
              template={template}
              project={project}
              saved={saved.plan}
              params={params}
              inputs={inputs}
            />
          </Sidebar>
        ) : (
          editing
        )}
      </Stack>
      {guard.dialog}
    </form>
  );
}

function EditPreview(props: {
  template: TemplateDefinition;
  project: Project;
  saved: Plan;
  params: FormValues;
  inputs: FormValues;
}) {
  const state = usePreview(props.template, props.project, props.params, props.inputs);
  return <PreviewPane saved={props.saved} state={state} />;
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

export function FormSections(props: {
  sections: readonly FormSection[];
  values: FormValues;
  issues: FormIssues;
  onChange: (values: FormValues) => void;
  prefix: string;
  readOnly?: boolean;
  /** Structural inputs: an empty one is shown as input needed, never filled in (#43, rule 4). */
  structural?: boolean;
}) {
  const visible = new Set(visibleFields(props.sections, props.values).map((f) => f.path));
  return (
    <Stack gap="l">
      {props.sections.map((section) => (
        <FieldGroup key={section.title} legend={section.title} help={section.help}>
          <Grid>
            {section.fields
              .filter((f) => visible.has(f.path))
              .map((field) => (
                <FieldInput
                  key={field.path}
                  id={`${props.prefix}-${field.path}`}
                  field={field}
                  text={props.values[field.path] ?? ''}
                  issue={props.issues.fields[field.path]}
                  readOnly={props.readOnly}
                  needed={props.structural}
                  onChange={(text) => props.onChange({ ...props.values, [field.path]: text })}
                />
              ))}
          </Grid>
        </FieldGroup>
      ))}
    </Stack>
  );
}
