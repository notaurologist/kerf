import { findTemplate, planTerms } from '@kerf/core';
import { useEffect, useState } from 'react';
import { api, send } from '../../lib/api.ts';
import { takeFlash } from '../../lib/flash.ts';
import { Loaded } from '../../lib/Loaded.tsx';
import { readDrawings, readPlan, readSteps } from '../../lib/plan.ts';
import { usePlanMoves } from '../../lib/planMoves.ts';
import { describeReset } from '../../lib/progress.ts';
import { href, redirect } from '../../lib/route.ts';
import { PLAN_SECTIONS, type PlanSectionId } from '../../lib/sections.ts';
import { cutDetailHeadingId, cutListPartId } from '../../lib/show.ts';
import { type Project, STATUS_LABELS } from '../../lib/types.ts';
import { useLoad } from '../../lib/useLoad.ts';
import {
  Button,
  ButtonLink,
  Definitions,
  Notice,
  PlanSection,
  ScreenHeader,
  SectionPager,
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

export function ProjectScreen(props: { id: string; section?: PlanSectionId; part?: string }) {
  const { loaded, set } = useLoad(
    () => send(api.api.projects[':id'].$get({ param: { id: props.id } })),
    props.id,
  );
  return (
    <Loaded state={loaded} loading="Loading project…">
      {(project) => (
        <ProjectView project={project} section={props.section} part={props.part} onChange={set} />
      )}
    </Loaded>
  );
}

export function ProjectView(props: {
  project: Project;
  /** The section on screen (#156); the summary when absent. */
  section?: PlanSectionId;
  /** The part selected in the drawings and the cut list, from the address. */
  part?: string;
  onChange?: (project: Project) => void;
}) {
  const { project } = props;
  const template = findTemplate(project.templateId);
  const plan = readPlan(project);
  const drawings = readDrawings(project);
  const steps = readSteps(project);
  // Plans made before operations (template version 8) have no build steps.
  const hasSteps = steps !== null && steps.steps.length > 0;
  const shown = (id: PlanSectionId) =>
    (id !== 'diagrams' || drawings !== null) &&
    (id !== 'build-steps' || hasSteps) &&
    (id !== 'parameters' || (template !== undefined && project.snapshot !== null));
  const sections = PLAN_SECTIONS.filter((s) => shown(s.id));
  // A section this plan does not have, such as build steps in an old plan, shows the summary.
  const current = sections.find((s) => s.id === props.section) ?? PLAN_SECTIONS[0];
  const at = (section: PlanSectionId, part?: string) =>
    href({ screen: 'project', id: project.id, section, ...(part ? { part } : {}) });
  // The part selected in a drawing or the cut list (#39, Q3), carried in the address (#156).
  // Selecting it replaces the history entry, so selections do not fill Back; selecting it again
  // clears it.
  const selected = props.part ?? null;
  const select = (partId: string) =>
    redirect({
      screen: 'project',
      id: project.id,
      section: current.id,
      ...(selected === partId ? {} : { part: partId }),
    });
  // "Saved." from the editor stays until the next action (#67), not a toast that disappears. A
  // regenerate that clears ticks says so the same way (#57).
  const [flash, setFlashLine] = useState(takeFlash);
  const editHref = plan.ok
    ? href({
        screen: 'edit-project',
        id: project.id,
        ...(current.id === 'summary' ? {} : { from: current.id }),
      })
    : undefined;

  useEffect(() => {
    const before = document.title;
    document.title = `${current.title} · ${project.name} · Kerf`;
    return () => {
      document.title = before;
    };
  }, [current.title, project.name]);

  // After a move, focus goes to the section's heading; arriving with a part goes to it instead.
  usePlanMoves(
    current.id,
    selected && current.id === 'diagrams'
      ? cutDetailHeadingId(selected)
      : selected && current.id === 'cut-list'
        ? cutListPartId(selected)
        : `${current.id}-heading`,
  );

  const index = sections.indexOf(current);
  const previous = sections[index - 1];
  const next = sections[index + 1];
  // Every section stays in the page, so print gives the whole plan in order A from any of them;
  // on screen only the current one shows.
  const section = (id: PlanSectionId) => ({
    id,
    title: PLAN_SECTIONS.find((s) => s.id === id)?.title ?? id,
    project: project.name,
    hidden: id !== current.id,
  });
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
        <WithContents
          items={sections.map((s) => ({ id: s.id, title: s.title, href: at(s.id) }))}
          current={current.id}
        >
          <PlanSection {...section('summary')} newPage={false}>
            <PlanSummary
              project={project}
              plan={plan.plan}
              steps={steps?.steps ?? []}
              drawings={drawings}
              template={template}
              sections={sections
                .filter((s) => s.id !== 'summary')
                .map((s) => ({ id: s.id, title: s.title, href: at(s.id) }))}
              editHref={editHref}
            />
          </PlanSection>
          {drawings && (
            <PlanSection {...section('diagrams')}>
              <Diagrams
                drawings={drawings}
                rows={plan.plan.cutList}
                describedBy="cut-list"
                selected={selected}
                onSelect={select}
                partHref={(partId) => at('cut-list', partId)}
              />
            </PlanSection>
          )}
          <PlanSection {...section('structural-review')}>
            <StructuralReview
              projectId={project.id}
              checks={plan.plan.checks}
              flags={plan.plan.flags}
              checklist={plan.plan.checklist}
              boltLayout={plan.plan.boltLayout}
            />
          </PlanSection>
          <PlanSection
            {...section('cut-list')}
            intro={`Lengths are long point to long point, rounded to 1/16". Angles are miter-saw settings (0° is square), with the angle to the board's edge for a protractor or sliding bevel.`}
          >
            <CutList
              rows={plan.plan.cutList}
              selected={selected}
              partHref={drawings ? (partId) => at('diagrams', partId) : undefined}
            />
          </PlanSection>
          <PlanSection {...section('boards')}>
            <Boards
              lumber={plan.plan.lumber}
              rows={plan.plan.cutList}
              drawings={drawings?.boards ?? []}
            />
          </PlanSection>
          <PlanSection {...section('shopping-list')}>
            <ShoppingList
              lumber={plan.plan.lumber}
              hardware={plan.plan.hardware}
              hardwareNotes={plan.plan.hardwareNotes}
            />
          </PlanSection>
          {hasSteps && (
            <PlanSection
              {...section('build-steps')}
              intro="Methods are chosen from the tools in your tool list. Change the list to change them."
            >
              <BuildSteps
                steps={steps?.steps ?? []}
                rows={plan.plan.cutList}
                pieceHref={drawings ? (partId) => at('diagrams', partId) : undefined}
              />
            </PlanSection>
          )}
          {template && shown('parameters') && (
            <PlanSection {...section('parameters')}>
              <ParametersAndInputs project={project} template={template} editHref={editHref} />
            </PlanSection>
          )}
          {/* A term's popover cannot open on paper, so the printed plan ends with the terms it
              uses. Never shown on screen, where each term opens in place (#178). */}
          <TermsUsed terms={planTerms(plan.plan, steps?.steps ?? [])} project={project.name} />
          <SectionPager
            previous={previous && { title: previous.title, href: at(previous.id) }}
            next={next && { title: next.title, href: at(next.id) }}
          />
        </WithContents>
      )}
      <DeleteProject id={project.id} name={project.name} />
    </Stack>
  );
}

function TermsUsed(props: { terms: ReturnType<typeof planTerms>; project: string }) {
  if (props.terms.length === 0) return null;
  return (
    <PlanSection id="terms-used" title="Terms used in this plan" project={props.project} hidden>
      <Definitions
        items={props.terms.map((entry) => ({
          id: `terms-used-${entry.id}`,
          term: entry.term,
          definition: entry.definition,
        }))}
      />
    </PlanSection>
  );
}
