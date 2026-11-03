import { findTemplate, formValues, suggestedFields } from '@kerf/core';
import { api, send } from '../../lib/api.ts';
import { Loaded } from '../../lib/Loaded.tsx';
import { type EditFrom, editReturn, href } from '../../lib/route.ts';
import type { Project } from '../../lib/types.ts';
import { useLoad } from '../../lib/useLoad.ts';
import { ProblemScreen, Stack, useFrameProject } from '../../ui/index.ts';
import { DeleteProject } from './DeleteProject.tsx';
import { ProjectEditor } from './ProjectEditor.tsx';

/**
 * `from` is the plan's section Edit was opened from, or Shopping or Building mode: Save, Cancel,
 * and the back link go back to it (#156, #390).
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
  const back = { href: href(editReturn(project.id, props.from)), label: project.name };
  // The title bar's back link names the project (#265) and goes back where Edit was opened.
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
      suggested={suggestedFields(template.form, project.snapshot)}
    />
  );
}
