import { type BuildStep, FLAG_CATEGORY_LABELS, type Flag, type Plan, structural } from '@kerf/core';
import type { Project } from '../../lib/types.ts';
import {
  Button,
  ExpertCheck,
  type Figure,
  Figures,
  goToSection,
  InputNeeded,
  MarginLine,
  Measured,
  OneLine,
  PlainList,
  Stack,
  Text,
} from '../../ui/index.ts';
import { ModeCards } from '../modes/ModeCards.tsx';

// The summary that opens the plan (#40, revised laptop plan; #119): the results the template
// counts as key, the lowest margin, the ways into Shopping and Building, and the expert checks in
// one line each. Core chooses the key results and the lowest margin (hard rules 1 and 6); this
// only lays them out.

export function PlanSummary(props: {
  project: Project;
  plan: Plan;
  steps: readonly BuildStep[];
  /** Where to enter structural inputs, when the plan can be edited. */
  editHref?: string;
}) {
  const { plan } = props;
  const figures: Figure[] = [
    ...plan.keyResults.map((r) => ({ label: r.label, value: <Measured text={r.value} /> })),
    ...lowestFigure(structural.lowestMargin(plan.checks), props.editHref),
  ];
  return (
    <Stack>
      {figures.length > 0 && <Figures items={figures} />}
      <ModeCards project={props.project} plan={plan} steps={props.steps} />
      <FlagSummary flags={plan.flags} />
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
          detail: `${lowest.check.title}: ${lowest.check.subject}`,
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
function FlagSummary(props: { flags: readonly Flag[] }) {
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
                <Measured text={flag.ask} />
              </OneLine>
            </li>
          ))}
        </PlainList>
        <Text>
          <Button variant="link" onClick={() => goToSection('structural-review')}>
            Read them in full in the structural review
          </Button>
        </Text>
      </Stack>
    </ExpertCheck>
  );
}
