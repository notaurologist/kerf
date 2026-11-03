import {
  type BuildStep,
  inputsNeeded,
  type NextUp,
  nextUp,
  type Plan,
  structural,
  suggestionsUsed,
  summarizeProgress,
  summarizeReview,
} from '@kerf/core';
import { arriveAt } from '../../lib/planMoves.ts';
import { href } from '../../lib/route.ts';
import { CHECKS_ID, EXPERT_CHECKS_ID } from '../../lib/show.ts';
import { useTicks } from '../../lib/ticks.ts';
import type { Project } from '../../lib/types.ts';
import { OneLine, Text } from '../../ui/index.ts';

// The project header's line of what is next (#356), on every section, in the order review,
// shopping, building (#448): the structural review while its To do has anything open, then the
// shopping list, then the next build step. After it, an empty toolbox, which leaves every step
// without a method, and what the review's To do still holds: the structural inputs needed, the
// suggested values not yet confirmed (#417), the expert checks not yet asked (#393), and the
// checklist items not yet confirmed, each a way to where it is dealt with. One line, so the
// section stays in the first screen on a phone: the step is cut short, since it is in full in the
// build steps, and the counts stay whole. Below it, the lowest margin and its check, once every
// check has one.

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function nextText(next: NextUp): string | null {
  if (!next) return null;
  switch (next.kind) {
    case 'review':
      return 'Next: Structural review';
    case 'shopping':
      return `Next: Shopping list, ${next.toBuy} to buy`;
    case 'step':
      return `Next: ${next.step.title}`;
    case 'done':
      return 'Every step done';
  }
}

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
  const inputs = inputsNeeded(plan);
  const review = summarizeReview(plan, ticked);
  const suggested = project.snapshot?.suggested ?? [];
  const toConfirm = suggested.filter((s) => !s.confirmed).length;
  const toDo = inputs + toConfirm + review.flags.open + review.checklist.open;
  const step = nextText(nextUp(summarizeProgress(plan, props.steps, ticked), toDo));
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
    review.flags.open > 0 && (
      <a key="flags" href={props.reviewHref} onClick={() => arriveAt(EXPERT_CHECKS_ID)}>
        {count(review.flags.open, 'expert check', 'expert checks')}
      </a>
    ),
    review.checklist.open > 0 && (
      <a key="checklist" href={props.reviewHref}>
        {count(review.checklist.open, 'checklist item', 'checklist items')}
      </a>
    ),
  ].filter(Boolean);
  const lowest = structural.lowestMargin(plan.checks);
  if (!step && counts.length === 0 && lowest.status !== 'computed') return null;
  // A space at the start of the end would be dropped, so the first dot's is one with no break.
  const end = counts.flatMap((part, i) => [i > 0 ? ' · ' : step ? '\u00a0· ' : '', part]);
  return (
    <>
      {(step || counts.length > 0) && (
        <Text screenOnly>
          <OneLine end={counts.length > 0 ? end : undefined}>{step}</OneLine>
        </Text>
      )}
      {lowest.status === 'computed' && (
        <Text screenOnly>
          {/* The review lists the lowest margin first once every check has one. */}
          <a href={props.reviewHref} onClick={() => arriveAt(CHECKS_ID)}>
            {structural.formatLowestMargin(lowest.check)}
            {suggestionsUsed(lowest.check, suggested).some((s) => !s.confirmed) &&
              ', with a suggested value'}
          </a>
        </Text>
      )}
    </>
  );
}
