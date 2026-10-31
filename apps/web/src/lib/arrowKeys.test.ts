// @vitest-environment happy-dom

import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { mount } from '../test/dom.tsx';
import { arrowTarget, useArrowKeys } from './arrowKeys.ts';

const targets = { previous: '#/projects/p1/diagrams', next: '#/projects/p1/cut-list' };
const key = (key: string, more: Partial<KeyboardEvent> = {}) => ({
  key,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  isComposing: false,
  defaultPrevented: false,
  target: document.body,
  ...more,
});
const inside = (html: string) => {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  return host.querySelector('[data-at]') as Element;
};

describe('arrowTarget', () => {
  it('goes to the previous with Left and the next with Right', () => {
    expect(arrowTarget(key('ArrowLeft'), targets)).toBe(targets.previous);
    expect(arrowTarget(key('ArrowRight'), targets)).toBe(targets.next);
    expect(arrowTarget(key('ArrowDown'), targets)).toBeUndefined();
    expect(arrowTarget(key('ArrowRight'), { previous: targets.previous })).toBeUndefined();
  });

  it('leaves the keys alone with a modifier held, so the browser keeps its own shortcuts', () => {
    for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'] as const) {
      expect(arrowTarget(key('ArrowLeft', { [modifier]: true }), targets)).toBeUndefined();
    }
    expect(arrowTarget(key('ArrowLeft', { isComposing: true }), targets)).toBeUndefined();
    expect(arrowTarget(key('ArrowLeft', { defaultPrevented: true }), targets)).toBeUndefined();
  });

  it('does nothing while typing, choosing, or in a dialog', () => {
    for (const html of [
      '<input data-at>',
      '<textarea data-at></textarea>',
      '<select data-at></select>',
      '<div contenteditable="true"><p data-at></p></div>',
      '<div role="radiogroup"><span data-at></span></div>',
      '<dialog open><button data-at>Keep editing</button></dialog>',
    ]) {
      expect(arrowTarget(key('ArrowRight', { target: inside(html) }), targets)).toBeUndefined();
    }
    expect(
      arrowTarget(key('ArrowRight', { target: inside('<a data-at>Cut list</a>') }), targets),
    ).toBe(targets.next);
  });
});

describe('useArrowKeys', () => {
  function Section() {
    useArrowKeys(targets);
    return null;
  }

  it('goes to the address while the screen is open, and stops when it closes', () => {
    const view = mount(createElement(Section));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }));
    expect(window.location.hash).toBe(targets.next);
    view.rerender(null);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true }));
    expect(window.location.hash).toBe(targets.next);
  });
});
