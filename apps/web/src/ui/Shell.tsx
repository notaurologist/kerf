import type { ReactNode } from 'react';
import { Wordmark } from './Wordmark.tsx';

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
        <Wordmark />
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
 * project's name), and a way out. `end` sits before Exit, as the theme menu does (#155).
 */
export function ModeBar(props: {
  mode: string;
  context?: string;
  exitHref: string;
  end?: ReactNode;
}) {
  return (
    <div className="k-modebar" data-density="shop">
      <span>
        <b>{props.mode}</b>
        {props.context && ` · ${props.context}`}
      </span>
      <span className="k-modebar__end">
        {props.end}
        <a className="k-button" data-variant="secondary" href={props.exitHref}>
          Exit
        </a>
      </span>
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
  end?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <ModeBar
        mode={props.mode}
        context={props.context}
        exitHref={props.exitHref}
        end={props.end}
      />
      <main className="l-page" data-density="shop">
        {props.children}
      </main>
    </>
  );
}
