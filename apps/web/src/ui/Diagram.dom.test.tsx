// @vitest-environment happy-dom
import type { geometry } from '@kerf/core';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '../test/dom.tsx';
import { Diagram } from './Diagram.tsx';

// A drawing wider than its box fades the edge with more beyond it (#455). happy-dom lays nothing
// out, so the box's widths and scroll position are set by hand.

const drawing: geometry.Drawing = {
  title: 'Sample',
  description: 'A sample part.',
  bounds: { x: 0, y: -5, width: 100, height: 10 },
  notes: [],
  primitives: [
    {
      kind: 'line',
      role: 'visible',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    },
  ],
};

const sizes = { client: 343, scroll: 560 };
afterEach(() => vi.restoreAllMocks());

function box() {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => sizes.client);
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => sizes.scroll);
  const { container } = mount(
    <Diagram drawing={drawing} label="Sample" assumedWidth={343} minWidth={560} />,
  );
  const wrap = container.querySelector<HTMLElement>('.k-diagram-scroll');
  if (!wrap) throw new Error('no diagram');
  const scrollTo = (left: number) =>
    act(() => {
      wrap.scrollLeft = left;
      wrap.dispatchEvent(new Event('scroll'));
    });
  return { wrap, scrollTo };
}

describe('a drawing wider than its box', () => {
  it('marks the side scrolled out of view, so that edge fades', () => {
    const { wrap, scrollTo } = box();
    expect(wrap.dataset.hidden).toBe('end');
    scrollTo(100);
    expect(wrap.dataset.hidden).toBe('both');
    scrollTo(560 - 343);
    expect(wrap.dataset.hidden).toBe('start');
  });

  it('can be reached by keyboard, as a region named for the drawing', () => {
    const { wrap } = box();
    expect(wrap.tabIndex).toBe(0);
    expect(wrap.getAttribute('role')).toBe('region');
    expect(wrap.getAttribute('aria-label')).toBe('Sample, scrolls sideways');
  });

  it('marks nothing when the drawing fits, and is not a stop for the keyboard', () => {
    sizes.scroll = 343;
    const { wrap } = box();
    expect(wrap.dataset.hidden).toBeUndefined();
    expect(wrap.hasAttribute('tabindex')).toBe(false);
    expect(wrap.hasAttribute('role')).toBe(false);
    sizes.scroll = 560;
  });
});

// Printed from a phone, an assembly's view kept the phone's layout: no part letters, and labels
// sized for 375 px stretched to the page (#704). On paper it is laid out for the page.

const letter = (name: string, x: number): geometry.Primitive => ({
  kind: 'letter',
  at: { x, y: 0 },
  target: { x, y: 0 },
  letter: name,
  part: { partId: name, instance: 0, letter: name },
});

const assembly: geometry.Drawing = {
  ...drawing,
  primitives: [...drawing.primitives, letter('A', 20), letter('B', 80)],
};

describe('an assembly view printed from a phone-width window', () => {
  const print = (event: 'beforeprint' | 'afterprint') =>
    act(() => {
      window.dispatchEvent(new Event(event));
    });

  it('is laid out for the landscape page while printing, and for the phone after', () => {
    const { container } = mount(
      <Diagram
        drawing={assembly}
        label="Isometric"
        assumedWidth={375}
        page="landscape"
        letters="wide"
      />,
    );
    const letters = () =>
      [...container.querySelectorAll('.k-letter__text')].map((t) => t.textContent);
    const width = () =>
      container.querySelector<HTMLElement>('.k-diagram')?.style.getPropertyValue('--diagram-width');
    expect(letters()).toEqual([]);
    expect(width()).toBe('375px');

    print('beforeprint');
    expect(letters()).toEqual(['A', 'B']);
    expect(width()).toBe('960px');

    print('afterprint');
    expect(letters()).toEqual([]);
    expect(width()).toBe('375px');
  });

  it('lays out a portrait drawing for the portrait page', () => {
    const { container } = mount(<Diagram drawing={drawing} label="Detail" assumedWidth={375} />);
    const width = () =>
      container.querySelector<HTMLElement>('.k-diagram')?.style.getPropertyValue('--diagram-width');
    print('beforeprint');
    expect(width()).toBe('720px');
    print('afterprint');
    expect(width()).toBe('375px');
  });
});
