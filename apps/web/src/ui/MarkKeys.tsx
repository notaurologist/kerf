import { type CSSProperties, type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// The marks a length needs, on a row above the phone's own keyboard (#74). Digits come from the
// phone's number pad and the marks from here, so the native keyboard, with its screen reader
// typing, paste, and paired keyboards, stays. A key never takes focus from the field: the
// phone would close its keyboard, and iOS does not reopen it for a focus() that is not a tap.

const MARKS = [
  { text: "'", name: 'feet' },
  { text: '"', name: 'inches' },
  { text: '/', name: 'fraction slash' },
  { text: '-', name: 'dash' },
  { text: ' ', name: 'space', shown: 'space' },
] as const;

/**
 * Types `text` into `input` at the caret, replacing any selection, and fires the input event
 * typing fires, so a React `onChange` reads it.
 */
function typeInto(input: HTMLInputElement, text: string) {
  if (input.readOnly || input.disabled) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  // The prototype's setter, not `input.value`: React watches that one, and would take the new
  // value for the one it already has and skip onChange.
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(input, input.value.slice(0, start) + text + input.value.slice(end));
  input.setSelectionRange(start + text.length, start + text.length);
  input.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
  );
}

/** Whether the device's main pointer is a finger, so a focused field opens an on-screen keyboard. */
export function hasOnScreenKeyboard(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches === true;
}

/**
 * Where the row sits: against the bottom of the visual viewport, which is the top of the
 * on-screen keyboard while it is open. Without `visualViewport`, the stylesheet's bottom edge.
 */
function useAboveKeyboard(
  input: RefObject<HTMLInputElement | null>,
  row: RefObject<HTMLElement | null>,
) {
  const [place, setPlace] = useState<CSSProperties>();
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const top = viewport.offsetTop + viewport.height;
      setPlace({ top, left: viewport.offsetLeft, inlineSize: viewport.width });
      // The phone scrolls the field to just above its keyboard, where the row would cover it.
      // Leave the row's own padding between them, for the field's focus ring.
      const field = input.current?.getBoundingClientRect();
      const keys = row.current;
      const height = keys ? keys.getBoundingClientRect().height : 0;
      const gap = keys ? Number.parseFloat(getComputedStyle(keys).paddingBlockStart) || 0 : 0;
      const overlap = field ? field.bottom + gap - (top - height) : 0;
      if (overlap > 0) window.scrollBy(0, overlap);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [input, row]);
  return place;
}

/** The row of mark keys for `input`, shown while it has focus on a phone. */
export function MarkKeys(props: { input: RefObject<HTMLInputElement | null> }) {
  const row = useRef<HTMLFieldSetElement>(null);
  const place = useAboveKeyboard(props.input, row);
  return createPortal(
    <fieldset
      ref={row}
      className="k-marks"
      aria-label="Length marks"
      data-placed={place ? true : undefined}
      style={place}
    >
      {MARKS.map((mark) => (
        <button
          key={mark.name}
          type="button"
          className="k-marks__key"
          tabIndex={-1}
          aria-label={mark.name}
          // Keeps focus, and so the keyboard, in the field. Preventing `click` would be too late.
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (props.input.current) typeInto(props.input.current, mark.text);
          }}
        >
          {'shown' in mark ? mark.shown : mark.text}
        </button>
      ))}
    </fieldset>,
    document.body,
  );
}
