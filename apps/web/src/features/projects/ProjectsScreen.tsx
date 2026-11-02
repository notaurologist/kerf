import { useState } from 'react';
import { api, send } from '../../lib/api.ts';
import { takeFlash } from '../../lib/flash.ts';
import { Loaded } from '../../lib/Loaded.tsx';
import { href } from '../../lib/route.ts';
import type { ProjectSummary, TemplateSummary } from '../../lib/types.ts';
import { useLoad } from '../../lib/useLoad.ts';
import {
  ButtonLink,
  Cluster,
  Row,
  RowLink,
  Rows,
  ScreenHeader,
  Stack,
  StatusLine,
  StatusTag,
  Text,
} from '../../ui/index.ts';
import { buildingText, ResumeCard, resumeTarget, shoppingText } from '../modes/ModeCards.tsx';

// Projects with their status (PRODUCT.md, MVP features 2 and 8), most recently updated first.
// Status follows progress and is set by hand in Edit (#355), so the list only shows it.

export function ProjectsScreen() {
  const { loaded, reload } = useLoad(async () => {
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
  // "Moved to Deleted projects." from Delete stays until the next action (#67).
  const [flash] = useState(takeFlash);
  return (
    <Loaded
      state={loaded}
      shape="list"
      loading="Loading projects…"
      onRetry={reload}
      title="Projects"
    >
      {(value) => (
        <ProjectList projects={value.projects} templates={value.templates} flash={flash} />
      )}
    </Loaded>
  );
}

export function ProjectList(props: {
  projects: ProjectSummary[];
  templates: TemplateSummary[];
  /** What the last screen did, such as deleting a project. */
  flash?: string | null;
}) {
  const resuming = props.projects.find((p) => resumeTarget(p) !== null);
  const templateName = (id: string) => props.templates.find((t) => t.id === id)?.name ?? id;
  return (
    <Stack>
      <ScreenHeader
        title="Projects"
        status={props.flash && <StatusLine>{props.flash}</StatusLine>}
        actions={
          // One way to start, whatever the templates (#357). While there is somewhere to
          // resume, Go is the screen's one primary (Stage 10).
          <ButtonLink
            href={href({ screen: 'pick-template' })}
            variant={resuming ? 'secondary' : 'primary'}
          >
            New project
          </ButtonLink>
        }
      />
      {/* One Resume card (#40): the most recently updated project that has somewhere to resume. */}
      {resuming && <ResumeCard project={resuming} />}
      {props.projects.length === 0 ? (
        <Text>No projects yet. Start one with New project above.</Text>
      ) : (
        <Rows as="ul">
          {props.projects.map((p) => (
            <Row key={p.id} as="li">
              <Stack gap="2xs">
                <Cluster spread>
                  <RowLink href={href({ screen: 'project', id: p.id })}>{p.name}</RowLink>
                  <StatusTag status={p.status} />
                </Cluster>
                {p.progress && p.status !== 'planned' && (
                  <Text>
                    Shopping: {shoppingText(p.progress.shopping)}{' '}
                    {p.progress.steps.total > 0 && `Building: ${buildingText(p.progress)}`}
                  </Text>
                )}
                <Text tone="muted">
                  {templateName(p.templateId)}. Updated {new Date(p.updatedAt).toLocaleDateString()}
                  .
                </Text>
              </Stack>
            </Row>
          ))}
        </Rows>
      )}
    </Stack>
  );
}
