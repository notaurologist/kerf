import { findTemplate } from '@kerf/core';
import { useState } from 'react';
import { api, describeError, send } from '../../lib/api.ts';
import { takeFlash } from '../../lib/flash.ts';
import { readDrawings, readPlan } from '../../lib/plan.ts';
import { href } from '../../lib/route.ts';
import { type Project, STATUS_LABELS } from '../../lib/types.ts';
import { useLoad } from '../../lib/useLoad.ts';
import {
  Button,
  Cluster,
  Loading,
  Notice,
  PlanSection,
  Stack,
  StatusLine,
  Text,
} from '../../ui/index.ts';
import { CutList } from '../cut-list/CutList.tsx';
import { Diagrams } from '../diagrams/Diagrams.tsx';
import { ShoppingList } from '../shopping-list/ShoppingList.tsx';
import { StructuralReview } from '../structural/StructuralReview.tsx';
import { DeleteProject } from './DeleteProject.tsx';
import { VersionNotice } from './VersionNotice.tsx';

// One project, rendered from the snapshot the API returns (ARCHITECTURE.md, apps/web). The
// stored plan is shown as stored; the web app computes none of its numbers.

export function ProjectScreen(props: { id: string }) {
  const { loaded, set } = useLoad(
    () => send(api.api.projects[':id'].$get({ param: { id: props.id } })),
    props.id,
  );
  if (loaded.state === 'loading') return <Loading>Loading project…</Loading>;
  if (loaded.state === 'error') return <Notice>{describeError(loaded.error)}</Notice>;
  return <ProjectView project={loaded.value} onChange={set} />;
}

export function ProjectView(props: { project: Project; onChange?: (project: Project) => void }) {
  const { project } = props;
  const template = findTemplate(project.templateId);
  const plan = readPlan(project);
  const drawings = readDrawings(project);
  // The part selected in a drawing or the cut list (#39, Q3); selecting it again clears it.
  const [selected, setSelected] = useState<string | null>(null);
  const select = (partId: string) => setSelected((s) => (s === partId ? null : partId));
  // "Saved." from the editor stays until the next action (#67), not a toast that disappears.
  const [flash] = useState(takeFlash);
  return (
    <Stack gap="l">
      <Stack gap="2xs">
        <h1>{project.name}</h1>
        <Text tone="muted">
          {STATUS_LABELS[project.status]}. {template?.name ?? project.templateId}, version{' '}
          {project.templateVersion}.{' '}
          {plan.ok && <a href={href({ screen: 'edit-project', id: project.id })}>Edit</a>}
        </Text>
        {flash && <StatusLine>{flash}</StatusLine>}
      </Stack>
      <VersionNotice project={project} onRegenerated={(p) => props.onChange?.(p)} />
      {!plan.ok ? (
        <Notice>{plan.message}</Notice>
      ) : (
        <>
          <nav aria-label="Sections">
            <Cluster>
              {SECTIONS.map((s) => (
                <Button key={s.id} variant="link" onClick={() => jump(s.id)}>
                  {s.title}
                </Button>
              ))}
            </Cluster>
          </nav>
          {/* Section order A (#40): the same reading order on screen and on paper. */}
          {drawings && (
            <PlanSection id="diagrams" title="Diagrams" project={project.name}>
              <Diagrams
                drawings={drawings}
                rows={plan.plan.cutList}
                describedBy="cut-list"
                selected={selected}
                onSelect={select}
              />
            </PlanSection>
          )}
          <PlanSection id="structural-review" title="Structural review" project={project.name}>
            <StructuralReview
              projectId={project.id}
              checks={plan.plan.checks}
              flags={plan.plan.flags}
              checklist={plan.plan.checklist}
              boltLayout={plan.plan.boltLayout}
            />
          </PlanSection>
          <PlanSection id="cut-list" title="Cut list" project={project.name}>
            <Text tone="muted">
              Lengths are long point to long point, rounded to 1/16". Angles are miter-saw settings
              (0° is square), with the angle to the board's edge for a protractor or sliding bevel.
            </Text>
            <CutList rows={plan.plan.cutList} selected={selected} onSelect={select} />
          </PlanSection>
          <PlanSection id="shopping-list" title="Shopping list" project={project.name}>
            <ShoppingList
              lumber={plan.plan.lumber}
              hardware={plan.plan.hardware}
              hardwareNotes={plan.plan.hardwareNotes}
            />
          </PlanSection>
        </>
      )}
      <DeleteProject id={project.id} name={project.name} />
    </Stack>
  );
}

const SECTIONS = [
  { id: 'diagrams', title: 'Diagrams' },
  { id: 'structural-review', title: 'Structural review' },
  { id: 'cut-list', title: 'Cut list' },
  { id: 'shopping-list', title: 'Shopping list' },
];

/** Scrolls to a section. The hash picks the screen, so in-page jumps cannot use it. */
function jump(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  });
}
