import type { ReactNode } from 'react';
import { Text } from './text.tsx';

// A section of the plan (#40, section order A). On paper each starts a new page with a title
// block naming the project and the section (#41), so a loose page still says what it is. On
// screen each is its own screen (#156): the others stay in the page, hidden, so print still
// gives the whole plan from any of them.

export function PlanSection(props: {
  id: string;
  title: string;
  /** The project's name, for the printed title block. */
  project: string;
  /** False for the section that opens the plan: on paper it shares the first page (#119). */
  newPage?: boolean;
  /** A line under the heading saying how to read the section, such as what lengths measure. */
  intro?: ReactNode;
  /** Not the section on screen: hidden on screen, printed with the rest. */
  hidden?: boolean;
  children: ReactNode;
}) {
  const headingId = `${props.id}-heading`;
  return (
    <section
      id={props.id}
      className="k-section"
      aria-labelledby={headingId}
      data-page={props.newPage === false ? 'same' : undefined}
      hidden={props.hidden}
    >
      <p className="k-section__title-block" aria-hidden="true">
        <b>Kerf</b> · {props.project} · {props.title}
      </p>
      {/* Focusable, so a move to the section can put focus on it (#119, #156). */}
      <h2 id={headingId} tabIndex={-1}>
        {props.title}
      </h2>
      <div className="l-stack">
        {props.intro && <Text tone="muted">{props.intro}</Text>}
        {props.children}
      </div>
    </section>
  );
}
