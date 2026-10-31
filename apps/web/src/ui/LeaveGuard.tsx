import { type SetStateAction, useEffect, useState } from 'react';
import { leaveGate } from '../lib/leave.ts';
import { sameJson } from '../lib/sameJson.ts';
import { ConfirmDialog } from './Dialog.tsx';

/**
 * Every form holds its values here, so it cannot have unsaved changes without the guard. Render
 * `dialog`. `holding: false` defers to a draft held inside this screen.
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
    // Capture phase, so the hash has not changed yet.
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
