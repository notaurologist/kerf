// The title bar and the mode bar stay at the top of the page as it scrolls, so an element
// scrolled to the top would sit under them. This scrolls it to just below whichever is showing.

/** Space left between the bar and the element, in CSS pixels. */
const GAP = 12;

/** Scrolls the page so the element's top sits just below the bar at the top of the page. */
export function scrollBelowBars(element: HTMLElement) {
  const bars = [...document.querySelectorAll<HTMLElement>('.k-titlebar, .k-modebar')].filter(
    (bar) => getComputedStyle(bar).position === 'sticky' && bar.getBoundingClientRect().height > 0,
  );
  const below = Math.max(0, ...bars.map((bar) => bar.getBoundingClientRect().bottom));
  window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - below - GAP });
}
