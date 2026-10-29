import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon.tsx';

// What Kerf tells the reader about the state of things (#43, #67, #68). Every state has a second
// signal besides color: an icon and words.

/** An error beside a field, in crimson with an icon (#43, rule 2: errors only beside fields). */
export function ErrorText(props: { id?: string; children: ReactNode }) {
  return (
    <span id={props.id} className="k-error-text">
      <Icon name="error" />
      <span>{props.children}</span>
    </span>
  );
}

export interface SummaryItem {
  /** The id of the control the problem is about. */
  field: string;
  message: string;
}

/**
 * The problems a failed save found, at the top of the form, each a link to its field. Takes
 * focus when it appears, so a screen reader reads it and a keyboard user starts from it (GOV.UK).
 */
export function ErrorSummary(props: {
  items: readonly SummaryItem[];
  general?: readonly string[];
  /** False only where the summary is a specimen, such as the catalog. */
  takeFocus?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const count = props.items.length + (props.general?.length ?? 0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: focus again for each new set of problems.
  useEffect(() => {
    if (props.takeFocus !== false) ref.current?.focus();
  }, [props.items, props.general]);
  if (count === 0) return null;
  return (
    <div ref={ref} className="k-error-summary" role="alert" tabIndex={-1}>
      <h2>
        <Icon name="error" />
        {summaryHeading(props.items.length, props.general?.length ?? 0)}
      </h2>
      <ul>
        {props.items.map((item) => (
          <li key={item.field}>
            <a href={`#${item.field}`}>{item.message}</a>
          </li>
        ))}
        {props.general?.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

/** "2 fields need fixing before this can be saved", or "problems" when some are not fields. */
function summaryHeading(fields: number, general: number): string {
  const count = fields + general;
  const noun =
    general > 0
      ? count === 1
        ? 'problem needs'
        : 'problems need'
      : count === 1
        ? 'field needs'
        : 'fields need';
  return `${count} ${noun} fixing before this can be saved`;
}

/** An empty structural input: a question, not an error (#43, rule 4). */
export function InputNeeded(props: { children?: ReactNode }) {
  return <span className="k-needed">{props.children ?? 'Input needed'}</span>;
}

/** A question for an experienced builder (#43, rule 3): amber, the flag icon, and its label. */
export function ExpertCheck(props: { label?: string; children: ReactNode; why?: ReactNode }) {
  return (
    <div className="k-flag">
      <Icon name="flag" />
      <div className="k-flag__body">
        <span className="k-flag__label">{props.label ?? 'Expert check'}</span>
        <span>{props.children}</span>
        {props.why && <span>Why: {props.why}</span>}
      </div>
    </div>
  );
}

/** A problem that is not about a field, such as a lost connection: what happened and what to do. */
export function Notice(props: { children: ReactNode; icon?: 'connection' | 'error' }) {
  return (
    <div className="k-notice" role="alert">
      <Icon name={props.icon ?? 'error'} />
      <span>{props.children}</span>
    </div>
  );
}

/** A line that says what just happened, such as "Saved.", and stays until the next action. */
export function StatusLine(props: { children: ReactNode }) {
  return (
    <p className="k-status" role="status">
      <Icon name="done" />
      <span>{props.children}</span>
    </p>
  );
}

/**
 * What state the numbers beside it are in, such as "Preview, not saved" (#56), so a preview is
 * never mistaken for the saved plan. Words in an outlined box; no meaning rests on color.
 */
export function StateTag(props: { children: ReactNode }) {
  return <span className="k-state-tag">{props.children}</span>;
}

/** Progress saved on this device and not yet sent (#57). */
export function Pending() {
  return (
    <span className="k-pending">
      <Icon name="pending" />
      On this phone, not yet sent
    </span>
  );
}

/** Loading text, shown only after a short delay so a fast load does not flash (#67). */
export function Loading(props: { children: ReactNode; delayMs?: number }) {
  const [shown, setShown] = useState(props.delayMs === 0);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), props.delayMs ?? 300);
    return () => clearTimeout(timer);
  }, [props.delayMs]);
  return (
    <p className="k-loading" role="status">
      {shown ? props.children : null}
    </p>
  );
}
