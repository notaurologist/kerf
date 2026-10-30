import type { ReactNode } from 'react';
import { Pending } from './feedback.tsx';

/**
 * Marks one item done in Shopping or Building (#57, #61): a native checkbox, so its state is a
 * shape and its name is the label, at least the control height. A tick not saved yet says so
 * with `Pending` beside the label, and in the checkbox's name.
 */
export function Tick(props: {
  done: boolean;
  /** A change waiting to reach the server. */
  waiting?: boolean;
  onChange: (done: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="k-tick" data-done={props.done || undefined}>
      <input
        type="checkbox"
        checked={props.done}
        onChange={(e) => props.onChange(e.currentTarget.checked)}
      />
      <span className="k-tick__label">
        <span>{props.children}</span>
        {props.waiting && <Pending />}
      </span>
    </label>
  );
}
