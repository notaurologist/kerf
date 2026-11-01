import type { MouseEvent, ReactNode, Ref } from 'react';
import { Icon, type IconName } from './Icon.tsx';

// Buttons say what they do: a verb and the thing it acts on (docs/design/content.md).

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'link';

export function Button(props: {
  children: ReactNode;
  variant?: ButtonVariant;
  type?: 'button' | 'submit';
  /** While true, the button shows `busyLabel` and ignores presses. */
  busy?: boolean;
  /** What the button says while busy, such as "Saving…" (docs/design/content.md, Status). */
  busyLabel?: string;
  /** For a toggle, such as selecting a part: whether it is on. */
  pressed?: boolean;
  onClick?: () => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  const click = (e: MouseEvent) => {
    if (props.busy) {
      e.preventDefault();
      return;
    }
    props.onClick?.();
  };
  return (
    <button
      ref={props.ref}
      type={props.type ?? 'button'}
      className="k-button"
      data-variant={props.variant ?? 'primary'}
      aria-disabled={props.busy ? true : undefined}
      aria-pressed={props.pressed}
      onClick={click}
    >
      {props.busy && props.busyLabel ? props.busyLabel : props.children}
    </button>
  );
}

/** A link that looks like a button, for actions that go to another screen. */
export function ButtonLink(props: {
  children: ReactNode;
  href: string;
  variant?: ButtonVariant;
  /** The key that does the same, for assistive technology, such as `ArrowLeft`. */
  keyshortcuts?: string;
}) {
  return (
    <a
      className="k-button"
      data-variant={props.variant ?? 'primary'}
      href={props.href}
      aria-keyshortcuts={props.keyshortcuts}
    >
      {props.children}
    </a>
  );
}

/** `quiet` draws no box, for a bar that is itself the frame, such as the title bar. */
type IconButtonVariant = 'secondary' | 'quiet';

/**
 * An icon in place of words, for a common action whose icon is well known, at a full control's
 * size. `label` names it for screen readers and as a tooltip.
 */
export function IconButton(props: {
  icon: IconName;
  label: string;
  variant?: IconButtonVariant;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="k-button"
      data-variant={props.variant ?? 'secondary'}
      data-icon-only=""
      title={props.label}
      onClick={props.onClick}
    >
      <Icon name={props.icon} />
      <span className="k-visually-hidden">{props.label}</span>
    </button>
  );
}

/** An `IconButton` that goes to another screen. */
export function IconButtonLink(props: {
  icon: IconName;
  label: string;
  href: string;
  variant?: IconButtonVariant;
}) {
  return (
    <a
      className="k-button"
      data-variant={props.variant ?? 'secondary'}
      data-icon-only=""
      title={props.label}
      href={props.href}
    >
      <Icon name={props.icon} />
      <span className="k-visually-hidden">{props.label}</span>
    </a>
  );
}
