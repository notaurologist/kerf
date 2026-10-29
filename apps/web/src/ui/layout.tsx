import type { CSSProperties, ReactNode } from 'react';

// The layout primitives (#41) as components, so screens never write a class or a style. Gaps are
// steps of the spacing scale, never lengths.

export type Space = '3xs' | '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';
const space = (s: Space | undefined) => (s ? `var(--space-${s})` : undefined);

// The custom properties each primitive reads; setting them is the only style a primitive takes.
type Vars = Record<`--${string}`, string | undefined>;
const vars = (v: Vars) => v as CSSProperties;

export function Stack(props: { gap?: Space; as?: 'div' | 'section' | 'ul'; children: ReactNode }) {
  const Tag = props.as ?? 'div';
  return (
    <Tag className="l-stack" style={vars({ '--stack-gap': space(props.gap) })}>
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
  sideWidth?: string;
  gap?: Space;
  children: [ReactNode, ReactNode];
}) {
  return (
    <div
      className="l-sidebar"
      style={vars({ '--sidebar-width': props.sideWidth, '--sidebar-gap': space(props.gap) })}
    >
      {props.children}
    </div>
  );
}

/** Side by side, all switching to a column at once below `threshold` of container width. */
export function Switcher(props: { threshold?: string; gap?: Space; children: ReactNode }) {
  return (
    <div
      className="l-switcher"
      style={vars({ '--switcher-threshold': props.threshold, '--switcher-gap': space(props.gap) })}
    >
      {props.children}
    </div>
  );
}

/** As many columns of at least `min` as fit, such as a form's fields on a laptop. */
export function Grid(props: { min?: string; gap?: Space; children: ReactNode }) {
  return (
    <div
      className="l-grid"
      style={vars({ '--grid-min': props.min, '--grid-gap': space(props.gap) })}
    >
      {props.children}
    </div>
  );
}

export function Center(props: { max?: string; children: ReactNode }) {
  return (
    <div className="l-center" style={vars({ '--center-max': props.max })}>
      {props.children}
    </div>
  );
}

/** The page: side margins and content up to 1200 px (#41). */
export function Page(props: { children: ReactNode }) {
  return <main className="l-page">{props.children}</main>;
}

/** A raised panel for one item, such as a structural check or a checklist entry. */
export function Card(props: { as?: 'div' | 'section' | 'li'; children: ReactNode }) {
  const Tag = props.as ?? 'div';
  return <Tag className="k-card">{props.children}</Tag>;
}
