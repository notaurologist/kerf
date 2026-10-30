// In-page jumps. The hash picks the screen, so they scroll to an element instead of linking.

/** Scrolls to an element. */
export function show(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  });
}

/** The element ID of a part's cut detail, so a cutting step can open it (#58). */
export const cutDetailId = (partId: string) => `cut-detail-${partId}`;
