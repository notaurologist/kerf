import {
  type BuildStep,
  type CutListRow,
  findSkill,
  findToolType,
  formatLength,
  type MethodGaps,
  OPERATION_TYPE_LABELS,
  type StepBoard,
  type StepOperation,
} from '@kerf/core';
import { Fragment } from 'react';
import { href } from '../../lib/route.ts';
import {
  Card,
  FlagList,
  InputNeeded,
  Length,
  List,
  Measured,
  PlainList,
  Stack,
  Text,
  ToolLabel,
} from '../../ui/index.ts';
import { SourceToggle } from '../structural/Citation.tsx';

// The build steps (#105, #52), rendered from the project response: the API chose each method
// from the tool inventory and filled its numbers, so this only lays the words out. Cutting goes
// board by board (#58), each piece opening its part's cut detail. The shop view (M7) will show the
// same data one step at a time (`StepBody`).

export function BuildSteps(props: {
  steps: readonly BuildStep[];
  rows: readonly CutListRow[];
  /** Where a piece opens its part's cut detail: in the plan, the drawings with it selected (#156). */
  pieceHref?: (partId: string) => string;
}) {
  return (
    <PlainList ordered>
      {props.steps.map((step, i) => (
        <li key={step.id}>
          <Stack gap="s">
            <h3>
              {i + 1}. {step.title}
            </h3>
            <StepBody step={step} rows={props.rows} pieceHref={props.pieceHref} />
          </Stack>
        </li>
      ))}
    </PlainList>
  );
}

/**
 * One step's board or parts, flags, and operations with their methods: in the plan's list, and
 * one at a time in Building (#61). Each piece links to its cut card in Building, or to its cut
 * detail in the plan's drawings (`pieceHref`); with nowhere to go, it is its name.
 */
export function StepBody(props: {
  step: BuildStep;
  rows: readonly CutListRow[];
  pieceHref?: (partId: string) => string;
  /** Leave the board's pieces out, for a screen that shows them its own way (#118). */
  withoutBoard?: boolean;
}) {
  const { step } = props;
  const parts = new Map(props.rows.map((r) => [r.partId, `${r.letter} ${r.name}`]));
  const partName = (id: string) => parts.get(id) ?? id;
  const quantity = new Map(props.rows.map((r) => [r.partId, r.quantity]));
  return (
    <Stack gap="s">
      {step.board
        ? !props.withoutBoard && (
            <Board
              board={step.board}
              partName={partName}
              quantity={quantity}
              pieceHref={props.pieceHref}
            />
          )
        : step.partIds.length > 0 && (
            <Text tone="muted">Parts: {step.partIds.map(partName).join(', ')}.</Text>
          )}
      <FlagList flags={step.flags} />
      <PlainList>
        {step.operations.map((op) => (
          <Card key={op.operation.id} as="li">
            <Operation op={op} partName={partName} />
          </Card>
        ))}
      </PlainList>
    </Stack>
  );
}

/** A board's pieces in the order they come off it, each opening its part's cut detail. */
function Board(props: {
  board: StepBoard;
  partName: (id: string) => string;
  quantity: ReadonlyMap<string, number>;
  pieceHref?: (partId: string) => string;
}) {
  const { board } = props;
  return (
    <Stack gap="xs">
      <Text>
        Trim <Length>{formatLength(board.trimPerEnd)}</Length> off the end to square it, then cut
        these in order, measuring each from the fresh cut. Each saw cut takes about{' '}
        <Length>{formatLength(board.kerf)}</Length>.
      </Text>
      <List ordered>
        {board.pieces.map((piece) => (
          <li key={`${piece.partId}/${piece.instance}`}>
            {props.pieceHref ? (
              <a href={props.pieceHref(piece.partId)}>{props.partName(piece.partId)}</a>
            ) : (
              props.partName(piece.partId)
            )}{' '}
            <Length>{formatLength(piece.length)}</Length>
            {pieceOf(piece.instance, props.quantity.get(piece.partId))}
          </li>
        ))}
      </List>
      <Offcut length={board.offcut} tone="muted" />
    </Stack>
  );
}

/** ", piece 2 of 3" for a part cut more than once from the boards; nothing for a single piece. */
export function pieceOf(instance: number, quantity: number | undefined): string {
  return (quantity ?? 1) > 1 ? `, piece ${instance + 1} of ${quantity}` : '';
}

/** What a board leaves once its pieces are cut. */
export function Offcut(props: { length: number; tone?: 'muted' }) {
  return (
    <Text tone={props.tone}>
      Left over after both ends are trimmed: <Length>{formatLength(props.length)}</Length>.
    </Text>
  );
}

function operationTitle(op: StepOperation, partName: (id: string) => string): string {
  const { operation } = op;
  const label = OPERATION_TYPE_LABELS[operation.type];
  const on = op.partIds.map(partName).join(', ');
  const end = 'end' in operation ? `, end ${operation.end + 1}` : '';
  return on ? `${label}: ${on}${end}` : label;
}

function Operation(props: { op: StepOperation; partName: (id: string) => string }) {
  const { op } = props;
  const method = op.method;
  return (
    <Stack gap="xs">
      <h4>{operationTitle(op, props.partName)}</h4>
      {method ? (
        <>
          <Text>
            <b>{method.name}.</b> Tools:{' '}
            {method.tools.map((t, i) => (
              <Fragment key={t.toolTypeId}>
                {i > 0 && ', '}
                <a href={href({ screen: 'tools', tool: t.toolTypeId })}>
                  <ToolLabel toolTypeId={t.toolTypeId}>
                    {findToolType(t.toolTypeId)?.name ?? t.toolTypeId}
                    {t.name && ` (${t.name})`}
                  </ToolLabel>
                </a>
              </Fragment>
            ))}
            .
          </Text>
          {op.skills.length > 0 && (
            <Text tone="muted">
              Skills: {op.skills.map((s) => findSkill(s)?.name ?? s).join(', ')}.
            </Text>
          )}
          {method.setup.length > 0 && (
            <>
              <b>Setup</b>
              <List ordered items={method.setup} terms />
            </>
          )}
          <b>Technique</b>
          <List ordered items={method.technique} terms />
          <b>Common mistakes</b>
          <List items={method.mistakes} terms />
          {method.safety.length > 0 && (
            <>
              <b>Safety</b>
              <List>
                {method.safety.map((s) => (
                  <li key={s.text}>
                    <Stack gap="3xs">
                      <Measured text={s.text} />
                      <SourceToggle citations={s.sources} />
                    </Stack>
                  </li>
                ))}
              </List>
            </>
          )}
        </>
      ) : (
        op.needed && (
          <Text>
            No method fits your tools. {op.needed.methodName}, you need <Gaps of={op.needed} />
          </Text>
        )
      )}
      {op.inputNeeded.map((m) => (
        <Text key={m.methodId}>
          <InputNeeded /> {m.methodName}, enter <Gaps of={m} />
        </Text>
      ))}
      {op.suggestions.map((s) => (
        <Text key={s.methodId} tone="muted">
          Tool suggestion: {s.better.join(' and ')} {s.methodName.toLowerCase()}. You need{' '}
          <Gaps of={s} />
        </Text>
      ))}
    </Stack>
  );
}

/** What a method lacks: each requirement, with the tools that would meet it. */
function Gaps(props: { of: MethodGaps }) {
  return <>{props.of.gaps.map((g) => `${g.anyOf.join(' or ')}, for ${g.use}`).join('; ')}.</>;
}
