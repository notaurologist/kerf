import { useEffect, useRef } from 'react';
import type { Route } from './route.ts';

// A new screen opens like a new page: at its top, with focus on its heading so a screen reader
// announces it, and the document title naming it. Moves between the plan's sections stay on one
// screen and move focus themselves (`usePlanMoves`).

let heading: HTMLElement | null = null;
let arriving = false;

/** The screen a route shows, leaving out the place within it: the plan's section and part. */
export function screenKey(route: Route): string {
  const {
    section: _section,
    part: _part,
    from: _from,
    ...screen
  } = route as Route & {
    section?: unknown;
    part?: unknown;
    from?: unknown;
  };
  return JSON.stringify(screen);
}

/** In App: scrolls to the top and focuses the new screen's heading when the screen changes. */
export function useScreenChange(route: Route) {
  const key = screenKey(route);
  const previous = useRef(key);
  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    window.scrollTo(0, 0);
    // A screen that is still loading has no heading yet; it takes focus when it arrives.
    if (heading) heading.focus({ preventScroll: true });
    else arriving = true;
  }, [key]);
}

/** For a screen's h1: takes focus when the screen was just changed to, and names the document. */
export function useScreenHeading(title: string) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    heading = element;
    if (arriving) {
      arriving = false;
      element.focus({ preventScroll: true });
    }
    return () => {
      if (heading === element) heading = null;
    };
  }, []);
  useEffect(() => {
    document.title = `${title} · Kerf`;
    return () => {
      document.title = 'Kerf';
    };
  }, [title]);
  return ref;
}
