import { type ReactNode, useId } from 'react';
import { Button } from './Button.tsx';
import { Sidebar } from './layout.tsx';

// The plan's contents (#40, section order A; #119): beside the plan on a tablet or laptop,
// staying in view while the plan scrolls, and a list at the top on a phone. Which it is depends on
// the width the plan is given (#41, container queries), not the page's.

export interface ContentsItem {
  /** The section's id; its heading is `${id}-heading`, as `PlanSection` writes it. */
  id: string;
  title: string;
}

/** Moves focus to a section's heading, scrolling it into view. The hash picks the screen, so in-page links cannot use it. */
export function goToSection(id: string) {
  const heading = document.getElementById(`${id}-heading`);
  if (!heading) return;
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  });
}

/** The contents beside (or above) the sections they list. */
export function WithContents(props: { items: readonly ContentsItem[]; children: ReactNode }) {
  const headingId = useId();
  return (
    <div className="k-with-contents">
      <Sidebar sideWidth="12rem" gap="l">
        <nav className="k-contents" aria-labelledby={headingId}>
          <h2 id={headingId} className="k-contents__heading">
            Contents
          </h2>
          <ol>
            {props.items.map((item) => (
              <li key={item.id}>
                <Button variant="link" onClick={() => goToSection(item.id)}>
                  {item.title}
                </Button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="l-stack">{props.children}</div>
      </Sidebar>
    </div>
  );
}
