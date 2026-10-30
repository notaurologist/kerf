import { useEffect, useRef } from 'react';

// Focus when moving between the plan's sections (#156). Each section is its own screen, so after
// a move focus goes to the new section's heading, as a new page would start at its top. A link
// can ask for a place further in (`arriveAt`), such as the expert checks. Back after following a
// link inside a section returns focus to that link, so you are where you were.

let arrival: string | null = null;

/** On the next move, focus the element with this id instead of the section's heading. */
export function arriveAt(id: string) {
  arrival = id;
}

/** Moves focus when `section` changes, not when the screen first opens. */
export function usePlanMoves(section: string, focusId: string) {
  const previous = useRef(section);
  // The last link followed from inside a section, and the address it was followed from.
  const followed = useRef<{ link: HTMLElement; hash: string } | null>(null);
  const returnTo = useRef<{ link: HTMLElement; hash: string } | null>(null);

  useEffect(() => {
    const click = (e: MouseEvent) => {
      const link = e.target instanceof Element ? e.target.closest('a') : null;
      followed.current =
        link?.closest('section') != null ? { link, hash: window.location.hash } : null;
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, []);

  useEffect(() => {
    if (previous.current === section) return;
    previous.current = section;
    const back = returnTo.current;
    returnTo.current = followed.current;
    followed.current = null;
    const asked = arrival;
    arrival = null;
    if (back && back.hash === window.location.hash && back.link.isConnected) {
      back.link.focus();
      return;
    }
    const target = document.getElementById(asked ?? focusId);
    if (!target) return;
    if (target.id === `${section}-heading`) {
      // A new screen starts at its top, with the header above the heading in view.
      window.scrollTo(0, 0);
      target.focus({ preventScroll: true });
    } else {
      // A heading further in leads what follows it; anything else, such as a row, is centered
      // so what is around it shows too.
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: /^H[1-6]$/.test(target.tagName) ? 'start' : 'center' });
    }
  }, [section, focusId]);
}
