import type { ReactNode } from 'react';

// A row of figures at the top of the plan (#119; information architecture, revised laptop plan):
// each a label over its value, as many to a row as fit. Values are core's text (hard rule 1).

export interface Figure {
  label: string;
  value: ReactNode;
  /** A line under the value, such as which check a margin comes from. */
  detail?: ReactNode;
  /** A value in words, such as a margin, takes a whole row. */
  wide?: boolean;
}

export function Figures(props: { items: readonly Figure[] }) {
  return (
    <dl className="k-figures">
      {props.items.map((item) => (
        <div key={item.label} className="k-figure" data-wide={item.wide || undefined}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          {item.detail && <dd className="k-figure__detail">{item.detail}</dd>}
        </div>
      ))}
    </dl>
  );
}
