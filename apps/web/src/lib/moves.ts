import { flushSync } from 'react-dom';
import { isMode, type Route, type RouteChange } from './route.ts';
import { screenKey } from './screenChange.ts';
import { PLAN_SECTIONS } from './sections.ts';

// Stage 9's moves and waiting (#266). A screen change plays as a view transition typed by its
// direction (`moveFor`), styled in components.css; the frame around the screen stays still. While
// the transition captures the new screen, the old one stays on screen for up to HOLD_MS until the
// new screen's data has arrived, so a usual load (0.12 s, decision 0006) moves in complete. Under
// reduced motion, or without view transitions, screens change at once.

export type Move = 'forward' | 'back' | 'place' | 'mode-in' | 'mode-out' | 'none';

/** How long the old screen holds while the new one loads, before the new one shows its skeleton. */
export const HOLD_MS = 300;

const place = (route: Route) =>
  route.screen === 'tools' || route.screen === 'glossary' ? route.screen : 'projects';

/** How far down its place a screen is: the place itself, a screen in it, the editor. */
function depth(route: Route): number {
  switch (route.screen) {
    case 'projects':
      return 0;
    case 'tools':
      return route.tool ? 1 : 0;
    case 'glossary':
      return route.term ? 1 : 0;
    case 'edit-project':
      return 2;
    default:
      return 1;
  }
}

const sectionIndex = (section: string | undefined) =>
  Math.max(
    0,
    PLAN_SECTIONS.findIndex((s) => s.id === section),
  );

/** The move from one screen to the next: by place, then depth, then the plan's section order. */
export function moveFor(from: Route, to: Route): Move {
  if (isMode(from) !== isMode(to)) return isMode(to) ? 'mode-in' : 'mode-out';
  if (isMode(to)) return 'none';
  if (place(from) !== place(to)) return 'place';
  const down = depth(to) - depth(from);
  if (down !== 0) return down > 0 ? 'forward' : 'back';
  if (from.screen === 'project' && to.screen === 'project' && from.id === to.id) {
    const step = sectionIndex(to.section) - sectionIndex(from.section);
    return step === 0 ? 'none' : step > 0 ? 'forward' : 'back';
  }
  return screenKey(from) === screenKey(to) ? 'none' : 'forward';
}

// Screens still loading their first value, counted by `useLoad`.
let loading = 0;
let waiting: (() => void)[] = [];

/** For `useLoad`: counts a screen as loading until the returned function is called. */
export function startLoading(): () => void {
  loading++;
  return () => {
    loading--;
    if (loading > 0) return;
    for (const done of waiting.splice(0)) done();
  };
}

/** Resolves once nothing is loading, or after `ms`. */
function loadedOrAfter(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (loading === 0) return resolve();
    const done = () => {
      clearTimeout(timer);
      waiting = waiting.filter((d) => d !== done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    waiting.push(done);
  });
}

let active: ViewTransition | null = null;

/** True while a move is playing or holding the old screen. */
export function moving(): boolean {
  return active !== null;
}

const animates = () =>
  typeof document.startViewTransition === 'function' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A page that renders no frames never starts a transition's update; skipping still runs it. */
const STALL_MS = 1000;

function play(type: Move | 'arrive', update: () => void, hold: boolean) {
  let stall: ReturnType<typeof setTimeout> | undefined;
  const transition = document.startViewTransition({
    update: async () => {
      clearTimeout(stall);
      flushSync(update);
      if (hold) await loadedOrAfter(HOLD_MS);
    },
    types: [type],
  });
  stall = setTimeout(() => transition.skipTransition(), STALL_MS);
  active = transition;
  // A skipped transition rejects these; the update has run all the same.
  transition.ready.catch(() => {});
  transition.finished
    .catch(() => {})
    .finally(() => {
      if (active === transition) active = null;
    });
}

/** For `useRoute`: plays each screen change as its move. */
export const changeScreen: RouteChange = (from, to, update) => {
  const move = moveFor(from, to);
  if (move === 'none' || !animates()) update();
  else play(move, update, true);
};

/** Shows a screen's data in place of its skeleton: a crossfade, unless a move is under way. */
export function arrive(update: () => void) {
  if (moving() || !animates()) update();
  else play('arrive', update, false);
}
