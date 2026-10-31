import { type SetStateAction, useEffect, useState } from 'react';
import { leaveGate } from '../lib/leave.ts';
import { sameJson } from '../lib/sameJson.ts';
import { ConfirmDialog } from './Dialog.tsx';

// Asks before leaving a screen with unsaved changes (#67): when a link to another route is
// followed, on Back and Forward, on Log out (all through `leaveGate`), and when the tab closes
// or reloads (the browser's own prompt).

/**
 * A form's values while they are edited, and whether they differ from `saved`. While they do,
 * leaving asks first, so a screen cannot hold unsaved changes without the guard. Render `dialog`.
 * `holding: false` lets go while another screen in this one holds its own draft.
 */
export function useDraft<T>(saved: T, options: { holding?: boolean } = {}) {
  const [draft, setDraft] = useState(saved);
  const dirty = !sameJson(draft, saved);
  const guard = useLeaveGuard(dirty && options.holding !== false);
  return {
    draft,
    setDraft: setDraft as (next: SetStateAction<T>) => void,
    dirty,
    ...guard,
  };
}

function useLeaveGuard(dirty: boolean) {
  const [pending, setPending] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const release = leaveGate.hold((go) => setPending(() => go));
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    // Capture clicks on route links before the hash changes, so the address and history stay
    // as they are while the owner decides.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const target = leavingFor(e.target as Element | null, window.location.hash);
      if (!target) return;
      e.preventDefault();
      leaveGate.confirm(() => leaveGate.pass(target));
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      release();
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title="Leave without saving?"
      stay="Keep editing"
      leave="Leave without saving"
      onStay={() => setPending(null)}
      onLeave={() => {
        const go = pending;
        setPending(null);
        go?.();
      }}
    >
      Your changes will be lost.
    </ConfirmDialog>
  );
  return { dialog };
}

/** Only route links (`#/…`) leave; links within the page, such as an error summary's, do not. */
export function leavingFor(
  clicked: Pick<Element, 'closest'> | null,
  currentHash: string,
): string | undefined {
  const target = clicked?.closest?.('a[href^="#/"]')?.getAttribute('href');
  return target && target !== currentHash ? target : undefined;
}
