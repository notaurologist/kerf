import {
  type BuildStep,
  enteredValues,
  FLAG_CATEGORY_LABELS,
  type Flag,
  type geometry,
  type Plan,
  type PlanDigests,
  planDigests,
  structural,
  type TemplateDefinition,
} from '@kerf/core';
import { arriveAt } from '../../lib/planMoves.ts';
import type { PlanSectionId } from '../../lib/sections.ts';
import { EXPERT_CHECKS_ID } from '../../lib/show.ts';
import type { Project } from '../../lib/types.ts';
import {
  ExpertCheck,
  type Figure,
  Figures,
  InputNeeded,
  MarginLine,
  Measured,
  OneLine,
  PlainList,
  SectionList,
  Stack,
  Text,
} from '../../ui/index.ts';
import { ModeCards } from '../modes/ModeCards.tsx';

// The summary that opens the plan (#40, revised laptop plan; #119): the results the template
// counts as key, the lowest margin, the ways into Shopping and Building, the expert checks in
// one line each, and every other section with a line saying what is in it (#156). Core chooses
// the key results and the lowest margin and counts the digests (hard rules 1 and 6); this only
// lays them out.

/** Which of core's digests says what is in each section. */
const DIGESTS: Record<Exclude<PlanSectionId, 'summary'>, keyof PlanDigests> = {
  diagrams: 'diagrams',
  'structural-review': 'structuralReview',
  'cut-list': 'cutList',
  boards: 'boards',
  'shopping-list': 'shoppingList',
  'build-steps': 'buildSteps',
  parameters: 'parameters',
};

export function PlanSummary(props: {
  project: Project;
  plan: Plan;
  steps: readonly BuildStep[];
  drawings: geometry.Drawings | null;
  template: TemplateDefinition | undefined;
  /** The plan's other sections, in order A, with their addresses. */
  sections: readonly { id: Exclude<PlanSectionId, 'summary'>; title: string; href: string }[];
  /** Where to enter structural inputs, when the plan can be edited. */
  editHref?: string;
}) {
  const { plan, project, template } = props;
  const digests = planDigests(plan, {
    drawings: props.drawings,
    steps: props.steps,
    ...(template && project.snapshot
      ? {
          structuralInputs: enteredValues(
            template.form.structuralInputs,
            project.snapshot.structuralInputs,
          ),
        }
      : {}),
  });
  const reviewHref = props.sections.find((s) => s.id === 'structural-review')?.href;
  const figures: Figure[] = [
    ...plan.keyResults.map((r) => ({ label: r.label, value: <Measured text={r.value} /> })),
    ...lowestFigure(structural.lowestMargin(plan.checks), props.editHref),
  ];
  return (
    <Stack>
      {figures.length > 0 && <Figures items={figures} />}
      <ModeCards project={props.project} plan={plan} steps={props.steps} />
      <FlagSummary flags={plan.flags} reviewHref={reviewHref} />
      <h3>In this plan</h3>
      <SectionList
        items={props.sections.flatMap((s) => {
          const digest = digests[DIGESTS[s.id]];
          return digest === null ? [] : [{ ...s, digest }];
        })}
      />
    </Stack>
  );
}

/** The lowest margin, or why there is none yet: a missing margin could be the lowest. */
function lowestFigure(lowest: structural.LowestMargin, editHref?: string): Figure[] {
  const label = 'Lowest margin';
  switch (lowest.status) {
    case 'computed':
      return [
        {
          label,
          value: <MarginLine margin={structural.formatMargin(lowest.check.margin)} />,
          detail: <Measured text={`${lowest.check.title}: ${lowest.check.subject}`} terms />,
        },
      ];
    case 'input-needed':
      return [
        {
          label,
          value: <InputNeeded />,
          detail: (
            <>
              {lowest.count} of {lowest.of} checks need structural inputs.{' '}
              {editHref && <a href={editHref}>Enter structural inputs</a>}
            </>
          ),
        },
      ];
    case 'not-computed':
      return [
        {
          label,
          value: 'Not computed',
          detail: `${lowest.count} of ${lowest.of} checks could not be computed. The structural review says why.`,
        },
      ];
    case 'no-checks':
      return [];
  }
}

/** How many expert checks the design has, of which kinds, and each in one line. */
function FlagSummary(props: { flags: readonly Flag[]; reviewHref?: string }) {
  const { flags } = props;
  if (flags.length === 0) return <Text>No expert checks on this design.</Text>;
  const kinds = [...new Set(flags.map((f) => FLAG_CATEGORY_LABELS[f.category]))];
  return (
    <ExpertCheck
      label={`${flags.length} expert ${flags.length === 1 ? 'check' : 'checks'} · ${kinds.join(', ')}`}
    >
      <Stack gap="xs">
        <PlainList gap="xs">
          {flags.map((flag) => (
            <li key={`${flag.category}/${flag.ask}`}>
              <OneLine>
                <Measured text={flag.ask} terms />
              </OneLine>
            </li>
          ))}
        </PlainList>
        {props.reviewHref && (
          <Text>
            <a href={props.reviewHref} onClick={() => arriveAt(EXPERT_CHECKS_ID)}>
              Read them in full in the structural review
            </a>
          </Text>
        )}
      </Stack>
    </ExpertCheck>
  );
}
