import { formatLength, type ShoppingGroup, shoppingGroups, summarizeProgress } from '@kerf/core';
import { type ReactNode, useEffect } from 'react';
import { api, describeError, send } from '../../lib/api.ts';
import { readDrawings, readPlan, readSteps } from '../../lib/plan.ts';
import { href, type Route, redirect } from '../../lib/route.ts';
import { describeWaiting, useTicks } from '../../lib/ticks.ts';
import type { Project } from '../../lib/types.ts';
import { useLoad } from '../../lib/useLoad.ts';
import { useWakeLock } from '../../lib/wakeLock.ts';
import {
  ButtonLink,
  Cluster,
  Disclosure,
  Loading,
  Measured,
  ModeFrame,
  Notice,
  PlainList,
  Stack,
  Text,
  Tick,
} from '../../ui/index.ts';
import { BoardCards } from './BoardCards.tsx';
import { CutCard, StepScreen } from './BuildStep.tsx';

// Shopping and Building (#61): full-screen modes launched from the plan, each under a bar with
// the mode's name and Exit and no other navigation. A mode changes progress only, never the plan
// (information architecture, IA-2). The screens here are the first cut: Shopping ticks the
// shopping list's lines, and Building shows one step at a time. The store checklist by aisle with
// board cards (#59) and the shop-density step screens, cut cards, and action drawings (#118)
// build on them.

type ModeRoute = Extract<
  Route,
  { screen: 'shop' | 'build' | 'build-steps' | 'build-step' | 'build-part' }
>;

/** Loads the project, then shows the mode the route names. */
export function ModeScreen(props: { route: ModeRoute }) {
  // The screen stays on while a mode is open (#54). This component stays mounted from step to
  // step and card to card, so the lock is held for the whole visit, not asked for at each step.
  useWakeLock();
  const { id } = props.route;
  const { loaded } = useLoad(() => send(api.api.projects[':id'].$get({ param: { id } })), id);
  const mode = props.route.screen === 'shop' ? 'Shopping' : 'Building';
  if (loaded.state !== 'ready') {
    return (
      <ModeFrame mode={mode} exitHref={href({ screen: 'project', id })}>
        {loaded.state === 'loading' ? (
          <Loading>Loading project…</Loading>
        ) : (
          <Notice>{describeError(loaded.error)}</Notice>
        )}
      </ModeFrame>
    );
  }
  return <ModeView route={props.route} project={loaded.value} />;
}

export function ModeView(props: { route: ModeRoute; project: Project }) {
  const { route, project } = props;
  const exitHref = href({ screen: 'project', id: project.id });
  const mode = route.screen === 'shop' ? 'Shopping' : 'Building';
  const plan = readPlan(project);
  const steps = readSteps(project)?.steps ?? [];
  const ticks = useTicks(project.id, project.ticks);
  // Each step, list, or card opens at its top, not where the last one was scrolled to.
  const address = href(route);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the address changes.
  useEffect(() => {
    // A block, not an expression: scrolling returns a promise in some browsers, which React
    // would take for a cleanup.
    window.scrollTo(0, 0);
  }, [address]);
  const frame = (children: ReactNode) => (
    <ModeFrame mode={mode} context={project.name} exitHref={exitHref}>
      <Stack>
        <Waiting ticks={ticks} />
        {children}
      </Stack>
    </ModeFrame>
  );
  if (!plan.ok) return frame(<Notice>{plan.message}</Notice>);
  const summary = summarizeProgress(plan.plan, steps, ticks.ticked());

  if (route.screen === 'shop') {
    const lineTick = (key: string) => ({ kind: 'shopping-line' as const, key });
    const bought = (lines: ShoppingGroup['lines']) =>
      lines.filter((l) => ticks.isDone(lineTick(l.key))).length;
    // The store checklist (#59): lumber, then the hardware groups, each with its own count. Each
    // lumber line opens its board cards.
    const boardDrawings = readDrawings(project)?.boards ?? [];
    return frame(
      <>
        <h1>Shopping list</h1>
        <Text>
          {summary.shopping.done} of {summary.shopping.total} bought.
        </Text>
        {shoppingGroups(plan.plan).map((group) => (
          <Stack key={group.title} gap="xs">
            <Cluster spread>
              <h2>{group.title}</h2>
              <Text>
                {bought(group.lines)} of {group.lines.length}
              </Text>
            </Cluster>
            <PlainList>
              {group.lines.map(({ key, line }) => (
                <li key={key}>
                  <Tick
                    done={ticks.isDone(lineTick(key))}
                    waiting={ticks.isWaiting(lineTick(key))}
                    onChange={(done) => ticks.set(lineTick(key), done)}
                  >
                    {'nominal' in line ? (
                      <>
                        <b>{line.count}</b> × {line.nominal},{' '}
                        <Measured text={formatLength(line.feet * 12, 'feet-inches')} />
                      </>
                    ) : (
                      <>
                        <b>{line.quantity}</b> × <Measured text={line.description} />
                      </>
                    )}
                  </Tick>
                  {'nominal' in line && (
                    <Disclosure
                      summary={
                        line.count === 1
                          ? 'The board, and what to look for'
                          : 'The boards, and what to look for'
                      }
                    >
                      <BoardCards
                        line={line}
                        lumber={plan.plan.lumber}
                        rows={plan.plan.cutList}
                        drawings={boardDrawings}
                      />
                    </Disclosure>
                  )}
                </li>
              ))}
            </PlainList>
          </Stack>
        ))}
      </>,
    );
  }

  if (steps.length === 0) return frame(<Text>This plan has no build steps.</Text>);
  const stepHref = (step: string) => href({ screen: 'build-step', id: project.id, step });
  const stepsHref = href({ screen: 'build-steps', id: project.id });

  if (route.screen === 'build') {
    const { nextStep } = summary;
    return (
      <GoTo
        to={
          nextStep
            ? { screen: 'build-step', id: project.id, step: nextStep.id }
            : { screen: 'build-steps', id: project.id }
        }
      />
    );
  }

  if (route.screen === 'build-steps') {
    return frame(
      <>
        <h1>All steps</h1>
        <Text>
          {summary.steps.done} of {summary.steps.total} steps done.
        </Text>
        <PlainList ordered>
          {steps.map((step, i) => {
            const tick = { kind: 'step' as const, key: step.id };
            return (
              <li key={step.id}>
                <Cluster spread>
                  <Tick
                    done={ticks.isDone(tick)}
                    waiting={ticks.isWaiting(tick)}
                    onChange={(done) => ticks.set(tick, done)}
                  >
                    {i + 1}. {step.title}
                  </Tick>
                  <ButtonLink variant="secondary" href={stepHref(step.id)}>
                    Open
                  </ButtonLink>
                </Cluster>
              </li>
            );
          })}
        </PlainList>
      </>,
    );
  }

  const at = steps.findIndex((s) => s.id === route.step);
  const step = steps[at];
  if (!step) {
    return frame(
      <>
        <Notice>This plan has no step "{route.step}". It may have changed since the link.</Notice>
        <ButtonLink href={stepsHref}>All steps</ButtonLink>
      </>,
    );
  }
  const links = {
    steps: stepsHref,
    step: stepHref,
    piece: (stepId: string, part: string) =>
      href({ screen: 'build-part', id: project.id, step: stepId, part }),
  };
  const drawings = readDrawings(project);
  if (route.screen === 'build-part') {
    return frame(
      <CutCard
        step={step}
        number={at + 1}
        total={steps.length}
        partId={route.part}
        plan={plan.plan}
        drawings={drawings}
        ticks={ticks}
        links={links}
      />,
    );
  }
  return frame(
    <StepScreen
      steps={steps}
      at={at}
      plan={plan.plan}
      drawings={drawings}
      ticks={ticks}
      links={links}
    />,
  );
}

/** What is waiting to be saved, and why, in words; nothing when all is saved. */
function Waiting(props: { ticks: ReturnType<typeof useTicks> }) {
  const { ticks } = props;
  const waiting = describeWaiting(ticks);
  return (
    <>
      {waiting &&
        (ticks.offline ? <Notice icon="connection">{waiting}</Notice> : <Text>{waiting}</Text>)}
      {ticks.problem && !ticks.offline && <Notice>{ticks.problem}</Notice>}
      {ticks.dropped && <Notice>{ticks.dropped}</Notice>}
    </>
  );
}

/** Replaces the address with `to`, as `#/…/build` opens the step to do next. */
function GoTo(props: { to: Parameters<typeof redirect>[0] }) {
  const target = href(props.to);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the address names the target.
  useEffect(() => {
    redirect(props.to);
  }, [target]);
  return <Loading>Opening the next step…</Loading>;
}
