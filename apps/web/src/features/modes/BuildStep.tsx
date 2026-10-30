import {
  angleToEdge,
  type BuildStep,
  type CutListRow,
  formatAngle,
  formatLength,
  type geometry,
  type Plan,
  partProgressKey,
} from '@kerf/core';
import type { ReactNode } from 'react';
import type { useTicks } from '../../lib/ticks.ts';
import {
  Button,
  ButtonLink,
  Cluster,
  Diagram,
  Glance,
  Length,
  Measured,
  PartLetter,
  PlainList,
  SawSetting,
  Stack,
  StatusLine,
  Switcher,
  Text,
  Tick,
} from '../../ui/index.ts';
import { StepBody } from '../build-steps/BuildSteps.tsx';

// Building mode's screens (#118; design Stage 1, G-A to G-C): one step at a time in shop density,
// the numbers you cut to set for glance distance (#42), and every word in the text color (#43,
// rule 5). A cutting step is one board: its pieces in the order they come off it, each opening
// its cut card (G-B). From the width where the page grid has 8 columns (#41), the step sits beside
// its drawing. Every length and angle comes from the API's plan through core's formatters.

type Ticks = ReturnType<typeof useTicks>;

/** Where a screen links to. */
export interface StepLinks {
  steps: string;
  step: (stepId: string) => string;
  piece: (stepId: string, partId: string) => string;
}

/** The page grid has 8 columns from 600 px (#41): from there the step sits beside its drawing. */
const BESIDE = '37.5rem';

function Position(props: { number: number; total: number; step: BuildStep; links: StepLinks }) {
  return (
    <Cluster spread>
      <Text>
        Step {props.number} of {props.total}
        {props.step.board && ' · Cutting'}
      </Text>
      <a href={props.links.steps}>All steps</a>
    </Cluster>
  );
}

/**
 * The drawing a step sits beside: a cutting step's board, an assembly step's action drawing, or
 * the site layout for site work. Other steps have none.
 */
function drawingFor(step: BuildStep, drawings: geometry.Drawings | null) {
  if (!drawings) return undefined;
  if (step.board) return drawings.boards?.[step.board.number - 1];
  const action = drawings.steps?.find((s) => s.stepId === step.id)?.drawing;
  if (action) return action;
  const onSite = step.operations.some((o) => o.partIds.length === 0);
  return onSite ? (drawings.siteLayout ?? undefined) : undefined;
}

/** The step and, on a wide screen, its drawing beside it. */
function BesideDrawing(props: {
  children: ReactNode;
  drawing: geometry.Drawing | undefined;
  /** For a long drawing such as a cut detail, which scrolls sideways rather than shrink. */
  minWidth?: number;
}) {
  if (!props.drawing) return <Stack>{props.children}</Stack>;
  return (
    <Switcher threshold={BESIDE} gap="l">
      <Stack>{props.children}</Stack>
      <Stack gap="xs">
        <Diagram
          drawing={props.drawing}
          label={props.drawing.description}
          minWidth={props.minWidth}
        />
      </Stack>
    </Switcher>
  );
}

export function StepScreen(props: {
  steps: readonly BuildStep[];
  at: number;
  plan: Plan;
  drawings: geometry.Drawings | null;
  ticks: Ticks;
  links: StepLinks;
}) {
  const { steps, at, plan, ticks, links } = props;
  const step = steps[at];
  if (!step) return null;
  const tick = { kind: 'step' as const, key: step.id };
  const done = ticks.isDone(tick);
  const previous = steps[at - 1];
  const next = steps[at + 1];
  const nextHref = next ? links.step(next.id) : links.steps;
  const drawing = drawingFor(step, props.drawings);
  return (
    <>
      <Position number={at + 1} total={steps.length} step={step} links={links} />
      <h1>{step.title}</h1>
      <BesideDrawing drawing={drawing}>
        {step.board && <BoardPieces step={step} rows={plan.cutList} ticks={ticks} links={links} />}
        <StepBody step={step} rows={plan.cutList} withoutBoard />
      </BesideDrawing>
      {done && (
        <Cluster>
          <StatusLine>Step done{ticks.isWaiting(tick) ? ', not sent yet' : ''}.</StatusLine>
          <Button variant="link" onClick={() => ticks.set(tick, false)}>
            Mark not done
          </Button>
        </Cluster>
      )}
      <Cluster>
        {previous && (
          <ButtonLink variant="secondary" href={links.step(previous.id)}>
            Back
          </ButtonLink>
        )}
        {done ? (
          <ButtonLink href={nextHref}>{next ? 'Next' : 'All steps'}</ButtonLink>
        ) : (
          <Button
            onClick={() => {
              ticks.set(tick, true);
              window.location.hash = nextHref;
            }}
          >
            {next ? 'Done, next' : 'Done'}
          </Button>
        )}
      </Cluster>
    </>
  );
}

/**
 * A cutting step's board (G-C): trim first, then each piece in the order it comes off, its length
 * at glance size, a tick for cutting it, and its cut card.
 */
function BoardPieces(props: {
  step: BuildStep;
  rows: readonly CutListRow[];
  ticks: Ticks;
  links: StepLinks;
}) {
  const { step, ticks } = props;
  const board = step.board;
  if (!board) return null;
  const row = (partId: string) => props.rows.find((r) => r.partId === partId);
  return (
    <Stack gap="s">
      <Text>
        Trim <Length>{formatLength(board.trimPerEnd)}</Length> off the factory end to square it,
        then cut these in order, measuring each from the fresh cut. Each saw cut takes{' '}
        <Length>{formatLength(board.kerf)}</Length>.
      </Text>
      <PlainList ordered>
        {board.pieces.map((piece) => {
          const r = row(piece.partId);
          const t = { kind: 'part' as const, key: partProgressKey(piece.partId, piece.instance) };
          const of =
            (r?.quantity ?? 1) > 1 ? `, piece ${piece.instance + 1} of ${r?.quantity}` : '';
          return (
            <li key={t.key}>
              <Stack gap="2xs">
                <Tick
                  done={ticks.isDone(t)}
                  waiting={ticks.isWaiting(t)}
                  onChange={(done) => ticks.set(t, done)}
                >
                  <PartLetter>{r?.letter ?? ''}</PartLetter> {r?.name ?? piece.partId}
                  {of} cut
                </Tick>
                <Cluster spread>
                  <Glance>{formatLength(piece.length)}</Glance>
                  <ButtonLink variant="secondary" href={props.links.piece(step.id, piece.partId)}>
                    Cut card
                  </ButtonLink>
                </Cluster>
              </Stack>
            </li>
          );
        })}
      </PlainList>
      <Text>
        Left over after both ends are trimmed: <Length>{formatLength(board.offcut)}</Length>.
      </Text>
    </Stack>
  );
}

/**
 * A part's cut card (G-B; Stage 2, "Cut list on a phone"): the length largest, each end cut as a
 * saw setting with the angle to the board's edge, the marks, a tick for each piece cut from this
 * step's board, and the part's cut detail, which marks the reference face.
 */
export function CutCard(props: {
  step: BuildStep;
  number: number;
  total: number;
  partId: string;
  plan: Plan;
  drawings: geometry.Drawings | null;
  ticks: Ticks;
  links: StepLinks;
}) {
  const { step, plan, ticks, links, partId } = props;
  const row = plan.cutList.find((r) => r.partId === partId);
  const detail = props.drawings?.cutDetails.find((d) => d.partId === partId);
  const back = (
    <ButtonLink variant="secondary" href={links.step(step.id)}>
      Back to the step
    </ButtonLink>
  );
  if (!row) {
    return (
      <>
        <Text>This plan has no part "{partId}".</Text>
        {back}
      </>
    );
  }
  // The end cuts' settings, from the operations the cut list's numbers came from.
  const endCut = (end: number) =>
    plan.operations.find(
      (op) =>
        (op.type === 'miter' || op.type === 'crosscut') && op.partId === partId && op.end === end,
    );
  const pieces = step.board?.pieces.filter((p) => p.partId === partId) ?? [];
  // How the template describes each end, and the edge its angles are laid out from (#132).
  const described = plan.cutEnds.find((c) => c.partId === partId);
  const bothAngled = [0, 1].every((e) => endCut(e)?.type === 'miter');
  return (
    <>
      <Position number={props.number} total={props.total} step={step} links={links} />
      <h1>
        <PartLetter>{row.letter}</PartLetter> {row.name}
      </h1>
      <BesideDrawing drawing={detail} minWidth={560}>
        <Text>
          {row.stock}. Cut {row.quantity}.
          {step.board &&
            ` From board ${step.board.number}, a ${step.board.nominal} ${formatLength(step.board.feet * 12, 'feet-inches')} long.`}
        </Text>
        <Stack gap="3xs">
          <Text>Length, long point to long point</Text>
          <Glance>{row.length}</Glance>
        </Stack>
        {described?.referenceEdge && (
          <Text>
            Lay out each angle on the face marked with a loop in the drawing, from the{' '}
            {described.referenceEdge}.
          </Text>
        )}
        {row.ends.map((text, end) => {
          const op = endCut(end);
          const own = described?.ends[end];
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: a part's ends, in order.
            <Stack key={end} gap="xs">
              {/* Named as the template names the end, such as "Top: level cut" (#132). */}
              <h2>{own ? <Measured text={own.description} /> : `End ${end + 1}`}</h2>
              {op?.type === 'miter' && (
                <SawSetting
                  setting={formatAngle(op.setting)}
                  toEdge={formatAngle(angleToEdge(op.setting))}
                />
              )}
              {own?.measuredFrom === 'reference-face' && (
                <Text>Measured from the face marked with a loop, not the edge.</Text>
              )}
              {/* A plan the template did not describe end by end keeps the cut list's words. */}
              {!own && (
                <Text>
                  <Measured text={text} />
                </Text>
              )}
            </Stack>
          );
        })}
        {bothAngled && (
          <Text>{row.endsParallel ? 'The ends are parallel.' : 'The ends mirror each other.'}</Text>
        )}
        {row.marks.length > 0 && (
          <PlainList>
            {row.marks.map((m) => (
              <li key={m.label}>
                {m.label}: <Length>{m.value}</Length>
              </li>
            ))}
          </PlainList>
        )}
        {row.notes.map((n) => (
          <Text key={n}>
            <Measured text={n} />
          </Text>
        ))}
        {pieces.length > 0 && (
          <PlainList>
            {pieces.map((piece) => {
              const t = { kind: 'part' as const, key: partProgressKey(partId, piece.instance) };
              return (
                <li key={t.key}>
                  <Tick
                    done={ticks.isDone(t)}
                    waiting={ticks.isWaiting(t)}
                    onChange={(done) => ticks.set(t, done)}
                  >
                    Piece {piece.instance + 1} of {row.quantity} cut
                  </Tick>
                </li>
              );
            })}
          </PlainList>
        )}
      </BesideDrawing>
      {back}
    </>
  );
}
