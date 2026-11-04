import {
  describeLumberAlternative,
  formatBoardLength,
  type LumberAlternative,
  readingsBesideHardware,
  readingsBesideLumber,
  type ShoppingGroup,
  shoppingGroups,
  summarizeProgress,
} from '@kerf/core';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  type DrawingsState,
  type StepDrawingState,
  useDrawings,
  useStepDrawing,
} from '../../lib/drawings.ts';
import { fieldId } from '../../lib/fieldIds.ts';
import { takeFlashText } from '../../lib/flash.ts';
import { Loaded } from '../../lib/Loaded.tsx';
import { useReadProject } from '../../lib/plan.ts';
import { useProject } from '../../lib/projectStore.ts';
import { href, type Route, redirect } from '../../lib/route.ts';
import { ThemeSwitch, useModeColor } from '../../lib/theme.tsx';
import { describeWaiting, type Ticks, useTicks } from '../../lib/ticks.ts';
import type { Project } from '../../lib/types.ts';
import { useWakeLock } from '../../lib/wakeLock.ts';
import {
  ButtonLink,
  Cluster,
  Disclosure,
  InputNeeded,
  List,
  Material,
  Measured,
  ModeFrame,
  Notice,
  PlainList,
  ScreenHeader,
  Stack,
  StatusLine,
  Text,
  Tick,
} from '../../ui/index.ts';
import { EmptyToolbox } from '../build-steps/BuildSteps.tsx';
import { DrawingsWaiting } from '../diagrams/Diagrams.tsx';
import { ResetNotes, replacementsOf } from '../project/ResetNotes.tsx';
import {
  projectStoreReadings,
  readingHref,
  StoreReadings,
} from '../shopping-list/StoreReadings.tsx';
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
  const { loaded, reload } = useProject(id);
  const mode = props.route.screen === 'shop' ? 'Shopping' : 'Building';
  useModeColor(mode);
  if (loaded.state !== 'ready') {
    return (
      <ModeFrame mode={mode} exitHref={href({ screen: 'project', id })} end={<ThemeSwitch />}>
        <Loaded state={loaded} loading="Loading project…" onRetry={reload} title="Project" />
      </ModeFrame>
    );
  }
  return <ModeWithDrawings route={props.route} project={loaded.value} />;
}

/** The mode, with the plan's drawings and the open step's action drawing loaded where shown. */
function ModeWithDrawings(props: { route: ModeRoute; project: Project }) {
  const { route, project } = props;
  const steps = useReadProject(project).steps?.steps ?? [];
  const at = route.screen === 'build-step' ? steps.findIndex((s) => s.id === route.step) : -1;
  const stepDrawing = useStepDrawing(project, steps[at], steps[at + 1]);
  return <ModeView {...props} drawings={useDrawings(project)} stepDrawing={stepDrawing} />;
}

export function ModeView(props: {
  route: ModeRoute;
  project: Project;
  /** The plan's drawings, which come in a request of their own. */
  drawings: DrawingsState;
  /** The open build step's action drawing, in a request of its own again. None on other screens. */
  stepDrawing?: StepDrawingState;
}) {
  const { route, project } = props;
  const exitHref = href({ screen: 'project', id: project.id });
  const mode = route.screen === 'shop' ? 'Shopping' : 'Building';
  const read = useReadProject(project);
  const { plan } = read;
  const drawings = props.drawings.state === 'ready' ? props.drawings.value : null;
  const steps = read.steps?.steps ?? [];
  const ticks = useTicks(project.id, project.ticks, project.revision);
  // "Saved." from Edit, opened here for a value read at the store (#390).
  const [flash] = useState(takeFlashText);
  const readings = useMemo(
    () => (plan.ok ? projectStoreReadings(project, plan.plan) : undefined),
    [project, plan],
  );
  const frame = (children: ReactNode) => (
    <ModeFrame mode={mode} context={project.name} exitHref={exitHref} end={<ThemeSwitch />}>
      <Stack>
        <Waiting ticks={ticks} />
        {props.drawings.state === 'error' && <DrawingsWaiting state={props.drawings} />}
        {props.stepDrawing?.state === 'error' && <DrawingsWaiting state={props.stepDrawing} />}
        {route.screen !== 'shop' && read.steps?.toolboxEmpty && <EmptyToolbox />}
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
    const boardDrawings = drawings?.boards ?? [];
    return frame(
      <>
        <ScreenHeader
          title="Shopping list"
          meta={`${summary.shopping.done} of ${summary.shopping.total} bought.`}
        />
        {flash && <StatusLine>{flash}</StatusLine>}
        <ResetNotes project={project} only={(n) => n.kind === 'shopping-line' || !!n.replacement} />
        <Replacements resets={project.resets} />
        {shoppingGroups(plan.plan).map((group) => (
          <Stack key={group.title} gap="xs">
            <Cluster spread>
              <h2>
                <Material
                  kind={group.lines.some(({ line }) => 'nominal' in line) ? 'wood' : 'steel'}
                />
                {group.title}
              </h2>
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
                        <Measured text={formatBoardLength(line.feet)} />
                      </>
                    ) : line.quantity === undefined ? (
                      <>
                        <Measured text={line.description} /> <InputNeeded>Count needed</InputNeeded>
                      </>
                    ) : (
                      <>
                        <b>{line.quantity}</b> × <Measured text={line.description} />
                      </>
                    )}
                  </Tick>
                  {readings && (
                    <StoreReadings
                      readings={
                        'nominal' in line
                          ? readingsBesideLumber(readings, line)
                          : readingsBesideHardware(readings, line)
                      }
                      readingHref={readingHref(project, 'shop')}
                    />
                  )}
                  {'description' in line && line.notes.length > 0 && (
                    <PlainList gap="xs" items={line.notes} terms />
                  )}
                  {'nominal' in line && line.notes.length > 0 && (
                    <PlainList gap="xs" items={line.notes} terms />
                  )}
                  {'nominal' in line && line.alternatives.length > 0 && (
                    <Disclosure summary="Not in stock?">
                      <NotInStock line={line} editHref={(path) => editHref(project, path)} />
                    </Disclosure>
                  )}
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
            {/* The allowances the whole list was planned with, after the lumber (#450). */}
            {group.lines.some(({ line }) => 'nominal' in line) &&
              plan.plan.lumber.notes.length > 0 && <List items={plan.plan.lumber.notes} terms />}
          </Stack>
        ))}
        {plan.plan.hardwareNotes.length > 0 && <List items={plan.plan.hardwareNotes} terms />}
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
        <ScreenHeader
          title="All steps"
          meta={`${summary.steps.done} of ${summary.steps.total} steps done.`}
        />
        <PlainList ordered>
          {steps.map((step, i) => {
            const tick = { kind: 'step' as const, key: step.id };
            return (
              // Every row the same (#136): the tick and title, then Open under it.
              <li key={step.id}>
                <Stack gap="2xs">
                  <Tick
                    done={ticks.isDone(tick)}
                    waiting={ticks.isWaiting(tick)}
                    onChange={(done) => ticks.set(tick, done)}
                  >
                    {i + 1}. {step.title}
                  </Tick>
                  <Cluster>
                    <ButtonLink variant="secondary" href={stepHref(step.id)}>
                      Open
                    </ButtonLink>
                  </Cluster>
                </Stack>
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
        <Cluster>
          <ButtonLink href={stepsHref}>All steps</ButtonLink>
        </Cluster>
      </>,
    );
  }
  const links = {
    steps: stepsHref,
    step: stepHref,
    piece: (stepId: string, part: string) =>
      href({ screen: 'build-part', id: project.id, step: stepId, part }),
  };
  const stepNotes = <ResetNotes project={project} only={(n) => n.stepIds.includes(step.id)} />;
  if (route.screen === 'build-part') {
    return frame(
      <>
        {stepNotes}
        <CutCard
          step={step}
          number={at + 1}
          total={steps.length}
          partId={route.part}
          plan={plan.plan}
          drawings={drawings}
          ticks={ticks}
          links={links}
        />
      </>,
    );
  }
  return frame(
    <>
      {stepNotes}
      <StepScreen
        steps={steps}
        at={at}
        plan={plan.plan}
        drawings={drawings}
        action={props.stepDrawing?.state === 'ready' ? props.stepDrawing.value : null}
        ticks={ticks}
        links={links}
      />
    </>,
  );
}

/**
 * Boards to buy for pieces cut shorter than the plan now needs (#444). Not ticked: the note that
 * names each one is dismissed once it is bought.
 */
/** Where a parameter opens in Edit, returning to Shopping on Save or Cancel. */
function editHref(project: Pick<Project, 'id'>, path: string) {
  return href({
    screen: 'edit-project',
    id: project.id,
    from: 'shop',
    field: fieldId('params', path),
  });
}

/**
 * What else to buy when the store has none of a line's boards (#450), as core worked it out when
 * the plan was made. Another size changes the plan, so it opens its field in Edit.
 */
function NotInStock(props: {
  line: { nominal: string; alternatives: readonly LumberAlternative[] };
  editHref: (path: string) => string;
}) {
  const { line } = props;
  return (
    <Stack gap="xs">
      <Text>Buy one of these instead:</Text>
      <PlainList gap="xs">
        {line.alternatives.map((alternative) => (
          <li key={describeLumberAlternative(alternative, line)}>
            <Measured text={describeLumberAlternative(alternative, line)} />
            {'field' in alternative && (
              <>
                {' '}
                <a href={props.editHref(alternative.field)}>Change it in Edit</a>
              </>
            )}
          </li>
        ))}
      </PlainList>
    </Stack>
  );
}

function Replacements(props: { resets: Project['resets'] }) {
  const boards = replacementsOf(props.resets);
  if (boards.length === 0) return null;
  return (
    <Stack gap="xs">
      <h2>
        <Material kind="wood" />
        Replacements
      </h2>
      <PlainList>
        {boards.map((b) => (
          <li key={b.piece}>
            <b>1</b> × {b.nominal}, <Measured text={formatBoardLength(b.feet)} />, for{' '}
            <Measured text={b.piece} />
          </li>
        ))}
      </PlainList>
    </Stack>
  );
}

/** What is waiting to be saved, and why, in words; nothing when all is saved. */
export function Waiting(props: { ticks: Ticks }) {
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
  return null;
}
