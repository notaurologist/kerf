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
import { cutDetailId, show } from '../../lib/show.ts';
import {
  Button,
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

export function BuildSteps(props: { steps: readonly BuildStep[]; rows: readonly CutListRow[] }) {
  return (
    <PlainList ordered>
      {props.steps.map((step, i) => (
        <li key={step.id}>
          <Stack gap="s">
            <h3>
              {i + 1}. {step.title}
            </h3>
            <StepBody step={step} rows={props.rows} />
          </Stack>
        </li>
      ))}
    </PlainList>
  );
}

/**
 * One step's board or parts, flags, and operations with their methods: in the plan's list, and
 * one at a time in Building (#61). In Building each piece links to its cut card (`pieceHref`); in
 * the plan it shows the part's cut detail on the page.
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
              <Button variant="link" onClick={() => show(cutDetailId(piece.partId))}>
                {props.partName(piece.partId)}
              </Button>
            )}{' '}
            <Length>{formatLength(piece.length)}</Length>
            {(props.quantity.get(piece.partId) ?? 1) > 1 &&
              `, piece ${piece.instance + 1} of ${props.quantity.get(piece.partId)}`}
          </li>
        ))}
      </List>
      <Text tone="muted">
        Left over after both ends are trimmed: <Length>{formatLength(board.offcut)}</Length>.
      </Text>
    </Stack>
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
                <ToolLabel toolTypeId={t.toolTypeId}>
                  {findToolType(t.toolTypeId)?.name ?? t.toolTypeId}
                </ToolLabel>
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
              <List ordered items={method.setup} />
            </>
          )}
          <b>Technique</b>
          <List ordered items={method.technique} />
          <b>Common mistakes</b>
          <List items={method.mistakes} />
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
