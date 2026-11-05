// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '../test/dom.tsx';
import { STUCK_MS } from '../ui/Skeleton.tsx';
import { Loaded } from './Loaded.tsx';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Loaded, still loading after the wait', () => {
  it('says Kerf is still waiting, not that it could not reach the server, and offers Try again', () => {
    const onRetry = vi.fn();
    const { container } = mount(
      <Loaded state={{ state: 'loading' }} loading="Loading project…" onRetry={onRetry} />,
    );
    act(() => vi.advanceTimersByTime(STUCK_MS));
    expect(container.textContent).toBe(
      'Kerf is still waiting for the server. Check your connection, then try again.Try againProjects',
    );
    act(() => container.querySelector('button')?.click());
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
