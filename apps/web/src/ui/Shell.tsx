import type { ReactNode } from 'react';

// The frame around every screen (#40): a header with Projects and Tools on planning screens, and
// a bar with the mode's name and Exit in Shopping and Building (M7, #61).

export interface NavItem {
  label: string;
  href: string;
  current?: boolean;
}

export function Header(props: { brandHref: string; nav: readonly NavItem[]; end?: ReactNode }) {
  return (
    <header className="k-header">
      <a className="k-header__brand" href={props.brandHref}>
        Kerf
      </a>
      <nav aria-label="Main">
        {props.nav.map((item) => (
          <a key={item.href} href={item.href} aria-current={item.current ? 'page' : undefined}>
            {item.label}
          </a>
        ))}
        {props.end}
      </nav>
    </header>
  );
}

/**
 * Shop modes fill the screen under this bar (#40): the mode's name, what it is working on (the
 * project's name), and a way out.
 */
export function ModeBar(props: { mode: string; context?: string; exitHref: string }) {
  return (
    <div className="k-modebar" data-density="shop">
      <span>
        <b>{props.mode}</b>
        {props.context && ` · ${props.context}`}
      </span>
      <a className="k-button" data-variant="secondary" href={props.exitHref}>
        Exit
      </a>
    </div>
  );
}

/**
 * A shop mode's whole screen (#61): the mode bar and, below it, the mode's content in shop
 * density. It has no other navigation, so the mode is signalled twice (NN/g, modes).
 */
export function ModeFrame(props: {
  mode: string;
  context?: string;
  exitHref: string;
  children: ReactNode;
}) {
  return (
    <>
      <ModeBar mode={props.mode} context={props.context} exitHref={props.exitHref} />
      <main className="l-page" data-density="shop">
        {props.children}
      </main>
    </>
  );
}
