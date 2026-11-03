import {
  CHECKLIST_CATEGORY_LABELS,
  type ChecklistItem,
  checklistProgressKey,
  FLAG_CATEGORY_LABELS,
  type Flag,
  flagProgressKey,
  type movement,
  type SuggestedItem,
  structural,
  suggestionsUsed,
  summarizeReview,
} from '@kerf/core';
import { EXPERT_CHECKS_ID } from '../../lib/show.ts';
import type { Suggested } from '../../lib/suggested.ts';
import type { Ticks } from '../../lib/ticks.ts';
import {
  Card,
  CheckStatus,
  Code,
  Disclosure,
  InputNeeded,
  List,
  Measured,
  MeasureTable,
  Readings,
  ResultLine,
  Row,
  Rows,
  Sidebar,
  Stack,
  Text,
  Tick,
} from '../../ui/index.ts';
import { Waiting } from '../modes/modes.tsx';
import { BoltLayout } from './BoltLayout.tsx';
import { CitationList, SourceList, SourceToggle } from './Citation.tsx';

// The structural review (PRODUCT.md, MVP feature 7) as Stage 15 lays it out (#359, S1): what the
// owner has to do first (inputs needed, the design's expert checks, the confirmation checklist),
// then one line per check with its margin, opening to its full working. Results are margins under stated
// assumptions, never verdicts (decision 0001). Every number comes formatted from core. Each expert
// check and checklist item has a tick (#393) that says it was asked or confirmed, nothing more.
// Each value Kerf suggested has a tick that confirms it (#417), and a result computed with one not
// yet confirmed says so beside its margin.

/** The wood movement subsection's opening line, exported for the printed plan's terms too. */
export const WOOD_MOVEMENT_INTRO =
  'How much each part is expected to change across its grain between the lowest and highest moisture content you entered. These are estimates for leaving room, not checks, so they have no margin.';

/** The review's opening line, exported so the printed plan's terms include it. */
export const STRUCTURAL_REVIEW_INTRO =
  'Structural checks, not an engineered design. A margin is the allowable value divided by the computed one, under the assumptions listed with it. Judge each one with an experienced builder.';

type CheckResult = structural.CheckResult;
type MovementResult = movement.MovementResult;
type Quantity = structural.Quantity;
const { formatBreakEven, formatMargin, formatQuantity } = structural;

export function StructuralReview(props: {
  inputHref: (key: string) => string;
  checks: readonly CheckResult[];
  flags: readonly Flag[];
  checklist: readonly ChecklistItem[];
  ticks: Ticks;
  boltLayout?: readonly structural.BoltJoint[];
  movement?: readonly MovementResult[];
  /** The values Kerf suggested, and how to confirm them. */
  suggested?: Suggested;
}) {
  const movement = props.movement ?? [];
  const suggested = props.suggested;
  const values = suggested?.items ?? [];
  const results = (
    <Stack>
      <h3>Checks</h3>
      <Text tone="muted">
        The lowest margin comes first, after any check still waiting for inputs, since one of those
        could be the lowest. Open a check for its working and the assumptions its margin rests on.
      </Text>
      <Rows>
        {byMargin(props.checks).map((check) => (
          <Row key={`${check.kind}/${check.subject}`} as="section">
            <Check check={check} inputHref={props.inputHref} suggested={values} />
          </Row>
        ))}
      </Rows>

      {movement.length > 0 && (
        <>
          <h3>Wood movement</h3>
          <Text tone="muted">
            <Measured text={WOOD_MOVEMENT_INTRO} terms />
          </Text>
          <Rows>
            {movement.map((m) => (
              <Row key={m.subject} as="section">
                <Movement result={m} inputHref={props.inputHref} suggested={values} />
              </Row>
            ))}
          </Rows>
        </>
      )}

      <BoltLayout joints={props.boltLayout ?? []} suggested={values} />

      <SourcesUsed checks={props.checks} movement={movement} />
    </Stack>
  );
  const missing = missingInputs([...props.checks, ...movement]);
  const toDo =
    missing.length + props.flags.length + props.checklist.length + values.length > 0 ? (
      <ToDo
        missing={missing}
        inputHref={props.inputHref}
        flags={props.flags}
        checklist={props.checklist}
        ticks={props.ticks}
        suggested={suggested}
      />
    ) : null;
  return (
    <Stack>
      <Text tone="muted">
        <Measured text={STRUCTURAL_REVIEW_INTRO} terms />
      </Text>
      {/* What the owner has to do leads, beside the results from 600 px (Stage 15, S1). */}
      {toDo ? (
        <Sidebar sideWidth="m" gap="l">
          {toDo}
          {results}
        </Sidebar>
      ) : (
        results
      )}
    </Stack>
  );
}

/**
 * The checks with the lowest margin first, after those waiting for inputs (any could be the
 * lowest), and those that could not be computed last.
 */
export function byMargin(checks: readonly CheckResult[]): CheckResult[] {
  const rank = (c: CheckResult) =>
    c.status === 'input-needed'
      ? -1
      : c.status === 'computed'
        ? c.margin
        : Number.POSITIVE_INFINITY;
  return [...checks].sort((a, b) => rank(a) - rank(b));
}

/** Every input the checks and estimates wait for, each once, in the order first named. */
function missingInputs(results: readonly (CheckResult | MovementResult)[]) {
  const seen = new Map<string, structural.MissingInput>();
  for (const r of results) {
    if (r.status !== 'input-needed') continue;
    for (const m of r.missing) if (!seen.has(m.key)) seen.set(m.key, m);
  }
  return [...seen.values()];
}

/**
 * What the owner has to do: inputs to enter, and what to ask and confirm with a builder. The count
 * is what is still open: inputs clear when entered, the rest when ticked.
 */
function ToDo(props: {
  missing: readonly structural.MissingInput[];
  inputHref: (key: string) => string;
  flags: readonly Flag[];
  checklist: readonly ChecklistItem[];
  ticks: Ticks;
  suggested?: Suggested;
}) {
  const { ticks, suggested } = props;
  const review = summarizeReview(props, ticks.ticked());
  const unconfirmed = (suggested?.items ?? []).filter((s) => !s.confirmed).length;
  const count = props.missing.length + review.flags.open + review.checklist.open + unconfirmed;
  const tick = (kind: 'flag' | 'checklist-item', key: string) => {
    const item = { kind, key };
    return {
      done: ticks.isDone(item),
      waiting: ticks.isWaiting(item),
      onChange: (done: boolean) => ticks.set(item, done),
    };
  };
  return (
    <Card as="section">
      <Stack>
        <h3>To do · {count}</h3>
        <Waiting ticks={ticks} />
        {props.missing.length > 0 && (
          <Stack gap="xs">
            <h4>Inputs needed</h4>
            <MissingInputs missing={props.missing} inputHref={props.inputHref} />
          </Stack>
        )}
        {suggested && suggested.items.length > 0 && (
          <Stack gap="xs">
            <h4>Suggested values</h4>
            <Text tone="muted">
              Kerf suggested these from the sources named. Check each, and tick Confirmed once you
              have, or change it in Edit. A result that uses one not yet confirmed says so.
            </Text>
            {suggested.problem && <Text>{suggested.problem}</Text>}
            <Rows as="ul">
              {suggested.items.map((item) => (
                <Row key={item.key} as="li">
                  <Stack gap="2xs">
                    <ResultLine title={item.label} result={<Readings text={item.text} />}>
                      <Text tone="muted">
                        <Measured text={item.about} />
                      </Text>
                    </ResultLine>
                    <Tick
                      done={item.confirmed}
                      waiting={suggested.sending.has(item.key)}
                      onChange={(done) => suggested.set(item, done)}
                      context={`: ${item.label}, ${item.text}`}
                    >
                      Confirmed
                    </Tick>
                  </Stack>
                </Row>
              ))}
            </Rows>
          </Stack>
        )}
        {props.flags.length > 0 && (
          <Stack gap="xs">
            {/* Focusable, so the header's count can open the review here (#156, #356). */}
            <h4 id={EXPERT_CHECKS_ID} tabIndex={-1}>
              Expert checks
            </h4>
            <Text tone="muted">
              Ask an experienced builder, and tick Asked once you have. A tick stays until the plan
              asks something else.
            </Text>
            {/* What to ask, with why behind it, so the checks are not pushed out of view. */}
            <Rows as="ul">
              {props.flags.map((flag) => (
                <Row key={`${flag.category}/${flag.ask}`} as="li">
                  <Stack gap="2xs">
                    <ResultLine
                      title={<Measured text={flag.ask} />}
                      detail={FLAG_CATEGORY_LABELS[flag.category]}
                    >
                      <Text>
                        Why: <Measured text={flag.why} terms />
                      </Text>
                    </ResultLine>
                    <Tick {...tick('flag', flagProgressKey(flag))} context={`: ${flag.ask}`}>
                      Asked
                    </Tick>
                  </Stack>
                </Row>
              ))}
            </Rows>
          </Stack>
        )}
        {props.checklist.length > 0 && (
          <Stack gap="xs">
            <h4>Confirmation checklist</h4>
            <Text tone="muted">
              Not computed. Confirm each with an experienced builder, and tick Confirmed once you
              have. A tick stays until the plan changes the item.
            </Text>
            <Rows as="ul">
              {props.checklist.map((item) => (
                <Row key={`${item.category}/${item.element}`} as="li">
                  <Stack gap="2xs">
                    <ResultLine
                      title={item.element}
                      detail={CHECKLIST_CATEGORY_LABELS[item.category]}
                    >
                      <Stack gap="2xs">
                        <Text>
                          <Measured text={item.confirm} terms />
                        </Text>
                        <Text tone="muted">
                          <Measured text={item.why} terms />
                        </Text>
                      </Stack>
                    </ResultLine>
                    <Tick
                      {...tick('checklist-item', checklistProgressKey(item))}
                      context={`: ${item.element}`}
                    >
                      Confirmed
                    </Tick>
                  </Stack>
                </Row>
              ))}
            </Rows>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

/** The suggested values a result was computed with that are not confirmed yet. */
function unconfirmedIn(result: CheckResult | MovementResult, suggested: readonly SuggestedItem[]) {
  return suggestionsUsed(result, suggested).filter((s) => !s.confirmed);
}

/** Which unconfirmed suggestions a result uses, by field and value. */
function UsesSuggested(props: {
  values: readonly { label: string; text: string; about: string }[];
}) {
  if (props.values.length === 0) return null;
  return (
    <Text>
      Uses {props.values.length === 1 ? 'a suggested value' : 'suggested values'} not confirmed yet:{' '}
      {props.values.map((v, i) => (
        <span key={v.label}>
          {i > 0 && '; '}
          {v.label}, <Readings text={v.text} />
        </span>
      ))}
      . Confirm {props.values.length === 1 ? 'it' : 'them'} under To do, or change{' '}
      {props.values.length === 1 ? 'it' : 'them'} in Edit.
    </Text>
  );
}

/** One check as a line with its margin, opening to its working. */
function Check(props: {
  check: CheckResult;
  inputHref: (key: string) => string;
  suggested: Suggested['items'];
}) {
  const { check } = props;
  const unconfirmed = unconfirmedIn(check, props.suggested);
  return (
    <ResultLine
      title={<Measured text={`${check.title}: ${check.subject}`} />}
      detail={<Measured text={check.loadCase} />}
      result={
        check.status === 'computed' ? (
          unconfirmed.length > 0 ? (
            `${formatMargin(check.margin)}, with a suggested value`
          ) : (
            formatMargin(check.margin)
          )
        ) : check.status === 'input-needed' ? (
          <InputNeeded />
        ) : (
          'Not computed'
        )
      }
    >
      <Stack gap="xs">
        <Text tone="muted">
          <Measured text={check.loadCase} terms />
        </Text>
        {/* Input needed is on the line already; the links to enter each follow. */}
        {check.status !== 'input-needed' && <CheckStatus check={check} />}
        <UsesSuggested values={unconfirmed} />
        {check.status !== 'not-computed' && check.breakEven && (
          <Text>
            <Readings text={breakEvenLine(check.breakEven)} />
          </Text>
        )}
        {check.status === 'computed' && (
          <>
            <Text>
              Computed {check.computed.label.toLowerCase()} {check.computed.symbol} ={' '}
              <Value q={check.computed} />; allowed {check.allowable.symbol} ={' '}
              <Value q={check.allowable} />.
            </Text>
            <Working check={check} />
          </>
        )}
        {check.status === 'input-needed' && (
          <MissingInputs missing={check.missing} inputHref={props.inputHref} />
        )}
        {check.status === 'not-computed' && check.sources.length > 0 && (
          <CitationList citations={check.sources} />
        )}
      </Stack>
    </ResultLine>
  );
}

/** Where a check reaches margin 1.0 as its load factor grows, other inputs as entered (#401). */
function breakEvenLine(b: structural.BreakEven): string {
  return `With the other inputs as entered: ${formatBreakEven(b)}.`;
}

/** Each input a result needs, as a link to its field in Edit. */
function MissingInputs(props: {
  missing: readonly structural.MissingInput[];
  inputHref: (key: string) => string;
}) {
  return (
    <List>
      {props.missing.map((m) => (
        <li key={m.key}>
          <a href={props.inputHref(m.key)}>{m.label}</a>
        </li>
      ))}
    </List>
  );
}

function Movement(props: {
  result: MovementResult;
  inputHref: (key: string) => string;
  suggested: Suggested['items'];
}) {
  const { result } = props;
  const unconfirmed = unconfirmedIn(result, props.suggested);
  return (
    <ResultLine
      title={<Measured text={result.subject} />}
      result={
        result.status === 'computed' ? (
          <>
            about <Value q={result.change} />
          </>
        ) : result.status === 'input-needed' ? (
          <InputNeeded />
        ) : (
          'Not computed'
        )
      }
    >
      {result.status === 'computed' && (
        <Stack>
          <Text>
            Changes about{' '}
            <b>
              <Value q={result.change} />
            </b>{' '}
            across the grain.
          </Text>
          <UsesSuggested values={unconfirmed} />
          <h5>Inputs</h5>
          <Quantities caption="Inputs" list={result.inputs} />
          <h5>Formula</h5>
          <List ordered>
            {result.formulas.map((f) => (
              <li key={f}>
                <Code>{f}</Code>
              </li>
            ))}
          </List>
          <Text tone="muted">From:</Text>
          <CitationList citations={result.sources} />
          <h5>Result</h5>
          <Quantities caption="Result" list={[result.change]} />
          <h5>Assumptions</h5>
          <List items={result.assumptions} />
        </Stack>
      )}
      {result.status === 'input-needed' && (
        <Stack gap="xs">
          <Text>Input needed:</Text>
          <MissingInputs missing={result.missing} inputHref={props.inputHref} />
        </Stack>
      )}
      {result.status === 'not-computed' && (
        <Stack gap="xs">
          <Text>Not computed. {result.reason}</Text>
          <CitationList citations={result.sources} />
        </Stack>
      )}
    </ResultLine>
  );
}

function Value(props: { q: Pick<Quantity, 'value' | 'unit'> }) {
  return <Readings text={formatQuantity(props.q)} />;
}

/** A computed check's full working, shown when its line is opened (and always in print). */
function Working(props: { check: Extract<CheckResult, { status: 'computed' }> }) {
  const { check } = props;
  return (
    <Stack>
      <h5>Inputs</h5>
      <Quantities caption="Inputs" list={check.inputs} />
      <h5>Formulas</h5>
      <List ordered>
        {check.formulas.map((f) => (
          <li key={f}>
            <Code>{f}</Code>
          </li>
        ))}
      </List>
      {check.sources.length > 0 && (
        <>
          <Text tone="muted">Formulas from:</Text>
          <CitationList citations={check.sources} />
        </>
      )}
      {check.steps.length > 0 && (
        <>
          <h5>Steps</h5>
          <Quantities caption="Steps" list={check.steps} />
        </>
      )}
      {check.factors.length > 0 && (
        <>
          <h5>Adjustment factors</h5>
          <MeasureTable
            caption="Adjustment factors"
            captionHidden
            rows={check.factors}
            rowKey={(f) => f.symbol}
            columns={[
              {
                key: 'factor',
                label: 'Factor',
                cell: (f) => (
                  <>
                    <Code>{f.symbol}</Code> {f.name}{' '}
                    <Text tone="muted" as="span">
                      (on {f.appliesTo.join(', ')})
                    </Text>
                  </>
                ),
              },
              {
                key: 'value',
                label: 'Value',
                numeric: true,
                cell: (f) => <Value q={{ value: f.value, unit: '' }} />,
              },
              {
                key: 'why',
                label: 'Why',
                cell: (f) => (
                  <>
                    {f.reason}
                    <SourceToggle citations={f.sources} />
                  </>
                ),
              },
            ]}
          />
        </>
      )}
      <h5>Result</h5>
      <Quantities caption="Result" list={[check.computed, check.allowable]} />
      <Text>
        margin = {check.allowable.symbol} / {check.computed.symbol} ={' '}
        <b>{formatMargin(check.margin)}</b>
      </Text>
      <h5>Assumptions</h5>
      <List items={check.assumptions} />
    </Stack>
  );
}

function Quantities(props: { caption: string; list: readonly Quantity[] }) {
  return (
    <MeasureTable
      caption={props.caption}
      captionHidden
      rows={props.list}
      rowKey={(q) => `${q.symbol}/${q.label}`}
      columns={[
        { key: 'symbol', label: 'Symbol', cell: (q) => <Code>{q.symbol}</Code> },
        {
          key: 'what',
          label: 'What',
          cell: (q) => (
            <>
              {q.label}
              {q.basis && (
                <Text tone="muted" as="span">
                  {' '}
                  ({q.basis})
                </Text>
              )}
              <SourceToggle citations={q.sources} />
            </>
          ),
        },
        { key: 'value', label: 'Value', numeric: true, cell: (q) => <Value q={q} /> },
      ]}
    />
  );
}

/** Every citation in the checks: on the check, its values, and its factors. */
export function citationsIn(checks: readonly CheckResult[]) {
  return checks.flatMap((c) => {
    if (c.status === 'input-needed') return [];
    if (c.status === 'not-computed') return c.sources;
    return [
      ...c.sources,
      ...[...c.inputs, ...c.steps, c.computed, c.allowable].flatMap((q) => q.sources ?? []),
      ...c.factors.flatMap((f) => f.sources),
    ];
  });
}

/** Every citation in the movement estimates: on each, and on its values. */
function citationsInMovement(results: readonly MovementResult[]) {
  return results.flatMap((m) => {
    if (m.status === 'input-needed') return [];
    if (m.status === 'not-computed') return m.sources;
    return [...m.sources, ...[...m.inputs, m.change].flatMap((q) => q.sources ?? [])];
  });
}

function SourcesUsed(props: {
  checks: readonly CheckResult[];
  movement: readonly MovementResult[];
}) {
  const citations = [...citationsIn(props.checks), ...citationsInMovement(props.movement)];
  if (citations.length === 0) return null;
  return (
    <Disclosure summary="Publications these checks draw on">
      <SourceList citations={citations} />
    </Disclosure>
  );
}
