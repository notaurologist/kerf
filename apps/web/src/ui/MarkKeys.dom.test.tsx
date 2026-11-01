// @vitest-environment happy-dom
import { act, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '../test/dom.tsx';
import { Field, TextInput } from './Field.tsx';

function LengthField(props: { initial?: string; readOnly?: boolean }) {
  const [text, setText] = useState(props.initial ?? '');
  return (
    <>
      <Field id="height" label="Beam height" echo={`read: ${text}`}>
        {(c) => (
          <TextInput
            {...c}
            keyboard="decimal"
            marks
            value={text}
            onChange={setText}
            readOnly={props.readOnly}
          />
        )}
      </Field>
      <button type="button">Save</button>
    </>
  );
}

const input = () => document.getElementById('height') as HTMLInputElement;
const echo = () => document.getElementById('height-echo')?.textContent;
const row = () => document.querySelector<HTMLElement>('.k-marks');
const key = (name: string) =>
  document.querySelector<HTMLButtonElement>(`.k-marks__key[aria-label="${name}"]`) as HTMLElement;

function pointer(coarse: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) => ({ matches: coarse && query === '(pointer: coarse)' }) as MediaQueryList,
  );
}

function focus() {
  act(() => input().focus());
}

/** A tap on a key as a browser runs it: pointerdown and mousedown, then click if not stopped. */
function tap(element: HTMLElement) {
  const down = [
    new PointerEvent('pointerdown', { bubbles: true, cancelable: true }),
    new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
  ];
  act(() => {
    for (const event of down) element.dispatchEvent(event);
    // A mousedown that is not prevented moves focus to the button.
    if (down.some((e) => !e.defaultPrevented)) element.focus();
    element.click();
  });
  return down;
}

beforeEach(() => pointer(true));
afterEach(() => vi.restoreAllMocks());

describe('the mark keys', () => {
  it('appear while a length field has focus on a phone, and go when it loses it', () => {
    mount(<LengthField />);
    expect(row()).toBeNull();
    focus();
    expect(row()?.getAttribute('aria-label')).toBe('Length marks');
    act(() => document.querySelector<HTMLElement>('button')?.focus());
    expect(row()).toBeNull();
  });

  it('do not appear where there is no on-screen keyboard', () => {
    pointer(false);
    mount(<LengthField />);
    focus();
    expect(row()).toBeNull();
  });

  it('do not appear on a field that cannot be changed', () => {
    mount(<LengthField readOnly />);
    focus();
    expect(row()).toBeNull();
  });

  it('name each mark, and are not stops for Tab', () => {
    mount(<LengthField />);
    focus();
    const keys = [...document.querySelectorAll('.k-marks__key')];
    expect(keys.map((k) => [k.textContent, k.getAttribute('aria-label')])).toEqual([
      ["'", 'feet'],
      ['"', 'inches'],
      ['/', 'fraction slash'],
      ['-', 'dash'],
      ['space', 'space'],
    ]);
    expect(keys.every((k) => k.getAttribute('tabindex') === '-1')).toBe(true);
  });

  it('keep focus in the field when a key is pressed', () => {
    mount(<LengthField initial="11" />);
    focus();
    const events = tap(key('feet'));
    expect(events.every((e) => e.defaultPrevented)).toBe(true);
    expect(document.activeElement).toBe(input());
    expect(row()).not.toBeNull();
  });

  it('type at the caret, through the same change typing makes', () => {
    mount(<LengthField initial="1138" />);
    focus();
    act(() => input().setSelectionRange(2, 2));
    tap(key('feet'));
    expect(input().value).toBe("11'38");
    expect(input().selectionStart).toBe(3);
    expect(echo()).toBe("read: 11'38");
    tap(key('space'));
    tap(key('fraction slash'));
    expect(input().value).toBe("11' /38");
  });

  it('replace a selection', () => {
    mount(<LengthField initial="138x8" />);
    focus();
    act(() => input().setSelectionRange(3, 4));
    tap(key('dash'));
    tap(key('inches'));
    expect(input().value).toBe('138-"8');
    expect(input().selectionStart).toBe(5);
    expect(input().selectionEnd).toBe(5);
    expect(echo()).toBe('read: 138-"8');
  });

  it('sit against the top of the on-screen keyboard', () => {
    const viewport = Object.assign(new EventTarget(), {
      offsetTop: 120,
      offsetLeft: 0,
      height: 400,
      width: 375,
    });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    mount(<LengthField />);
    focus();
    expect(row()?.dataset.placed).toBe('true');
    expect(row()?.style.top).toBe('520px');
    viewport.height = 300;
    act(() => viewport.dispatchEvent(new Event('resize')));
    expect(row()?.style.top).toBe('420px');
    Reflect.deleteProperty(window, 'visualViewport');
  });
});
