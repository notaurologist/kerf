import { findTemplate, planTerms } from '@kerf/core';
import { useMemo, useState } from 'react';
import { useArrowKeys } from '../../lib/arrowKeys.ts';
import { inputFieldId } from '../../lib/fieldIds.ts';
import { takeFlash } from '../../lib/flash.ts';
import { Loaded } from '../../lib/Loaded.tsx';
import { useReadProject } from '../../lib/plan.ts';
import { usePlanMoves } from '../../lib/planMoves.ts';
import { describeReset } from '../../lib/progress.ts';
import { useProject } from '../../lib/projectStore.ts';
import { href, redirect } from '../../lib/route.ts';
import { PLAN_SECTIONS, type PlanSectionId } from '../../lib/sections.ts';
import { cutDetailHeadingId, cutListPartId } from '../../lib/show.ts';
import { useTicks } from '../../lib/ticks.ts';
import type { Project } from '../../lib/types.ts';
import { loadCornerViews } from '../../lib/views.ts';
import {
  Definitions,
  IconButtonLink,
  InfoTip,
  Notice,
  PlanHead,
  PlanSection,
  ScreenHeader,
  SectionPager,
  Stack,
  StatusLine,
  StatusTag,
  useFrameProject,
  WithContents,
} from '../../ui/index.ts';
import { Boards } from '../boards/Boards.tsx';
import { BuildSteps } from '../build-steps/BuildSteps.tsx';
import { CutList } from '../cut-list/CutList.tsx';
import { Diagrams } from '../diagrams/Diagrams.tsx';
import { ModeButtons } from '../modes/ModeCards.tsx';
import { DeleteProject } from '../project-editor/DeleteProject.tsx';
import { ShoppingList } from '../shopping-list/ShoppingList.tsx';
import {
  neededReadings,
  projectStoreReadings,
  readingHref,
} from '../shopping-list/StoreReadings.tsx';
import {
  STRUCTURAL_REVIEW_INTRO,
  StructuralReview,
  WOOD_MOVEMENT_INTRO,
} from '../structural/StructuralReview.tsx';
import { ParametersAndInputs } from './ParametersAndInputs.tsx';
import { inputsNeeded, ProjectNext } from './ProjectNext.tsx';
import { VersionNotice } from './VersionNotice.tsx';

const VALUES_USED_ID = 'values-used';

// One project, rendered from the snapshot the API returns (ARCHITECTURE.md, apps/web). The
// stored plan is shown as stored; the web app computes none of its numbers.

const CUT_LIST_INTRO = `Lengths are long point to long point, rounded to 1/16". Angles are miter-saw settings (0° is square), with the angle to the board's edge for a protractor or sliding bevel.`;
const BUILD_STEPS_INTRO =
  'Methods are chosen from the tools in your toolbox. Change your toolbox to change them.';

export function ProjectScreen(props: { id: string; section?: PlanSectionId; part?: string }) {
  const { loaded, set, reload } = useProject(props.id);
  return (
    <Loaded state={loaded} shape="plan" loading="Loading project…" onRetry={reload} title="Project">
      {(project) => (
        <ProjectView project={project} section={props.section} part={props.part} onChange={set} />
      )}
    </Loaded>
  );
}

export function ProjectView(props: {
  project: Project;
  /** The section on screen (#156); when absent, the first that needs something (#356). */
  section?: PlanSectionId;
  /** The part selected in the drawings and the cut list, from the address. */
  part?: string;
  onChange?: (project: Project) => void;
}) {
  const { project } = props;
  const template = findTemplate(project.templateId);
  const { plan, drawings, steps } = useReadProject(project);
  const readings = useMemo(
    () => (plan.ok ? projectStoreReadings(project, plan.plan) : undefined),
    [project, plan],
  );
  const ticks = useTicks(project.id, project.ticks, project.revision);
  // Plans made before operations have no build steps.
  const hasSteps = steps !== null && steps.steps.length > 0;
  const terms = useMemo(
    () =>
      plan.ok
        ? planTerms(plan.plan, steps?.steps ?? [], [
            STRUCTURAL_REVIEW_INTRO,
            ...(plan.plan.movement.length > 0 ? [WOOD_MOVEMENT_INTRO] : []),
            CUT_LIST_INTRO,
            ...(hasSteps ? [BUILD_STEPS_INTRO] : []),
            ...neededReadings(readings).map((p) => p.reading.how),
          ])
        : [],
    [plan, steps, hasSteps, readings],
  );
  const shown = (id: PlanSectionId) =>
    (id !== 'diagrams' || drawings !== null) && (id !== 'build-steps' || hasSteps);
  const sections = PLAN_SECTIONS.filter((s) => shown(s.id));
  // A project opens on the structural review while inputs are needed, else on its drawings; a
  // section this plan does not have, such as build steps in an old plan, does the same.
  const landing =
    (plan.ok && inputsNeeded(plan.plan) > 0) || !shown('diagrams')
      ? 'structural-review'
      : 'diagrams';
  const current =
    sections.find((s) => s.id === props.section) ??
    sections.find((s) => s.id === landing) ??
    PLAN_SECTIONS[0];
  const at = (section: PlanSectionId, part?: string) =>
    href({ screen: 'project', id: project.id, section, ...(part ? { part } : {}) });
  const editHref = plan.ok
    ? href({ screen: 'edit-project', id: project.id, from: current.id })
    : undefined;
  const items = sections.map((s) => ({ id: s.id, title: s.title, href: at(s.id) }));
  // The values the plan was made from are in Edit (#356); the contents end with a way there.
  const valuesUsed = editHref && { title: 'Values used', href: editHref };
  // From 52.5rem the frame's sidebar lists the sections in place of the contents column (#265).
  useFrameProject({
    name: project.name,
    href: href({ screen: 'project', id: project.id }),
    ...(plan.ok
      ? { sections: { items, current: current.id, ...(valuesUsed ? { end: valuesUsed } : {}) } }
      : {}),
  });
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
  const inputHref = (key: string) => {
    const field = template && inputFieldId(template.form, key);
    return href({
      screen: 'edit-project',
      id: project.id,
      from: current.id,
      ...(field ? { field } : {}),
    });
  };

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
  useArrowKeys({
    previous: plan.ok && previous ? at(previous.id) : undefined,
    next: plan.ok && next ? at(next.id) : undefined,
  });
  // Every section stays in the page, so print gives the whole plan in order A from any of them;
  // on screen only the current one shows.
  const section = (id: PlanSectionId) => ({
    id,
    title: PLAN_SECTIONS.find((s) => s.id === id)?.title ?? id,
    project: project.name,
    hidden: id !== current.id,
    // The first section shares the printed first page with the header (#119).
    ...(id === sections[0]?.id ? { newPage: false } : {}),
  });
  return (
    <Stack gap="l">
      <PlanHead>
        <ScreenHeader
          title={project.name}
          pageTitle={`${current.title} · ${project.name}`}
          actions={
            // Quiet: the next mode in the header is the screen's one primary (Stage 10).
            plan.ok &&
            editHref && <IconButtonLink href={editHref} icon="edit" label="Edit" variant="quiet" />
          }
          tags={
            <>
              <StatusTag status={project.status} />
              <InfoTip label="About this plan">
                <b>Template</b> {template?.name ?? project.templateId}, version{' '}
                {project.templateVersion}.
              </InfoTip>
            </>
          }
          status={flash && <StatusLine>{flash}</StatusLine>}
        />
        {plan.ok && (
          <>
            <ProjectNext
              project={project}
              plan={plan.plan}
              steps={steps?.steps ?? []}
              reviewHref={at('structural-review')}
            />
            <ModeButtons project={project} plan={plan.plan} steps={steps?.steps ?? []} />
          </>
        )}
        <VersionNotice
          project={project}
          onRegenerated={(p) => {
            setFlashLine(describeReset(p.progressReset));
            props.onChange?.(p);
          }}
          onNewer={props.onChange}
        />
      </PlanHead>
      {!plan.ok ? (
        // With no plan there is no Edit, which is where Delete lives otherwise.
        <>
          <Notice>{plan.message}</Notice>
          <DeleteProject id={project.id} name={project.name} />
        </>
      ) : (
        // Section order A (#40): the same reading order in the contents, on screen, and on paper.
        <WithContents items={items} current={current.id} end={valuesUsed || undefined}>
          {drawings && (
            <PlanSection {...section('diagrams')}>
              <Diagrams
                drawings={drawings}
                rows={plan.plan.cutList}
                describedBy="cut-list"
                selected={selected}
                onSelect={select}
                partHref={(partId) => at('cut-list', partId)}
                corners={{
                  key: `${project.id}/${project.revision}`,
                  load: (corner) => loadCornerViews(project.id, corner),
                }}
              />
            </PlanSection>
          )}
          <PlanSection {...section('structural-review')}>
            <StructuralReview
              inputHref={inputHref}
              checks={plan.plan.checks}
              flags={plan.plan.flags}
              checklist={plan.plan.checklist}
              ticks={ticks}
              boltLayout={plan.plan.boltLayout}
              movement={plan.plan.movement}
            />
          </PlanSection>
          <PlanSection {...section('cut-list')} intro={CUT_LIST_INTRO}>
            <CutList
              rows={plan.plan.cutList}
              flags={plan.plan.flags}
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
              readings={
                readings && { byLine: readings, href: readingHref(project, 'shopping-list') }
              }
            />
          </PlanSection>
          {hasSteps && (
            <PlanSection {...section('build-steps')} intro={BUILD_STEPS_INTRO}>
              <BuildSteps
                steps={steps?.steps ?? []}
                rows={plan.plan.cutList}
                pieceHref={drawings ? (partId) => at('diagrams', partId) : undefined}
              />
            </PlanSection>
          )}
          {/* On paper the plan says what it was made from; on screen that is Edit. */}
          {template && project.snapshot && (
            <PlanSection id={VALUES_USED_ID} title="Values used" project={project.name} hidden>
              <ParametersAndInputs project={project} template={template} />
            </PlanSection>
          )}
          {/* A term's popover cannot open on paper, so the printed plan ends with the terms it
              uses. Never shown on screen, where each term opens in place (#178). */}
          <TermsUsed terms={terms} project={project.name} />
          <SectionPager
            previous={previous && { title: previous.title, href: at(previous.id) }}
            next={next && { title: next.title, href: at(next.id) }}
          />
        </WithContents>
      )}
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
