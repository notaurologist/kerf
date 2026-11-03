import { useEffect, useRef } from 'react';

// A new screen opens like a new page, with focus on its heading so a screen reader announces it,
// and the document title naming it. The app says when the screen changes (`focusNewScreen`, from
// lib/screenChange.ts); the heading is here, so the design system needs nothing from the app.

let heading: HTMLElement | null = null;
let arriving = false;

/** Focuses the screen's heading, or the next one to arrive while the screen is still loading. */
export function focusNewScreen() {
  if (heading) heading.focus({ preventScroll: true });
  else arriving = true;
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
