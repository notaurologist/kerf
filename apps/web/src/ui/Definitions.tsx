import type { ReactNode } from 'react';

// Terms with their definitions, such as the glossary. Each term is a `dfn`, and each entry has its
// own id so a link can bring it into view; it takes focus there (tabIndex -1).

export interface Definition {
  /** The entry's element id. */
  id: string;
  term: string;
  definition: ReactNode;
  /** A drawing that explains the term, under the definition, kept to a readable width. */
  figure?: ReactNode;
  /** Under the definition, such as its source. */
  detail?: ReactNode;
}

export function Definitions(props: { items: readonly Definition[] }) {
  return (
    <dl className="k-definitions">
      {props.items.map((item) => (
        <div key={item.id} id={item.id} className="k-definition" tabIndex={-1}>
          <dt>
            <dfn>{item.term}</dfn>
          </dt>
          <dd>{item.definition}</dd>
          {item.figure && <dd className="k-definition__figure">{item.figure}</dd>}
          {item.detail && <dd>{item.detail}</dd>}
        </div>
      ))}
    </dl>
  );
}
