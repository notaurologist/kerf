import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon.tsx';

// What Kerf tells the reader about the state of things (#43, #67, #68). Every state has a second
// signal besides color: an icon and words.

/**
 * An error beside a field, in crimson with an icon (#43, rule 2: errors only beside fields).
 * `alert` announces it when it appears, as under an action that failed, so no screen writes the
 * live region itself.
 */
export function ErrorText(props: { id?: string; alert?: boolean; children: ReactNode }) {
  const text = (
    <span id={props.id} className="k-error-text">
      <Icon name="error" />
      <span>{props.children}</span>
    </span>
  );
  return props.alert ? <div role="alert">{text}</div> : text;
}

export interface SummaryItem {
  /** The id of the control the problem is about. */
  field: string;
  message: string;
}

/**
 * A form's problems and how many save attempts have found some. `report` records each attempt's
 * outcome; the attempt count goes up only when it found problems, which is when the summary takes
 * focus. Typing re-renders the form without changing the count, so focus stays in the field.
 */
export function useFormIssues<T>(none: T) {
  const [state, setState] = useState({ issues: none, attempt: 0 });
  const report = useCallback(
    (issues: T, found: boolean) => setState((s) => reported(s, issues, found)),
    [],
  );
  return { issues: state.issues, attempt: state.attempt, report };
}

export function reported<T>(
  state: { issues: T; attempt: number },
  issues: T,
  found: boolean,
): { issues: T; attempt: number } {
  return { issues, attempt: found ? state.attempt + 1 : state.attempt };
}

/**
 * The problems a failed save found, at the top of the form, each a link to its field. Takes
 * focus once for each save attempt that found problems, so a screen reader reads it and a
 * keyboard user starts from it (GOV.UK), and never while the owner is typing a fix.
 */
export function ErrorSummary(props: {
  items: readonly SummaryItem[];
  general?: readonly string[];
  /** From `useFormIssues`. 0, as for a specimen in the catalog, never takes focus. */
  attempt: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const count = props.items.length + (props.general?.length ?? 0);
  useEffect(() => {
    if (props.attempt > 0) ref.current?.focus();
  }, [props.attempt]);
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
            <a href={`#${item.field}`} onClick={(e) => goToField(item.field, e, document)}>
              {item.message}
            </a>
          </li>
        ))}
        {props.general?.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Follows a summary link (#161): focuses its field and scrolls it into view. Screens are chosen
 * from the URL hash, so the link's own `#field` would replace the route and lose the form. The
 * href stays for what it says: where the link goes.
 */
export function goToField(
  field: string,
  event: { preventDefault: () => void },
  doc: { getElementById: (id: string) => Pick<HTMLElement, 'focus' | 'scrollIntoView'> | null },
) {
  event.preventDefault();
  const target = doc.getElementById(field);
  if (!target) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'center' });
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
        <div>{props.children}</div>
        {props.why && <div>Why: {props.why}</div>}
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

/** Why a request did not go through, and whether it was the connection. */
export interface Failure {
  message: string;
  /** True when Kerf could not reach the server at all. */
  connection: boolean;
}

/**
 * A save that did not go through (docs/design/content.md, Connection and server problems): what
 * happened, from Kerf's side, and what is kept. The connection icon when the server could not be
 * reached. A preview says the same with its own words (`title`, `kept`).
 */
export function SaveFailed(props: { failure: Failure; title?: string; kept?: string }) {
  return (
    <Notice icon={props.failure.connection ? 'connection' : 'error'}>
      <b>{props.title ?? 'Not saved.'}</b> {props.failure.message}{' '}
      {props.kept ?? 'Your changes are still here.'}
    </Notice>
  );
}

/**
 * Something to know about the plan that is neither a problem nor an expert check, such as a plan
 * made with a newer template version. Announced politely, never as an alert; the info icon and the
 * words carry it, not color.
 */
export function InfoNotice(props: { children: ReactNode }) {
  return (
    <div className="k-info" role="status">
      <Icon name="info" />
      <div className="k-info__body">{props.children}</div>
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
