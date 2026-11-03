// Whether a screen change is playing as a move (lib/moves.ts). The skeleton reads it, so it lives
// in the design system and the app reports each move here.

/** How long the old screen holds while the new one loads, before the new one shows its skeleton. */
export const HOLD_MS = 300;

let active: ViewTransition | null = null;

/** True while a move is playing or holding the old screen. */
export function moving(): boolean {
  return active !== null;
}

/** Counts `transition` as the move playing until it finishes. */
export function playing(transition: ViewTransition) {
  active = transition;
  // A skipped transition rejects this; the update has run all the same.
  transition.finished
    .catch(() => {})
    .finally(() => {
      if (active === transition) active = null;
    });
}
