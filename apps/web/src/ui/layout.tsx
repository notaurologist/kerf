import type { CSSProperties, ReactNode } from 'react';

// The layout primitives (#41) as components, so screens never write a class or a style. Gaps are
// steps of the spacing scale and widths steps of the width scale, never lengths.

export type Space = '3xs' | '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';
const space = (s: Space | undefined) => (s ? `var(--space-${s})` : undefined);

export type Width = 'xs' | 's' | 'm' | 'l' | 'xl' | '2xl';
const width = (w: Width | undefined) => (w ? `var(--width-${w})` : undefined);

// The custom properties each primitive reads; setting them is the only style a primitive takes.
type Vars = Record<`--${string}`, string | undefined>;
const vars = (v: Vars) => v as CSSProperties;

export function Stack(props: {
  gap?: Space;
  as?: 'div' | 'section' | 'ul' | 'header';
  id?: string;
  children: ReactNode;
}) {
  const Tag = props.as ?? 'div';
  return (
    <Tag id={props.id} className="l-stack" style={vars({ '--stack-gap': space(props.gap) })}>
      {props.children}
    </Tag>
  );
}

/** Children in a row that wraps. `spread` pushes them to either end, such as a name and a menu. */
export function Cluster(props: { gap?: Space; spread?: boolean; children: ReactNode }) {
  return (
    <div
      className="l-cluster"
      style={vars({
        '--cluster-gap': space(props.gap),
        '--cluster-justify': props.spread ? 'space-between' : undefined,
      })}
    >
      {props.children}
    </div>
  );
}

/** A narrow side (first child) beside a wide main (second child), stacking when space runs out. */
export function Sidebar(props: {
  sideWidth?: Width;
  gap?: Space;
  children: [ReactNode, ReactNode];
}) {
  return (
    <div
      className="l-sidebar"
      style={vars({ '--sidebar-width': width(props.sideWidth), '--sidebar-gap': space(props.gap) })}
    >
      {props.children}
    </div>
  );
}

/**
 * A main column with an aside beside it that stays in view as the page scrolls, from 60rem of
 * width, such as a form and its preview. The aside's `head`, such as the form's actions, stays
 * at its top while the rest of the aside scrolls. Narrower, the aside follows the main column,
 * and `lead`, such as a short summary of the aside, comes before both, since the aside is then
 * out of sight.
 */
export function WithAside(props: {
  head?: ReactNode;
  lead?: ReactNode;
  children: [ReactNode, ReactNode];
}) {
  return (
    <div className="l-with-aside">
      {props.lead && <div className="l-with-aside__lead">{props.lead}</div>}
      <div>
        <div>{props.children[0]}</div>
        <div>
          {props.head && <div className="l-with-aside__head">{props.head}</div>}
          {props.children[1]}
        </div>
      </div>
    </div>
  );
}

/** Side by side, all switching to a column at once below `threshold` of container width. */
export function Switcher(props: { threshold?: Width; gap?: Space; children: ReactNode }) {
  return (
    <div
      className="l-switcher"
      style={vars({
        '--switcher-threshold': width(props.threshold),
        '--switcher-gap': space(props.gap),
      })}
    >
      {props.children}
    </div>
  );
}

/** As many columns of at least `min` as fit, such as a form's fields on a laptop. */
export function Grid(props: { min?: Width; gap?: Space; children: ReactNode }) {
  return (
    <div
      className="l-grid"
      style={vars({ '--grid-min': width(props.min), '--grid-gap': space(props.gap) })}
    >
      {props.children}
    </div>
  );
}

export function Center(props: { max?: Width; children: ReactNode }) {
  return (
    <div className="l-center" style={vars({ '--center-max': width(props.max) })}>
      {props.children}
    </div>
  );
}

/** The page: side margins and content up to 1200 px (#41). */
export function Page(props: { children: ReactNode }) {
  return <main className="l-page">{props.children}</main>;
}

/**
 * Like things as ruled rows (Stage 10): a rule in the text color above the group and a hairline
 * under each row, with no boxes, so the rows read as one list.
 */
export function Rows(props: {
  as?: 'div' | 'ul';
  /** In the printed shop set a row may run onto the next page, its list items each kept whole. */
  splitInShopSet?: boolean;
  children: ReactNode;
}) {
  const Tag = props.as ?? 'div';
  return (
    <Tag className="k-rows" data-shop-set-split={props.splitInShopSet || undefined}>
      {props.children}
    </Tag>
  );
}

/** One of `Rows`. A way into a shop mode passes `mode` for a bar in that mode's color. */
export function Row(props: {
  as?: 'div' | 'section' | 'li';
  mode?: 'shopping' | 'building';
  children: ReactNode;
}) {
  const Tag = props.as ?? 'div';
  return (
    <Tag className="k-row" data-mode={props.mode}>
      {props.children}
    </Tag>
  );
}

/** A panel for one thing that differs in kind from what is around it, such as the Resume card. */
export function Card(props: {
  as?: 'div' | 'section' | 'li';
  /** A way into a shop mode, marked in that mode's color (Stage 10). */
  mode?: 'shopping' | 'building';
  children: ReactNode;
}) {
  const Tag = props.as ?? 'div';
  return (
    <Tag className="k-card" data-mode={props.mode}>
      {props.children}
    </Tag>
  );
}
