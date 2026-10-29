import { type ReactNode, useEffect, useRef } from 'react';
import { Icon } from './Icon.tsx';

// Expandable working (#39, #41): closed on screen, open in print, so a printed plan shows every
// calculation. Built on <details>, so it works with the keyboard and screen readers as is.

export function Disclosure(props: {
  summary: ReactNode;
  children: ReactNode;
  open?: boolean;
  /** A small toggle beside a value, such as "Source". */
  size?: 'small';
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    let wasOpen = details.open;
    const before = () => {
      wasOpen = details.open;
      details.open = true;
    };
    const after = () => {
      details.open = wasOpen;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  return (
    <details ref={ref} className="k-disclosure" data-size={props.size} open={props.open}>
      <summary>
        <span>{props.summary}</span>
        <Icon name="chevron" />
      </summary>
      <div className="k-disclosure__body">{props.children}</div>
    </details>
  );
}
