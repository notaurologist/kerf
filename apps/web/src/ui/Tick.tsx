import type { ReactNode } from 'react';
import { Pending } from './feedback.tsx';

/**
 * Marks one item done in Shopping or Building (#57, #61), or a tool owned: a native checkbox, so
 * its state is a shape and its name is the label, at least the control height. A tick not saved
 * yet says so with `Pending` beside the label, and in the checkbox's name.
 */
export function Tick(props: {
  done: boolean;
  /** The checkbox's id, so an error summary can link to it. */
  id?: string;
  /** A change waiting to reach the server. */
  waiting?: boolean;
  onChange: (done: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="k-tick" data-done={props.done || undefined}>
      <input
        type="checkbox"
        id={props.id}
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
