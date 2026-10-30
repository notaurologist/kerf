import { type BuildStep, type Plan, type ProgressSummary, summarizeProgress } from '@kerf/core';
import { href } from '../../lib/route.ts';
import { useTicks } from '../../lib/ticks.ts';
import type { Project, ProjectSummary } from '../../lib/types.ts';
import { ButtonLink, Card, Cluster, Grid, Stack, Text } from '../../ui/index.ts';

// The ways into Shopping and Building (#61): two cards in the plan's summary, each showing
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

/** The Shopping and Building cards in the plan's summary, counted with ticks not sent yet. */
export function ModeCards(props: { project: Project; plan: Plan; steps: readonly BuildStep[] }) {
  const { project } = props;
  const ticks = useTicks(project.id, project.ticks);
  const summary = summarizeProgress(props.plan, props.steps, ticks.ticked());
  const { shopping, steps } = summary;
  return (
    <Grid>
      <Card as="section">
        <Stack gap="xs">
          <h2>Shopping</h2>
          <Text>{shoppingText(shopping)}</Text>
          <Cluster>
            <ButtonLink href={href({ screen: 'shop', id: project.id })}>
              {shopping.done === 0 ? 'Start shopping' : 'Open the shopping list'}
            </ButtonLink>
          </Cluster>
        </Stack>
      </Card>
      {steps.total > 0 && (
        <Card as="section">
          <Stack gap="xs">
            <h2>Building</h2>
            <Text>{buildingText(summary)}</Text>
            <Cluster>
              <ButtonLink href={href({ screen: 'build', id: project.id })}>
                {!building(summary)
                  ? 'Start building'
                  : summary.nextStep
                    ? 'Resume'
                    : 'Open the steps'}
              </ButtonLink>
            </Cluster>
          </Stack>
        </Card>
      )}
    </Grid>
  );
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
  // Building has started once a step is done or a piece is cut (#135), or the shopping is done.
  const inBuilding = building(progress) || shopping.done === shopping.total;
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
    <Card as="section">
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
