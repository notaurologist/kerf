import {
  buildFromForm,
  entryEcho,
  entryProblems,
  type FormField,
  type FormSection,
  type FormValues,
  findTemplate,
  formValues,
  type TemplateDefinition,
  visibleFields,
} from '@kerf/core';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Notice } from '../../components/Shell.tsx';
import { api, describeError, type FieldIssue, send } from '../../lib/api.ts';
import { href, navigate } from '../../lib/route.ts';
import type { Project } from '../../lib/types.ts';
import { useLoad } from '../../lib/useLoad.ts';
import { belongsTo, type FormIssues, NO_ISSUES, placeIssues, schemaIssues } from './issues.ts';

// Create or edit a project's parameters and structural inputs (PRODUCT.md, MVP features 2 and
// 7). The template describes its form as data in core; this renders any template's form. Core's
// schemas check it before sending, and the API checks again, including combinations.

export function NewProjectScreen(props: { templateId: string }) {
  const template = findTemplate(props.templateId);
  if (!template) return <Notice tone="error">There is no template "{props.templateId}".</Notice>;
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
  if (loaded.state === 'loading') return <Notice>Loading project…</Notice>;
  if (loaded.state === 'error') return <Notice tone="error">{describeError(loaded.error)}</Notice>;
  const project = loaded.value;
  const template = findTemplate(project.templateId);
  if (!template) return <Notice tone="error">This project's template is no longer offered.</Notice>;
  if (!project.snapshot) {
    return (
      <Notice tone="error">
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

/** Same JSON value, whatever the key order. */
function sameJson(a: unknown, b: unknown): boolean {
  const canonical = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canonical)
      : typeof v === 'object' && v !== null
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
          )
        : v;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
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
  const [failure, setFailure] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // After a failed save, move to the first marked field: on a phone it is usually off screen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when a new set of issues is shown.
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [issues]);

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
    const nameIssue = name.trim() ? undefined : 'Give the project a name.';
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
    if (found.length > 0 || nameIssue) {
      setFailure('Fix the marked fields, then save again.');
      return;
    }

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
      navigate({ screen: 'project', id: result.value.id });
      return;
    }
    if (result.error.kind === 'invalid') show(result.error.issues);
    setFailure(
      result.error.kind === 'invalid'
        ? 'The plan cannot be made from these values. Fix the marked fields, then save again.'
        : describeError(result.error),
    );
  };

  return (
    <form ref={formRef} onSubmit={submit} className="editor" noValidate>
      <h1>
        {project
          ? `Edit ${project.name}`
          : `New ${template.name.charAt(0).toLowerCase()}${template.name.slice(1)}`}
      </h1>
      {project?.version?.status === 'behind' && (
        <p className="notice">
          Saving changed parameters or structural inputs regenerates this plan with template version{' '}
          {project.version.currentVersion}. It was made with version {project.version.storedVersion}
          .
        </p>
      )}
      <label className="field">
        <span>Project name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={issues.name ? true : undefined}
          maxLength={200}
        />
        {issues.name && <span className="error">{issues.name}</span>}
      </label>

      <h2>Design</h2>
      <FormSections
        sections={form.params}
        values={params}
        issues={issues.params}
        onChange={setParams}
        prefix="p"
      />

      <h2>Structural inputs</h2>
      <p className="muted">
        These decide the sanity checks. Leave any you have not settled empty; the checks that need
        them will say "input needed". Nothing here is filled in for you.
      </p>
      <FormSections
        sections={form.structuralInputs}
        values={inputs}
        issues={issues.inputs}
        onChange={setInputs}
        prefix="s"
      />

      {[...issues.params.general, ...issues.inputs.general].map((m) => (
        <Notice key={m} tone="error">
          {m}
        </Notice>
      ))}
      {failure && <Notice tone="error">{failure}</Notice>}
      <div className="row actions">
        <button type="submit" className="primary" disabled={saving}>
          {saving ? 'Saving…' : project ? 'Save changes' : 'Create project'}
        </button>
        <a
          href={
            project ? href({ screen: 'project', id: project.id }) : href({ screen: 'projects' })
          }
        >
          Cancel
        </a>
      </div>
    </form>
  );
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
}) {
  const visible = new Set(visibleFields(props.sections, props.values).map((f) => f.path));
  return (
    <>
      {props.sections.map((section) => (
        <fieldset key={section.title} className="section">
          <legend>{section.title}</legend>
          {section.help && <p className="muted">{section.help}</p>}
          <div className="fields">
            {section.fields
              .filter((f) => visible.has(f.path))
              .map((field) => (
                <FieldInput
                  key={field.path}
                  id={`${props.prefix}-${field.path}`}
                  field={field}
                  text={props.values[field.path] ?? ''}
                  issue={props.issues.fields[field.path]}
                  onChange={(text) => props.onChange({ ...props.values, [field.path]: text })}
                />
              ))}
          </div>
        </fieldset>
      ))}
    </>
  );
}

// Lengths carry no unit after the field: they can be typed in feet and inches, and the line
// under the field says how Kerf read them.
const UNITS: Partial<Record<FormField['kind'], string>> = { angle: '°' };

/** The format a length is typed in, shown with its help (content guide: hints give the format, never a sample value). */
const LENGTH_HINT = 'Inches, or feet and inches.';

/** Which on-screen keyboard to show. Lengths and fractions need ', ", /, and -. */
function keyboard(field: FormField): 'numeric' | 'decimal' | 'text' {
  if (field.kind === 'integer') return 'numeric';
  if (field.kind === 'length' || (field.kind === 'number' && field.fractions)) return 'text';
  return 'decimal';
}

export function FieldInput(props: {
  id: string;
  field: FormField;
  text: string;
  issue: string | undefined;
  onChange: (text: string) => void;
}) {
  const { field, text, issue } = props;
  const unit = field.unit ?? UNITS[field.kind];
  const describedBy = `${props.id}-help`;
  const echo = entryEcho(field, text);
  const help =
    field.kind === 'length' ? [field.help, LENGTH_HINT].filter(Boolean).join(' ') : field.help;
  const typed = keyboard(field) === 'text';
  const control =
    field.kind === 'choice' || field.kind === 'yes-no' ? (
      <select
        id={props.id}
        value={text}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={issue ? true : undefined}
        aria-describedby={describedBy}
      >
        <option value="">Choose…</option>
        {(field.kind === 'yes-no'
          ? [
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
            ]
          : (field.options ?? [])
        ).map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    ) : (
      <span className="with-unit">
        <input
          id={props.id}
          value={text}
          inputMode={keyboard(field)}
          autoCapitalize={typed ? 'off' : undefined}
          autoCorrect={typed ? 'off' : undefined}
          spellCheck={typed ? false : undefined}
          onChange={(e) => props.onChange(e.target.value)}
          aria-invalid={issue ? true : undefined}
          aria-describedby={describedBy}
        />
        {unit && <span className="unit">{unit}</span>}
      </span>
    );
  return (
    <div className="field">
      <label htmlFor={props.id}>
        <span>{field.label}</span>
      </label>
      {control}
      <small id={describedBy}>
        {echo && <strong className="echo">{echo}</strong>}
        {echo && help ? ' · ' : ''}
        {help}
      </small>
      {issue && <span className="error">{issue}</span>}
    </div>
  );
}
