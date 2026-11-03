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
  /** The name in full when the words shown rely on what is beside them, such as "Remove". */
  label?: string;
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
      aria-label={props.label}
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
  /** A way into a shop mode, marked with the mode's color (Stage 10). */
  mode?: 'shopping' | 'building';
  /** Said after the name, such as progress: "Shop · 4 of 11 bought". In a narrow `EqualButtons`
   * it goes on its own line under the name. */
  detail?: ReactNode;
}) {
  return (
    <a
      className="k-button"
      data-variant={props.variant ?? 'primary'}
      data-mode={props.mode}
      href={props.href}
      aria-keyshortcuts={props.keyshortcuts}
    >
      {props.detail === undefined ? (
        props.children
      ) : (
        <span className="k-button__label">
          <span>{props.children}</span>
          <span className="k-button__sep"> · </span>
          <span className="k-button__detail">{props.detail}</span>
        </span>
      )}
    </a>
  );
}

/**
 * Sibling buttons, neither more important for its size: side by side at the width of the widest,
 * and sharing the whole row below 30rem, where each button's `detail` goes under its name.
 */
export function EqualButtons(props: { children: ReactNode }) {
  return (
    <div className="k-equal-buttons">
      <div className="k-equal-buttons__row">{props.children}</div>
    </div>
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
