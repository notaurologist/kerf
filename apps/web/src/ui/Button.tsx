import type { MouseEvent, ReactNode, Ref } from 'react';

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
export function ButtonLink(props: { children: ReactNode; href: string; variant?: ButtonVariant }) {
  return (
    <a className="k-button" data-variant={props.variant ?? 'primary'} href={props.href}>
      {props.children}
    </a>
  );
}
