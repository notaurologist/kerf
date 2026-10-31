import { useEffect, useState } from 'react';
import { ConfirmDialog } from './Dialog.tsx';

// Asks before leaving a screen with unsaved changes (#67): in the app, when any link on the page
// is followed, and when the tab closes or reloads (the browser's own prompt).

export function useLeaveGuard(dirty: boolean) {
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    // Capture clicks on in-app links before the hash changes and the screen goes away.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const target = leavingFor(e.target as Element | null, window.location.hash);
      if (!target) return;
      e.preventDefault();
      setPending(target);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  /** Leave for `target` now, or ask first when there are unsaved changes. */
  const leave = (target: string) => {
    if (dirty) setPending(target);
    else window.location.hash = target;
  };

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title="Leave without saving?"
      stay="Keep editing"
      leave="Leave without saving"
      onStay={() => setPending(null)}
      onLeave={() => {
        const target = pending;
        setPending(null);
        if (target) window.location.hash = target;
      }}
    >
      Your changes will be lost.
    </ConfirmDialog>
  );
  return { dialog, leave };
}

/**
 * The route a click would leave for, or undefined when it stays on this screen. Only route links
 * (`#/…`) leave: a link to an element on the page, such as an error summary's link to its field,
 * keeps the form.
 */
export function leavingFor(
  clicked: Pick<Element, 'closest'> | null,
  currentHash: string,
): string | undefined {
  const target = clicked?.closest?.('a[href^="#/"]')?.getAttribute('href');
  return target && target !== currentHash ? target : undefined;
}
