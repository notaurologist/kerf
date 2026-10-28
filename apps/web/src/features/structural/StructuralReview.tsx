import {
  CHECKLIST_CATEGORY_LABELS,
  type ChecklistItem,
  FLAG_CATEGORY_LABELS,
  type Flag,
  structural,
} from '@kerf/core';
import { Measured } from '../../components/Measured.tsx';
import { href } from '../../lib/route.ts';
import { CitationList, SourceList, SourceToggle } from './Citation.tsx';

// The structural review (PRODUCT.md, MVP feature 7): sanity checks with their full working, the
// design's expert-check flags, and the confirmation checklist. Results are margins under stated
// assumptions, never verdicts (decision 0001). Every number comes formatted from core.

type CheckResult = structural.CheckResult;
type Quantity = structural.Quantity;
const { formatMargin, formatQuantity } = structural;

export function StructuralReview(props: {
  projectId: string;
  checks: readonly CheckResult[];
  flags: readonly Flag[];
  checklist: readonly ChecklistItem[];
}) {
  return (
    <>
      <p className="muted">
        Sanity checks, not an engineered design. A margin is the allowable value divided by the
        computed one, under the assumptions listed with it. Judge each one with an experienced
        builder.
      </p>
      <h3>Sanity checks</h3>
      <div className="stack">
        {props.checks.map((check) => (
          <Check key={`${check.kind}/${check.subject}`} check={check} projectId={props.projectId} />
        ))}
      </div>

      {props.flags.length > 0 && (
        <>
          <h3>Ask an experienced builder</h3>
          <ul className="plain stack">
            {props.flags.map((flag) => (
              <li key={flag.ask} className="card flag">
                <strong>{FLAG_CATEGORY_LABELS[flag.category]}</strong>
                <p>
                  <Measured text={flag.ask} />
                </p>
                <p className="muted">
                  <Measured text={flag.why} />
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <SourcesUsed checks={props.checks} />

      <h3>Confirmation checklist</h3>
      <p className="muted">Not computed. Confirm each with an experienced builder.</p>
      <ul className="plain stack">
        {props.checklist.map((item) => (
          <li key={`${item.category}/${item.element}`} className="card">
            <span className="muted">{CHECKLIST_CATEGORY_LABELS[item.category]}</span>
            <br />
            <strong>{item.element}</strong>
            <p>
              <Measured text={item.confirm} />
            </p>
            <p className="muted">
              <Measured text={item.why} />
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

function Check(props: { check: CheckResult; projectId: string }) {
  const { check } = props;
  return (
    <section className={`card check ${check.status}`}>
      <h4>
        {check.title}: {check.subject}
      </h4>
      <p className="muted">{check.loadCase}</p>
      {check.status === 'computed' && (
        <>
          <p className="margin">{formatMargin(check.margin)} under these assumptions</p>
          <p>
            Computed {check.computed.label.toLowerCase()} {check.computed.symbol} ={' '}
            <Value q={check.computed} />; allowed {check.allowable.symbol} ={' '}
            <Value q={check.allowable} />.
          </p>
          <Working check={check} />
        </>
      )}
      {check.status === 'input-needed' && (
        <>
          <p className="margin">Input needed</p>
          <ul>
            {check.missing.map((m) => (
              <li key={m.key}>{m.label}</li>
            ))}
          </ul>
          <a href={href({ screen: 'edit-project', id: props.projectId })}>
            Enter structural inputs
          </a>
        </>
      )}
      {check.status === 'not-computed' && (
        <>
          <p className="margin">Not computed</p>
          <p>{check.reason}</p>
          {check.sources.length > 0 && <CitationList citations={check.sources} />}
        </>
      )}
    </section>
  );
}

function Value(props: { q: Pick<Quantity, 'value' | 'unit'> }) {
  return <span className="nowrap">{formatQuantity(props.q)}</span>;
}

function Working(props: { check: Extract<CheckResult, { status: 'computed' }> }) {
  const { check } = props;
  return (
    <details className="working">
      <summary>Show the working</summary>
      <h5>Inputs</h5>
      <Quantities list={check.inputs} />
      <h5>Formulas</h5>
      <ol className="formulas">
        {check.formulas.map((f) => (
          <li key={f}>
            <code>{f}</code>
          </li>
        ))}
      </ol>
      {check.sources.length > 0 && (
        <>
          <p className="muted">Formulas from:</p>
          <CitationList citations={check.sources} />
        </>
      )}
      {check.steps.length > 0 && (
        <>
          <h5>Steps</h5>
          <Quantities list={check.steps} />
        </>
      )}
      {check.factors.length > 0 && (
        <>
          <h5>Adjustment factors</h5>
          <table className="list working-table">
            <thead>
              <tr>
                <th>Factor</th>
                <th className="number">Value</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {check.factors.map((f) => (
                <tr key={f.symbol}>
                  <td data-label="Factor">
                    <code>{f.symbol}</code> {f.name}{' '}
                    <span className="muted">(on {f.appliesTo.join(', ')})</span>
                  </td>
                  <td data-label="Value" className="number">
                    <Value q={{ value: f.value, unit: '' }} />
                  </td>
                  <td data-label="Why">
                    {f.reason}
                    <SourceToggle citations={f.sources} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <h5>Result</h5>
      <Quantities list={[check.computed, check.allowable]} />
      <p>
        margin = {check.allowable.symbol} / {check.computed.symbol} ={' '}
        <strong>{formatMargin(check.margin)}</strong>
      </p>
      <h5>Assumptions</h5>
      <ul>
        {check.assumptions.map((a) => (
          <li key={a}>
            <Measured text={a} />
          </li>
        ))}
      </ul>
    </details>
  );
}

function Quantities(props: { list: readonly Quantity[] }) {
  return (
    <table className="list working-table">
      <tbody>
        {props.list.map((q) => (
          <tr key={`${q.symbol}/${q.label}`}>
            <td data-label="Symbol">
              <code>{q.symbol}</code>
            </td>
            <td data-label="What">
              {q.label}
              {q.basis && <span className="muted"> ({q.basis})</span>}
              <SourceToggle citations={q.sources} />
            </td>
            <td data-label="Value" className="number">
              <Value q={q} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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
    <details className="sources-used">
      <summary>Publications these checks draw on</summary>
      <SourceList citations={citations} />
    </details>
  );
}
