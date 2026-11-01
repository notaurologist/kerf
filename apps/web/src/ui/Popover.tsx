import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon.tsx';

/**
 * A non-modal popover="auto": its id for the button's `popoverTarget`, a ref for the popover, and
 * whether it is open, for the button's `aria-expanded`, which the browser does not set by itself.
 * It closes with Escape or a tap elsewhere.
 */
export function usePopover() {
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const toggle = (e: Event) => setOpen((e as ToggleEvent).newState === 'open');
    element.addEventListener('toggle', toggle);
    return () => element.removeEventListener('toggle', toggle);
  }, []);
  return { id, ref, open };
}

/** Details kept off the page until asked for: an info button that opens them in a popover. */
export function InfoTip(props: { label: string; children: ReactNode }) {
  const popover = usePopover();
  return (
    <span className="k-info">
      <button
        type="button"
        className="k-info__button"
        popoverTarget={popover.id}
        aria-expanded={popover.open}
        title={props.label}
      >
        <Icon name="info" />
        <span className="k-visually-hidden">{props.label}</span>
      </button>
      <span ref={popover.ref} id={popover.id} popover="auto" className="k-popover">
        {props.children}
      </span>
    </span>
  );
}
