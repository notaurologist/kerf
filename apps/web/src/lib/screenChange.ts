import { useEffect, useRef } from 'react';
import { focusNewScreen } from '../ui/screenFocus.ts';
import type { Route } from './route.ts';

// A new screen opens like a new page: at its top, with focus on its heading (ui/screenFocus.ts).
// Moves between the plan's sections stay on one screen and move focus themselves
// (`usePlanMoves`).

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
    focusNewScreen();
  }, [key]);
}
