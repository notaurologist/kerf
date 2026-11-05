// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrollBelowBars } from './scrollBelowBars.ts';

const rect = (top: number, height: number) =>
  ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top }) as DOMRect;

describe('scrollBelowBars', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  const page = (barShown: boolean) => {
    document.body.innerHTML =
      '<header class="k-titlebar" style="position: sticky"></header><h4 id="target"></h4>';
    const bar = document.querySelector<HTMLElement>('.k-titlebar');
    const target = document.getElementById('target');
    if (!bar || !target) throw new Error('no page');
    vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue(rect(0, barShown ? 48 : 0));
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(rect(900, 30));
    const scrolled = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    return { target, scrolled };
  };

  it('puts the element just below a sticky bar at the top', () => {
    const { target, scrolled } = page(true);
    scrollBelowBars(target);
    expect(scrolled).toHaveBeenCalledWith({ top: window.scrollY + 900 - 48 - 12 });
  });

  it('puts it at the top, less the gap, when no bar is showing', () => {
    const { target, scrolled } = page(false);
    scrollBelowBars(target);
    expect(scrolled).toHaveBeenCalledWith({ top: window.scrollY + 900 - 12 });
  });
});
