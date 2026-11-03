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

  it('marks nothing when the drawing fits', () => {
    sizes.scroll = 343;
    const { wrap } = box();
    expect(wrap.dataset.hidden).toBeUndefined();
    sizes.scroll = 560;
  });
});
