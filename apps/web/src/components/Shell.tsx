import type { ReactNode } from 'react';
import { href, type Route } from '../lib/route.ts';

export function Shell(props: { route: Route; onLogout: () => void; children: ReactNode }) {
  const section = props.route.screen === 'tools' ? 'tools' : 'projects';
  return (
    <>
      <header className="shell">
        <a className="brand" href={href({ screen: 'projects' })}>
          Kerf
        </a>
        <nav>
          <a
            href={href({ screen: 'projects' })}
            aria-current={section === 'projects' ? 'page' : undefined}
          >
            Projects
          </a>
          <a
            href={href({ screen: 'tools' })}
            aria-current={section === 'tools' ? 'page' : undefined}
          >
            Tools
          </a>
          <button type="button" className="link" onClick={props.onLogout}>
            Log out
          </button>
        </nav>
      </header>
      <main className="page">{props.children}</main>
    </>
  );
}

/** One line for loading, errors, and empty states, so every screen says them the same way. */
export function Notice(props: { children: ReactNode; tone?: 'error' | 'plain' }) {
  return (
    <p
      className={props.tone === 'error' ? 'error' : 'muted'}
      role={props.tone === 'error' ? 'alert' : undefined}
    >
      {props.children}
    </p>
  );
}
