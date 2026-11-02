import { type BuildStep, type Plan, type ProgressSummary, summarizeProgress } from '@kerf/core';
import { href } from '../../lib/route.ts';
import { useTicks } from '../../lib/ticks.ts';
import type { Project, ProjectSummary } from '../../lib/types.ts';
import { ButtonLink, Card, Cluster, Stack, Text } from '../../ui/index.ts';

// The ways into Shopping and Building (#61): two buttons in the project's header, each showing
// progress (#356), and a Resume card on the projects list that goes straight to where you left off.

/** How far the shopping has got, in words. */
export function shoppingText(s: ProgressSummary['shopping']): string {
  if (s.done === 0) return `${s.total} lines, none bought.`;
  if (s.done === s.total) return `All ${s.total} lines bought.`;
  return `${s.done} of ${s.total} bought.`;
}

/** True once a step is done or a piece is cut (#135). */
const building = (s: ProgressSummary) => s.steps.done > 0 || s.pieces.done > 0;

/** How far the building has got, in words; pieces cut count until the first step is done. */
export function buildingText(s: ProgressSummary): string {
  const { done, total } = s.steps;
  if (!building(s)) return `${total} steps, not started.`;
  if (!s.nextStep) return `All ${total} steps done.`;
  const cut = done === 0 ? `${s.pieces.done} of ${s.pieces.total} pieces cut. ` : '';
  return `${cut}Step ${s.nextStep.number} of ${total} next: ${s.nextStep.title}.`;
}

/** Shopping's progress, short enough for a button: "4 of 11 bought". */
function shoppingShort(s: ProgressSummary['shopping']): string {
  if (s.done === 0) return `${s.total} to buy`;
  if (s.done === s.total) return 'all bought';
  return `${s.done} of ${s.total} bought`;
}

/** Building's progress, short enough for a button: "step 3 of 11". */
function buildingShort(s: ProgressSummary): string {
  if (!building(s)) return 'not started';
  if (!s.nextStep) return 'all done';
  return `step ${s.nextStep.number} of ${s.steps.total}`;
}

/**
 * The ways into Shopping and Building in the project's header, on every section of the plan
 * (#356), each with its progress counted with ticks not sent yet. The mode to do next is the
 * screen's one primary button.
 */
export function ModeButtons(props: { project: Project; plan: Plan; steps: readonly BuildStep[] }) {
  const { project } = props;
  const ticks = useTicks(project.id, project.ticks, project.revision);
  const summary = summarizeProgress(props.plan, props.steps, ticks.ticked());
  const { shopping, steps } = summary;
  const next = steps.total > 0 && buildingIsNext(summary) ? 'building' : 'shopping';
  return (
    <Cluster gap="xs">
      <ButtonLink
        href={href({ screen: 'shop', id: project.id })}
        variant={next === 'shopping' ? 'primary' : 'secondary'}
        mode="shopping"
      >
        Shop · {shoppingShort(shopping)}
      </ButtonLink>
      {steps.total > 0 && (
        <ButtonLink
          href={href({ screen: 'build', id: project.id })}
          variant={next === 'building' ? 'primary' : 'secondary'}
          mode="building"
        >
          Build · {buildingShort(summary)}
        </ButtonLink>
      )}
    </Cluster>
  );
}

/** Building comes next once it has started (a step done or a piece cut) or the shopping is done. */
function buildingIsNext(s: ProgressSummary): boolean {
  return building(s) || s.shopping.done === s.shopping.total;
}

/**
 * Where an in-progress project picks up: the next step once building has started or the shopping
 * is done, or else the shopping list once a line is bought. Null for a project that is not in
 * progress, has nothing ticked, or has nothing left.
 */
export function resumeTarget(project: ProjectSummary) {
  const { progress } = project;
  if (project.status !== 'in-progress' || !progress) return null;
  const { shopping, steps, nextStep } = progress;
  const inBuilding = buildingIsNext(progress);
  if (inBuilding && nextStep) {
    return {
      mode: 'building' as const,
      href: href({ screen: 'build-step', id: project.id, step: nextStep.id }),
      text: `Step ${nextStep.number} of ${steps.total}: ${nextStep.title}.`,
    };
  }
  if (!inBuilding && shopping.done > 0) {
    return {
      mode: 'shopping' as const,
      href: href({ screen: 'shop', id: project.id }),
      text: shoppingText(shopping),
    };
  }
  return null;
}

/** The card at the top of the projects list for picking up where you left off. */
export function ResumeCard(props: { project: ProjectSummary }) {
  const target = resumeTarget(props.project);
  if (!target) return null;
  return (
    <Card as="section" mode={target.mode}>
      <Stack gap="xs">
        <h2>Resume {target.mode}</h2>
        <Text>
          <b>{props.project.name}</b>. {target.text}
        </Text>
        <Cluster>
          <ButtonLink href={target.href}>Go</ButtonLink>
        </Cluster>
      </Stack>
    </Card>
  );
}
