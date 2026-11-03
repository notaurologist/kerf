import {
  type BuildStep,
  endName,
  findSkill,
  findToolType,
  formatLength,
  type MethodGaps,
  OPERATION_TYPE_LABELS,
  type Plan,
  type PlannedCutRow,
  type StepBoard,
  type StepOperation,
} from '@kerf/core';
import { Fragment } from 'react';
import { href } from '../../lib/route.ts';
import {
  ButtonLink,
  Cluster,
  FlagList,
  InfoNotice,
  InputNeeded,
  Length,
  List,
  Measured,
  PlainList,
  ResultLine,
  Row,
  Rows,
  SettingBox,
  SettingBoxes,
  Stack,
  Text,
  ToolLabel,
} from '../../ui/index.ts';
import { SourceToggle } from '../structural/Citation.tsx';

// The build steps (#105, #52), rendered from the project response: the API chose each method
// from the tool inventory and filled its numbers, so this only lays the words out. Stage 18 (#362,
// B1): what to do and the pieces first, operations done alike as one line opening to the method,
// and a missing tool said once per step. Cutting goes
// board by board (#58), each piece opening its part's cut detail. The shop view (M7) will show the
// same data one step at a time (`StepBody`).

export function BuildSteps(props: {
  steps: readonly BuildStep[];
  rows: readonly PlannedCutRow[];
  cutEnds: Plan['cutEnds'];
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
            <StepBody
              step={step}
              rows={props.rows}
              cutEnds={props.cutEnds}
              pieceHref={props.pieceHref}
            />
          </Stack>
        </li>
      ))}
    </PlainList>
  );
}

/**
 * One step's board or parts, flags, the template's notes, and operations with their methods: in
 * the plan's list, and one at a time in Building (#61). Each piece links to its cut card in
 * Building, or to its cut detail in the plan's drawings (`pieceHref`); with nowhere to go, it is
 * its name.
 */
export function StepBody(props: {
  step: BuildStep;
  rows: readonly PlannedCutRow[];
  /** How the template names each part's ends, for its settings. */
  cutEnds: Plan['cutEnds'];
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
              row={(id) => props.rows.find((r) => r.partId === id)}
              cutEnds={props.cutEnds}
              pieceHref={props.pieceHref}
            />
          )
        : step.partIds.length > 0 && (
            <Text tone="muted">Parts: {step.partIds.map(partName).join(', ')}.</Text>
          )}
      <FlagList flags={step.flags} />
      {step.notes && <List items={step.notes} terms />}
      <MissingTools ops={step.operations} partName={partName} />
      <Rows as="ul">
        {groupOperations(step.operations).map((group) => (
          <Row key={group.key} as="li">
            <OperationGroup ops={group.ops} partName={partName} />
          </Row>
        ))}
      </Rows>
    </Stack>
  );
}

/**
 * The step's operations, those of one kind done one way with the same numbers taken together, in
 * the order each first comes (Stage 18, B1): four identical miters are one line.
 */
export function groupOperations(ops: readonly StepOperation[]) {
  const groups = new Map<string, StepOperation[]>();
  for (const op of ops) {
    const key = JSON.stringify([op.operation.type, op.method ?? op.alternatives]);
    groups.set(key, [...(groups.get(key) ?? []), op]);
  }
  return [...groups].map(([key, grouped]) => ({ key, ops: grouped }));
}

/**
 * Before any tool is added, every step would say no method fits, so the plan and Building say
 * once where the steps get their methods.
 */
export function EmptyToolbox() {
  return (
    <InfoNotice>
      <Stack gap="xs">
        <Text>
          <b>My toolbox is empty,</b> so no step has a way to do its work yet. Add the tools you
          have, and each step picks a method that uses them.
        </Text>
        <Cluster>
          <ButtonLink variant="secondary" href={href({ screen: 'tools' })}>
            Add tools
          </ButtonLink>
        </Cluster>
      </Stack>
    </InfoNotice>
  );
}

/**
 * When no method fits the tools, said once for the step rather than on every operation: for each
 * kind of operation, its methods in the order core gives, closest to the tools first, each with
 * what it lacks. Operations of one kind that lack different things, such as crosscuts through
 * boards of two widths, are told apart by their parts.
 */
function MissingTools(props: { ops: readonly StepOperation[]; partName: (id: string) => string }) {
  const missing = props.ops.filter((op) => !op.method && op.alternatives.length > 0);
  if (missing.length === 0) return null;
  const groups = new Map<string, StepOperation[]>();
  for (const op of missing) {
    const key = JSON.stringify([op.operation.type, op.alternatives]);
    groups.set(key, [...(groups.get(key) ?? []), op]);
  }
  const kinds = [...groups.values()].map(([op]) => op?.operation.type);
  const label = (ops: readonly StepOperation[]) => {
    const [first] = ops;
    if (!first) return '';
    const type = OPERATION_TYPE_LABELS[first.operation.type];
    if (kinds.filter((k) => k === first.operation.type).length < 2) return type;
    const parts = [...new Set(ops.flatMap((op) => op.partIds))].map(props.partName);
    return `${type} on ${parts.join(', ')}`;
  };
  return (
    <Stack gap="2xs">
      <Text>
        <b>
          No method fits your tools for{' '}
          {missing.length === props.ops.length ? 'this step' : `${missing.length} of these`}.
        </b>{' '}
        <a href={href({ screen: 'tools' })}>Add a tool in My toolbox</a>
      </Text>
      <List>
        {[...groups].map(([key, ops]) => (
          <li key={key}>
            {label(ops)}, closest to your tools first:
            <List>
              {ops[0]?.alternatives.map((n) => (
                <li key={n.methodId}>
                  {n.methodName}: you need <Gaps of={n} />
                </li>
              ))}
            </List>
          </li>
        ))}
      </List>
    </Stack>
  );
}

/** One line for operations done alike, naming how many, on what, and with which tools. */
function OperationGroup(props: {
  ops: readonly StepOperation[];
  partName: (id: string) => string;
}) {
  const [first] = props.ops;
  if (!first) return null;
  const label = OPERATION_TYPE_LABELS[first.operation.type];
  const on = props.ops.map((op) => operationTitle(op, props.partName).slice(label.length + 2));
  const tools = first.method?.tools.map((t) => findToolType(t.toolTypeId)?.name ?? t.toolTypeId);
  return (
    <ResultLine
      title={props.ops.length > 1 ? `${label} × ${props.ops.length}` : label}
      detail={on.filter(Boolean).join('; ')}
      // With no method the step's own line says what is missing, so this one does not repeat it.
      result={tools?.join(', ')}
    >
      <Operation op={first} partName={props.partName} />
    </ResultLine>
  );
}

/** A board's pieces in the order they come off it, each opening its part's cut detail. */
function Board(props: {
  board: StepBoard;
  partName: (id: string) => string;
  quantity: ReadonlyMap<string, number>;
  row: (partId: string) => PlannedCutRow | undefined;
  cutEnds: Plan['cutEnds'];
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
            {pieceOf(piece.instance, props.quantity.get(piece.partId))}{' '}
            <EndSettings row={props.row(piece.partId)} cutEnds={props.cutEnds} />
          </li>
        ))}
      </List>
      <Offcut length={board.offcut} tone="muted" />
    </Stack>
  );
}

/**
 * A piece's saw settings beside its length (B1), only when an end is not square, since a square
 * cut needs no setting. Each is named for its end as the template names it ("Top 20.0°"), or by
 * number, and two angled ends say whether they are parallel, so the second cut is not turned the
 * wrong way (#455).
 */
export function EndSettings(props: { row: PlannedCutRow | undefined; cutEnds: Plan['cutEnds'] }) {
  const settings = props.row?.settings ?? [];
  if (settings.every((s) => s === '0.0°')) return null;
  const described = props.cutEnds.find((c) => c.partId === props.row?.partId);
  const name = (end: number) => {
    const description = described?.ends[end]?.description;
    return (description && endName(description)) ?? `End ${end + 1}`;
  };
  const bothAngled = settings.length === 2 && settings.every((s) => s !== '0.0°');
  return (
    <SettingBoxes>
      {settings.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the two ends are positional.
        <SettingBox key={i} end={name(i)}>
          {s}
        </SettingBox>
      ))}
      {bothAngled && (
        <span>{props.row?.endsParallel ? 'Ends parallel' : 'Ends mirror each other'}</span>
      )}
    </SettingBoxes>
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

/** What a line of operations opens to: the method, its tools, skills, and steps. */
function Operation(props: { op: StepOperation; partName: (id: string) => string }) {
  const { op } = props;
  const method = op.method;
  return (
    <Stack gap="xs">
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
        // The step says once what its tools lack (MissingTools).
        <Text tone="muted">No method fits your tools; the step says what is needed.</Text>
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
