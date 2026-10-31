import { type ReactNode, useId, useState } from 'react';
import { Icon } from './Icon.tsx';
import { Sidebar } from './layout.tsx';

// The plan's contents (#40, section order A; #119), one section per screen (#147, #156): beside
// the plan on a tablet or laptop with the current section marked, staying in view; on a phone a
// bar naming where you are ("3 of 8 · Structural review") that opens the list in place. Which it
// is depends on the width the plan is given (#41, container queries), not the page's.

export interface ContentsItem {
  /** The section's id; its heading is `${id}-heading`, as `PlanSection` writes it. */
  id: string;
  title: string;
  /** The section's own address. */
  href: string;
}

/** The contents beside (or above) the sections they list. `current` is the section on screen. */
export function WithContents(props: {
  items: readonly ContentsItem[];
  current: string;
  children: ReactNode;
}) {
  const headingId = useId();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const at = props.items.findIndex((item) => item.id === props.current);
  const here = props.items[at];
  return (
    <div className="k-with-contents">
      <Sidebar sideWidth="xs" gap="l">
        <nav className="k-contents" aria-labelledby={headingId} data-open={open || undefined}>
          {/* Shown only when the plan is narrow, where it opens and closes the list. */}
          <button
            type="button"
            className="k-contents__bar"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="k-contents__where">
              {here && (
                <>
                  <span>
                    {at + 1} of {props.items.length}
                  </span>{' '}
                  · <b>{here.title}</b>
                </>
              )}
            </span>
            <span className="k-contents__toggle">
              {open ? 'Close' : 'Contents'}
              <span className="k-contents__chevron">
                <Icon name="chevron" />
              </span>
            </span>
          </button>
          <h2 id={headingId} className="k-contents__heading">
            Contents
          </h2>
          <ol id={listId}>
            {props.items.map((item) => (
              <li key={item.id}>
                <a
                  href={item.href}
                  aria-current={item.id === props.current ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="l-stack">{props.children}</div>
      </Sidebar>
    </div>
  );
}

/**
 * Previous and Next at the end of a section, each naming the section it goes to, as GOV.UK's
 * pagination block does for multi-part guides. Stacked when narrow. Not printed.
 */
export function SectionPager(props: {
  previous?: { title: string; href: string };
  next?: { title: string; href: string };
}) {
  if (!props.previous && !props.next) return null;
  return (
    <nav className="k-pager" aria-label="Plan sections">
      <ul>
        {props.previous && (
          <li data-dir="previous">
            <a className="k-pager__link" href={props.previous.href} rel="prev">
              <span className="k-pager__dir">
                <span className="k-pager__arrow">
                  <Icon name="chevron" />
                </span>{' '}
                Previous
              </span>
              <span className="k-pager__title">{props.previous.title}</span>
            </a>
          </li>
        )}
        {props.next && (
          <li data-dir="next">
            <a className="k-pager__link" href={props.next.href} rel="next">
              <span className="k-pager__dir">
                Next{' '}
                <span className="k-pager__arrow">
                  <Icon name="chevron" />
                </span>
              </span>
              <span className="k-pager__title">{props.next.title}</span>
            </a>
          </li>
        )}
      </ul>
    </nav>
  );
}

/** Each section of the plan with a line saying what is in it, linking to it: the summary's list (#156). */
export function SectionList(props: {
  items: readonly { id: string; title: string; href: string; digest: string }[];
}) {
  return (
    <ul className="k-section-list">
      {props.items.map((item) => (
        <li key={item.id}>
          <a href={item.href}>{item.title}</a>
          <span className="k-section-list__digest">{item.digest}</span>
        </li>
      ))}
    </ul>
  );
}
