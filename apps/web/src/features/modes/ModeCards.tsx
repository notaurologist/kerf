import { type BuildStep, type Plan, type ProgressSummary, summarizeProgress } from '@kerf/core';
import { href } from '../../lib/route.ts';
import { useTicks } from '../../lib/ticks.ts';
import type { Project, ProjectSummary } from '../../lib/types.ts';
import { ButtonLink, Card, Cluster, Row, Rows, Stack, Text } from '../../ui/index.ts';

// The ways into Shopping and Building (#61): two rows in the plan's summary, each showing
// progress, and a Resume card on the projects list that goes straight to where you left off.

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

/**
 * The ways into Shopping and Building in the plan's summary (under its h2), as ruled rows, counted
 * with ticks not sent yet. The mode to do next is the screen's one primary button.
 */
export function ModeCards(props: { project: Project; plan: Plan; steps: readonly BuildStep[] }) {
  const { project } = props;
  const ticks = useTicks(project.id, project.ticks, project.revision);
  const summary = summarizeProgress(props.plan, props.steps, ticks.ticked());
  const { shopping, steps } = summary;
  const next = steps.total > 0 && buildingIsNext(summary) ? 'building' : 'shopping';
  return (
    <Rows>
      <Row as="section" mode="shopping">
        <Cluster spread>
          <Stack gap="3xs">
            <h3>Shopping</h3>
            <Text>{shoppingText(shopping)}</Text>
          </Stack>
          <ButtonLink
            href={href({ screen: 'shop', id: project.id })}
            variant={next === 'shopping' ? 'primary' : 'secondary'}
          >
            {shopping.done === 0 ? 'Start shopping' : 'Open the shopping list'}
          </ButtonLink>
        </Cluster>
      </Row>
      {steps.total > 0 && (
        <Row as="section" mode="building">
          <Cluster spread>
            <Stack gap="3xs">
              <h3>Building</h3>
              <Text>{buildingText(summary)}</Text>
            </Stack>
            <ButtonLink
              href={href({ screen: 'build', id: project.id })}
              variant={next === 'building' ? 'primary' : 'secondary'}
            >
              {!building(summary)
                ? 'Start building'
                : summary.nextStep
                  ? 'Resume'
                  : 'Open the steps'}
            </ButtonLink>
          </Cluster>
        </Row>
      )}
    </Rows>
  );
}

/** Building comes next once it has started (a step done or a piece cut) or the shopping is done. */
function buildingIsNext(s: ProgressSummary): boolean {
  return building(s) || s.shopping.done === s.shopping.total;
}

/**
 * Where an in-progress project picks up: the next step once building has started or the shopping
 * is done, or else the shopping list. Null for a project that is not in progress, or has nothing
 * left.
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
  if (!inBuilding) {
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
