import { findTemplate } from '@kerf/core';
import { useState } from 'react';
import { api, send } from '../../lib/api.ts';
import { takeFlash } from '../../lib/flash.ts';
import { Loaded } from '../../lib/Loaded.tsx';
import { readDrawings, readPlan, readSteps } from '../../lib/plan.ts';
import { describeReset } from '../../lib/progress.ts';
import { href } from '../../lib/route.ts';
import { type Project, STATUS_LABELS } from '../../lib/types.ts';
import { useLoad } from '../../lib/useLoad.ts';
import {
  Button,
  ButtonLink,
  Notice,
  PlanSection,
  ScreenHeader,
  Stack,
  StatusLine,
  WithContents,
} from '../../ui/index.ts';
import { Boards } from '../boards/Boards.tsx';
import { BuildSteps } from '../build-steps/BuildSteps.tsx';
import { CutList } from '../cut-list/CutList.tsx';
import { Diagrams } from '../diagrams/Diagrams.tsx';
import { ShoppingList } from '../shopping-list/ShoppingList.tsx';
import { StructuralReview } from '../structural/StructuralReview.tsx';
import { DeleteProject } from './DeleteProject.tsx';
import { ParametersAndInputs } from './ParametersAndInputs.tsx';
import { PlanSummary } from './PlanSummary.tsx';
import { VersionNotice } from './VersionNotice.tsx';

// One project, rendered from the snapshot the API returns (ARCHITECTURE.md, apps/web). The
// stored plan is shown as stored; the web app computes none of its numbers.

export function ProjectScreen(props: { id: string }) {
  const { loaded, set } = useLoad(
    () => send(api.api.projects[':id'].$get({ param: { id: props.id } })),
    props.id,
  );
  return (
    <Loaded state={loaded} loading="Loading project…">
      {(project) => <ProjectView project={project} onChange={set} />}
    </Loaded>
  );
}

export function ProjectView(props: { project: Project; onChange?: (project: Project) => void }) {
  const { project } = props;
  const template = findTemplate(project.templateId);
  const plan = readPlan(project);
  const drawings = readDrawings(project);
  const steps = readSteps(project);
  // Plans made before operations (template version 8) have no build steps.
  const hasSteps = steps !== null && steps.steps.length > 0;
  // The part selected in a drawing or the cut list (#39, Q3); selecting it again clears it.
  const [selected, setSelected] = useState<string | null>(null);
  const select = (partId: string) => setSelected((s) => (s === partId ? null : partId));
  // "Saved." from the editor stays until the next action (#67), not a toast that disappears. A
  // regenerate that clears ticks says so the same way (#57).
  const [flash, setFlashLine] = useState(takeFlash);
  const editHref = plan.ok ? href({ screen: 'edit-project', id: project.id }) : undefined;
  const shown = (id: SectionId) =>
    (id !== 'diagrams' || drawings !== null) &&
    (id !== 'build-steps' || hasSteps) &&
    (id !== 'parameters' || (template !== undefined && project.snapshot !== null));
  return (
    <Stack gap="l">
      <ScreenHeader
        title={project.name}
        actions={
          plan.ok && (
            <>
              {/* Prints the plan in section order A (#40), with every "Show the working" open. */}
              <Button variant="secondary" onClick={() => window.print()}>
                Print
              </Button>
              {editHref && <ButtonLink href={editHref}>Edit</ButtonLink>}
            </>
          )
        }
        meta={`${STATUS_LABELS[project.status]}. ${template?.name ?? project.templateId}, version ${project.templateVersion}.`}
        status={flash && <StatusLine>{flash}</StatusLine>}
      />
      <VersionNotice
        project={project}
        onRegenerated={(p) => {
          setFlashLine(describeReset(p.progressReset));
          props.onChange?.(p);
        }}
      />
      {!plan.ok ? (
        <Notice>{plan.message}</Notice>
      ) : (
        // Section order A (#40): the same reading order in the contents, on screen, and on paper.
        <WithContents items={SECTIONS.filter((s) => shown(s.id))}>
          <PlanSection id="summary" title="Summary" project={project.name} newPage={false}>
            <PlanSummary
              project={project}
              plan={plan.plan}
              steps={steps?.steps ?? []}
              editHref={editHref}
            />
          </PlanSection>
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
          <PlanSection
            id="cut-list"
            title="Cut list"
            project={project.name}
            intro={`Lengths are long point to long point, rounded to 1/16". Angles are miter-saw settings (0° is square), with the angle to the board's edge for a protractor or sliding bevel.`}
          >
            <CutList rows={plan.plan.cutList} selected={selected} onSelect={select} />
          </PlanSection>
          <PlanSection id="boards" title="Boards" project={project.name}>
            <Boards
              lumber={plan.plan.lumber}
              rows={plan.plan.cutList}
              drawings={drawings?.boards ?? []}
            />
          </PlanSection>
          <PlanSection id="shopping-list" title="Shopping list" project={project.name}>
            <ShoppingList
              lumber={plan.plan.lumber}
              hardware={plan.plan.hardware}
              hardwareNotes={plan.plan.hardwareNotes}
            />
          </PlanSection>
          {hasSteps && (
            <PlanSection
              id="build-steps"
              title="Build steps"
              project={project.name}
              intro="Methods are chosen from the tools in your tool list. Change the list to change them."
            >
              <BuildSteps steps={steps?.steps ?? []} rows={plan.plan.cutList} />
            </PlanSection>
          )}
          {template && shown('parameters') && (
            <PlanSection id="parameters" title="Parameters and inputs" project={project.name}>
              <ParametersAndInputs project={project} template={template} editHref={editHref} />
            </PlanSection>
          )}
        </WithContents>
      )}
      <DeleteProject id={project.id} name={project.name} />
    </Stack>
  );
}

/** The plan's sections in order A (#40). */
const SECTIONS = [
  { id: 'summary', title: 'Summary' },
  { id: 'diagrams', title: 'Diagrams' },
  { id: 'structural-review', title: 'Structural review' },
  { id: 'cut-list', title: 'Cut list' },
  { id: 'boards', title: 'Boards' },
  { id: 'shopping-list', title: 'Shopping list' },
  { id: 'build-steps', title: 'Build steps' },
  { id: 'parameters', title: 'Parameters and inputs' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];
