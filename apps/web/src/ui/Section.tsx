import type { ReactNode } from 'react';
import { Text } from './text.tsx';

// A section of the plan (#40, section order A). On paper each starts a new page with a title
// block naming the project and the section (#41), so a loose page still says what it is.

export function PlanSection(props: {
  id: string;
  title: string;
  /** The project's name, for the printed title block. */
  project: string;
  /** A line under the heading saying how to read the section, such as what lengths measure. */
  intro?: ReactNode;
  children: ReactNode;
}) {
  const headingId = `${props.id}-heading`;
  return (
    <section id={props.id} className="k-section" aria-labelledby={headingId}>
      <p className="k-section__title-block" aria-hidden="true">
        <b>Kerf</b> · {props.project} · {props.title}
      </p>
      <h2 id={headingId}>{props.title}</h2>
      <div className="l-stack">
        {props.intro && <Text tone="muted">{props.intro}</Text>}
        {props.children}
      </div>
    </section>
  );
}
