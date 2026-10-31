import { type ReactNode, useEffect, useId, useRef } from 'react';
import { Button } from './Button.tsx';

// A question that has to be answered before going on, such as leaving with unsaved changes
// (#67). Built on the native <dialog>, which traps focus and closes with Escape.

export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  children: ReactNode;
  /** The safe choice, focused first, such as "Keep editing". */
  stay: string;
  /** The choice that loses something, named for it, such as "Leave without saving". */
  leave: string;
  onStay: () => void;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (props.open && !dialog.open) dialog.showModal();
    if (!props.open && dialog.open) dialog.close();
  }, [props.open]);
  return (
    <dialog
      ref={ref}
      className="k-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        props.onStay();
      }}
    >
      <div className="l-stack">
        <h2 id={titleId}>{props.title}</h2>
        <div>{props.children}</div>
        <div className="l-cluster">
          <Button onClick={props.onStay}>{props.stay}</Button>
          <Button variant="destructive" onClick={props.onLeave}>
            {props.leave}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

/** Escape does not close it. */
export function BlockingDialog(props: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="k-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => e.preventDefault()}
    >
      <div className="l-stack">
        <h2 id={titleId}>{props.title}</h2>
        {props.children}
      </div>
    </dialog>
  );
}
