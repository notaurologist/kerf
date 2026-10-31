import { useRef, useState } from 'react';
import { api, describeError, send } from '../../lib/api.ts';
import { Loaded } from '../../lib/Loaded.tsx';
import { newProjectLabel } from '../../lib/names.ts';
import { type Listed, projectList } from '../../lib/projectStore.ts';
import { href } from '../../lib/route.ts';
import {
  type Project,
  type ProjectStatus,
  type ProjectSummary,
  STATUS_LABELS,
  STATUSES,
  type TemplateSummary,
} from '../../lib/types.ts';
import { useLoad } from '../../lib/useLoad.ts';
import {
  ButtonLink,
  Card,
  Cluster,
  CompactSelect,
  ErrorText,
  PlainList,
  ScreenHeader,
  Stack,
  Text,
} from '../../ui/index.ts';
import { buildingText, ResumeCard, resumeTarget, shoppingText } from '../modes/ModeCards.tsx';

// Projects with their status (PRODUCT.md, MVP features 2 and 8), most recently updated first.

export function ProjectsScreen() {
  const { loaded, update, reload } = useLoad(
    async () => {
      const [projects, templates] = await Promise.all([
        send(api.api.projects.$get()),
        send(api.api.templates.$get()),
      ]);
      if (!projects.ok) return projects;
      if (!templates.ok) return templates;
      return {
        ok: true,
        value: { projects: projects.value.projects, templates: templates.value.templates },
      };
    },
    'projects',
    projectList,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  // The latest change sent for each project, so an earlier answer cannot undo a later choice.
  const sent = useRef(new Map<string, number>());
  const change = (edit: (projects: ProjectSummary[]) => ProjectSummary[]) =>
    update((value: Listed) => ({ ...value, projects: edit(value.projects) }));

  // Shown at once and sent; put back, with the reason on the row, if the server refuses it.
  const changeStatus = async (id: string, status: ProjectStatus, before: ProjectStatus) => {
    const n = (sent.current.get(id) ?? 0) + 1;
    sent.current.set(id, n);
    setErrors(({ [id]: _, ...rest }) => rest);
    change((projects) => withStatus(projects, id, status));
    const result = await send(api.api.projects[':id'].$put({ param: { id }, json: { status } }));
    if (sent.current.get(id) !== n) return;
    if (!result.ok) {
      change((projects) => withStatus(projects, id, before));
      setErrors((e) => ({ ...e, [id]: describeError(result.error) }));
      return;
    }
    change((projects) => savedFirst(projects, toSummary(result.value)));
  };

  return (
    <Loaded state={loaded} loading="Loading projects…" onRetry={reload} title="Projects">
      {(value) => (
        <ProjectList
          projects={value.projects}
          templates={value.templates}
          errors={errors}
          onStatus={(id, status, before) => void changeStatus(id, status, before)}
        />
      )}
    </Loaded>
  );
}

/** The list with one project's status changed in place. */
export function withStatus(
  projects: readonly ProjectSummary[],
  id: string,
  status: ProjectStatus,
): ProjectSummary[] {
  return projects.map((p) => (p.id === id ? { ...p, status } : p));
}

/** The list as the API would return it after a save: the saved project first. */
export function savedFirst(
  projects: readonly ProjectSummary[],
  saved: ProjectSummary,
): ProjectSummary[] {
  return [saved, ...projects.filter((p) => p.id !== saved.id)];
}

function toSummary(project: Project): ProjectSummary {
  const { id, name, status, templateId, templateVersion, templateBehind, progress } = project;
  const { createdAt, updatedAt } = project;
  return {
    id,
    name,
    status,
    templateId,
    templateVersion,
    templateBehind,
    progress,
    createdAt,
    updatedAt,
  };
}

export function ProjectList(props: {
  projects: ProjectSummary[];
  templates: TemplateSummary[];
  /** Why a project's status change did not go through, by project. */
  errors?: Readonly<Record<string, string>>;
  onStatus: (id: string, status: ProjectStatus, before: ProjectStatus) => void;
}) {
  const resuming = props.projects.find((p) => resumeTarget(p) !== null);
  const templateName = (id: string) => props.templates.find((t) => t.id === id)?.name ?? id;
  return (
    <Stack>
      <ScreenHeader
        title="Projects"
        actions={props.templates.map((t) => (
          <ButtonLink key={t.id} href={href({ screen: 'new-project', templateId: t.id })}>
            {newProjectLabel(t.name)}
          </ButtonLink>
        ))}
      />
      {/* One Resume card (#40): the most recently updated project that has somewhere to resume. */}
      {resuming && <ResumeCard project={resuming} />}
      {props.projects.length === 0 ? (
        <Text>No projects yet. Start one with a New button above.</Text>
      ) : (
        <PlainList>
          {props.projects.map((p) => (
            <Card key={p.id} as="li">
              <Stack gap="2xs">
                <Cluster spread>
                  <a href={href({ screen: 'project', id: p.id })}>
                    <b>{p.name}</b>
                  </a>
                  <CompactSelect
                    label={`Status of ${p.name}`}
                    value={p.status}
                    options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
                    onChange={(status) => props.onStatus(p.id, status as ProjectStatus, p.status)}
                  />
                </Cluster>
                {props.errors?.[p.id] && (
                  <ErrorText alert>Status not changed. {props.errors[p.id]}</ErrorText>
                )}
                {p.progress && p.status !== 'planned' && (
                  <Text>
                    Shopping: {shoppingText(p.progress.shopping)}{' '}
                    {p.progress.steps.total > 0 && `Building: ${buildingText(p.progress)}`}
                  </Text>
                )}
                <Text tone="muted">
                  {templateName(p.templateId)}, version {p.templateVersion}. Updated{' '}
                  {new Date(p.updatedAt).toLocaleDateString()}.
                </Text>
                {p.templateBehind && (
                  <Text>
                    The template has a newer version. Open the project to see what regenerating
                    would change.
                  </Text>
                )}
              </Stack>
            </Card>
          ))}
        </PlainList>
      )}
    </Stack>
  );
}
