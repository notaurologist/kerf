import { useEffect } from 'react';

// Left and Right go to the previous and next of the plan's sections, or of Building's steps
// (Stage 9, K1, #267). Only outside fields, controls that use the arrows, and dialogs, and never
// with a modifier held, so typing and the browser's own shortcuts keep working. No single-letter
// shortcuts (WCAG 2.1.4).

const USES_ARROWS =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), dialog, [role="dialog"], [role="radiogroup"], [role="slider"], [role="tablist"], [role="listbox"], [role="menu"]';

/** Where an arrow key goes from this key event, if anywhere. */
export function arrowTarget(
  event: Pick<
    KeyboardEvent,
    | 'key'
    | 'altKey'
    | 'ctrlKey'
    | 'metaKey'
    | 'shiftKey'
    | 'isComposing'
    | 'defaultPrevented'
    | 'target'
  >,
  targets: { previous?: string; next?: string },
): string | undefined {
  const to =
    event.key === 'ArrowLeft'
      ? targets.previous
      : event.key === 'ArrowRight'
        ? targets.next
        : undefined;
  if (!to) return undefined;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return undefined;
  if (event.isComposing || event.defaultPrevented) return undefined;
  if (event.target instanceof Element && event.target.closest(USES_ARROWS)) return undefined;
  return to;
}

/** While the screen is open, Left and Right go to `previous` and `next`, addresses such as `#/…`. */
export function useArrowKeys(targets: { previous?: string; next?: string }) {
  const { previous, next } = targets;
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const to = arrowTarget(event, { previous, next });
      if (!to) return;
      event.preventDefault();
      window.location.hash = to;
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [previous, next]);
}
