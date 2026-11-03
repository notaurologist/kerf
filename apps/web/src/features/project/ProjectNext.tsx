import { type BuildStep, type Plan, summarizeProgress, summarizeReview } from '@kerf/core';
import { arriveAt } from '../../lib/planMoves.ts';
import { href } from '../../lib/route.ts';
import { EXPERT_CHECKS_ID } from '../../lib/show.ts';
import { useTicks } from '../../lib/ticks.ts';
import type { Project } from '../../lib/types.ts';
import { OneLine, Text } from '../../ui/index.ts';

// The project header's line of what is next (#356), on every section: the next build step, an
// empty toolbox, which leaves every step without a method, the structural inputs still needed,
// the suggested values not yet confirmed (#417), and the expert checks not yet asked (#393), each
// a way to where it is dealt with. One line, so the section stays in the first screen on a phone:
// the step is cut short, since it is in full in the build steps, and the counts stay whole.

/** The structural inputs the plan's checks and estimates are waiting for, each counted once. */
export function inputsNeeded(plan: Pick<Plan, 'checks' | 'movement'>): number {
  const keys = new Set(
    [...plan.checks, ...plan.movement].flatMap((r) =>
      r.status === 'input-needed' ? r.missing.map((m) => m.key) : [],
    ),
  );
  return keys.size;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function ProjectNext(props: {
  project: Project;
  plan: Plan;
  steps: readonly BuildStep[];
  toolboxEmpty: boolean;
  reviewHref: string;
}) {
  const { project, plan } = props;
  const ticks = useTicks(project.id, project.ticks, project.revision);
  const ticked = ticks.ticked();
  const { nextStep, steps } = summarizeProgress(plan, props.steps, ticked);
  const inputs = inputsNeeded(plan);
  const flags = summarizeReview(plan, ticked).flags.open;
  const toConfirm = (project.snapshot?.suggested ?? []).filter((s) => !s.confirmed).length;
  const step = nextStep ? `Next: ${nextStep.title}` : steps.total > 0 ? 'Every step done' : null;
  const counts = [
    props.toolboxEmpty && (
      <a key="tools" href={href({ screen: 'tools' })}>
        Add your tools
      </a>
    ),
    inputs > 0 && (
      <a key="inputs" href={props.reviewHref}>
        {count(inputs, 'input needed', 'inputs needed')}
      </a>
    ),
    toConfirm > 0 && (
      <a key="suggested" href={props.reviewHref}>
        {count(toConfirm, 'suggested value to confirm', 'suggested values to confirm')}
      </a>
    ),
    flags > 0 && (
      <a key="flags" href={props.reviewHref} onClick={() => arriveAt(EXPERT_CHECKS_ID)}>
        {count(flags, 'expert check', 'expert checks')}
      </a>
    ),
  ].filter(Boolean);
  if (!step && counts.length === 0) return null;
  // A space at the start of the end would be dropped, so the first dot's is one with no break.
  const end = counts.flatMap((part, i) => [i > 0 ? ' · ' : step ? '\u00a0· ' : '', part]);
  return (
    <Text screenOnly>
      <OneLine end={counts.length > 0 ? end : undefined}>{step}</OneLine>
    </Text>
  );
}
