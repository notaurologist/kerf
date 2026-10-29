import type { ReactNode } from 'react';

// Text that is not body text, without screens writing styles. Secondary text is for the desk
// screens only; the shop modes use the main text color for every word (#43, rule 5).

export function Text(props: {
  children: ReactNode;
  tone?: 'muted';
  size?: 'small';
  as?: 'p' | 'span';
}) {
  const Tag = props.as ?? 'p';
  return (
    <Tag className="k-text" data-tone={props.tone} data-size={props.size}>
      {props.children}
    </Tag>
  );
}

/** Read by screen readers, not shown: a label a sighted reader gets from the layout. */
export function VisuallyHidden(props: { children: ReactNode }) {
  return <span className="k-visually-hidden">{props.children}</span>;
}

/** A list without bullets, its items stacked with the given gap. */
export function PlainList(props: { children: ReactNode; ordered?: boolean; gap?: 'xs' | 's' }) {
  const Tag = props.ordered ? 'ol' : 'ul';
  return (
    <Tag className="k-plain-list" data-gap={props.gap ?? 's'}>
      {props.children}
    </Tag>
  );
}

/** A list with its bullets or numbers, as in running text. */
export function List(props: { children: ReactNode; ordered?: boolean }) {
  const Tag = props.ordered ? 'ol' : 'ul';
  return <Tag className="k-list">{props.children}</Tag>;
}

/** A formula or identifier, in the Mono, never wrapped (#42). */
export function Code(props: { children: ReactNode }) {
  return <code className="k-code">{props.children}</code>;
}
