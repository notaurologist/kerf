import { CHECKLIST_CATEGORY_LABELS, type ChecklistItem, type Flag, structural } from '@kerf/core';
import { href } from '../../lib/route.ts';
import { EXPERT_CHECKS_ID } from '../../lib/show.ts';
import {
  Card,
  CheckStatus,
  Code,
  Disclosure,
  FlagList,
  List,
  Measured,
  MeasureTable,
  PlainList,
  Readings,
  Stack,
  Text,
} from '../../ui/index.ts';
import { BoltLayout } from './BoltLayout.tsx';
import { CitationList, SourceList, SourceToggle } from './Citation.tsx';

// The structural review (PRODUCT.md, MVP feature 7): structural checks with their full working,
// the design's expert checks, and the confirmation checklist. Results are margins under stated
// assumptions, never verdicts (decision 0001). Every number comes formatted from core.

type CheckResult = structural.CheckResult;
type Quantity = structural.Quantity;
const { formatMargin, formatQuantity } = structural;

export function StructuralReview(props: {
  projectId: string;
  checks: readonly CheckResult[];
  flags: readonly Flag[];
  checklist: readonly ChecklistItem[];
  boltLayout?: readonly structural.BoltJoint[];
}) {
  return (
    <Stack>
      <Text tone="muted">
        Structural checks, not an engineered design. A margin is the allowable value divided by the
        computed one, under the assumptions listed with it. Judge each one with an experienced
        builder.
      </Text>
      <h3>Structural checks</h3>
      <Stack>
        {props.checks.map((check) => (
          <Check key={`${check.kind}/${check.subject}`} check={check} projectId={props.projectId} />
        ))}
      </Stack>

      <BoltLayout joints={props.boltLayout ?? []} />

      {props.flags.length > 0 && (
        <>
          {/* Focusable, so the summary's flags can open the review here (#156). */}
          <h3 id={EXPERT_CHECKS_ID} tabIndex={-1}>
            Expert checks
          </h3>
          <FlagList flags={props.flags} />
        </>
      )}

      <SourcesUsed checks={props.checks} />

      <h3>Confirmation checklist</h3>
      <Text tone="muted">Not computed. Confirm each with an experienced builder.</Text>
      <PlainList>
        {props.checklist.map((item) => (
          <Card key={`${item.category}/${item.element}`} as="li">
            <Stack gap="2xs">
              <Text tone="muted" size="small">
                {CHECKLIST_CATEGORY_LABELS[item.category]}
              </Text>
              <b>{item.element}</b>
              <Text>
                <Measured text={item.confirm} />
              </Text>
              <Text tone="muted">
                <Measured text={item.why} />
              </Text>
            </Stack>
          </Card>
        ))}
      </PlainList>
    </Stack>
  );
}

function Check(props: { check: CheckResult; projectId: string }) {
  const { check } = props;
  return (
    <Card as="section">
      <Stack gap="xs">
        <h4>
          {check.title}: {check.subject}
        </h4>
        <Text tone="muted">{check.loadCase}</Text>
        <CheckStatus check={check} />
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
          <>
            <List items={check.missing.map((m) => m.label)} />
            <a
              href={href({
                screen: 'edit-project',
                id: props.projectId,
                from: 'structural-review',
              })}
            >
              Enter structural inputs
            </a>
          </>
        )}
        {check.status === 'not-computed' && check.sources.length > 0 && (
          <CitationList citations={check.sources} />
        )}
      </Stack>
    </Card>
  );
}

function Value(props: { q: Pick<Quantity, 'value' | 'unit'> }) {
  return <Readings text={formatQuantity(props.q)} />;
}

function Working(props: { check: Extract<CheckResult, { status: 'computed' }> }) {
  const { check } = props;
  return (
    <Disclosure summary="Show the working">
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
    </Disclosure>
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

function SourcesUsed(props: { checks: readonly CheckResult[] }) {
  const citations = citationsIn(props.checks);
  if (citations.length === 0) return null;
  return (
    <Disclosure summary="Publications these checks draw on">
      <SourceList citations={citations} />
    </Disclosure>
  );
}
