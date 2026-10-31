import { useState } from 'react';
import { api, describeError, send } from '../../lib/api.ts';
import { Loaded } from '../../lib/Loaded.tsx';
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
  Notice,
  PlainList,
  ScreenHeader,
  Stack,
  Text,
} from '../../ui/index.ts';
import { buildingText, ResumeCard, resumeTarget, shoppingText } from '../modes/ModeCards.tsx';

// Projects with their status (PRODUCT.md, MVP features 2 and 8), most recently updated first.

export function ProjectsScreen() {
  const { loaded, set, reload } = useLoad(async () => {
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
  }, 'projects');
  const [error, setError] = useState<string | null>(null);

  const changeStatus = async (
    { projects, templates }: { projects: ProjectSummary[]; templates: TemplateSummary[] },
    id: string,
    status: ProjectStatus,
  ) => {
    setError(null);
    const result = await send(api.api.projects[':id'].$put({ param: { id }, json: { status } }));
    if (!result.ok) {
      setError(describeError(result.error));
      return;
    }
    // The API moves an updated project to the top; keep the list in the order it would return.
    set({ templates, projects: [toSummary(result.value), ...projects.filter((p) => p.id !== id)] });
  };

  return (
    <Loaded state={loaded} loading="Loading projects…" onRetry={reload} title="Projects">
      {(value) => (
        <ProjectList
          projects={value.projects}
          templates={value.templates}
          error={error}
          onStatus={(id, status) => void changeStatus(value, id, status)}
        />
      )}
    </Loaded>
  );
}

export function toSummary(project: Project): ProjectSummary {
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
  error?: string | null;
  onStatus: (id: string, status: ProjectStatus) => void;
}) {
  const resuming = props.projects.find((p) => resumeTarget(p) !== null);
  const templateName = (id: string) => props.templates.find((t) => t.id === id)?.name ?? id;
  return (
    <Stack>
      <ScreenHeader
        title="Projects"
        actions={props.templates.map((t) => (
          <ButtonLink key={t.id} href={href({ screen: 'new-project', templateId: t.id })}>
            New {t.name.charAt(0).toLowerCase() + t.name.slice(1)}
          </ButtonLink>
        ))}
      />
      {props.error && <Notice>{props.error}</Notice>}
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
                    onChange={(status) => props.onStatus(p.id, status as ProjectStatus)}
                  />
                </Cluster>
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
