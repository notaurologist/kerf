import type { ReactNode } from 'react';
import { Measured } from './numbers.tsx';

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

interface ListProps {
  children?: ReactNode;
  /** Sentences from core, each an item with its lengths kept on one line (`Measured`). */
  items?: readonly string[];
  ordered?: boolean;
  /** Mark the first use of each glossary term in `items` (`Term`). */
  terms?: boolean;
}

/** Core's sentences as list items, before any other children. */
function Items(props: { items?: readonly string[]; terms?: boolean }) {
  return props.items?.map((text) => (
    <li key={text}>
      <Measured text={text} terms={props.terms} />
    </li>
  ));
}

/** A list without bullets, its items stacked with the given gap. */
export function PlainList(props: ListProps & { gap?: 'xs' | 's' }) {
  const Tag = props.ordered ? 'ol' : 'ul';
  return (
    <Tag className="k-plain-list" data-gap={props.gap ?? 's'}>
      <Items items={props.items} terms={props.terms} />
      {props.children}
    </Tag>
  );
}

/** A list with its bullets or numbers, as in running text. */
export function List(props: ListProps) {
  const Tag = props.ordered ? 'ol' : 'ul';
  return (
    <Tag className="k-list">
      <Items items={props.items} terms={props.terms} />
      {props.children}
    </Tag>
  );
}

/** Text kept to one line, cut short with an ellipsis, such as a summary of what a section holds in full. */
export function OneLine(props: { children: ReactNode }) {
  return <span className="k-one-line">{props.children}</span>;
}

/** A formula or identifier, in the Mono, never wrapped (#42). */
export function Code(props: { children: ReactNode }) {
  return <code className="k-code">{props.children}</code>;
}
