// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOLD_MS } from '../lib/moves.ts';
import { mount } from '../test/dom.tsx';
import { LONG_WAIT_MS, Skeleton, STUCK_MS } from './Skeleton.tsx';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const after = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('Skeleton', () => {
  it('appears after the hold, adds a note on a long wait, and gives way to the problem when stuck', () => {
    const { container } = mount(
      <Skeleton
        label="Loading project…"
        shape="plan"
        stuck={<p>Kerf could not reach the server.</p>}
      />,
    );
    const skeleton = () => container.querySelector('.k-skeleton');
    expect(skeleton()?.hasAttribute('data-shown')).toBe(false);
    after(HOLD_MS);
    expect(skeleton()?.hasAttribute('data-shown')).toBe(true);
    expect(container.textContent).toBe('Loading project…');
    after(LONG_WAIT_MS - HOLD_MS);
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      'Loading project…Still loading. The first screen after a few idle minutes takes a few seconds.',
    );
    after(STUCK_MS - LONG_WAIT_MS);
    expect(skeleton()).toBeNull();
    expect(container.textContent).toBe('Kerf could not reach the server.');
  });
});
