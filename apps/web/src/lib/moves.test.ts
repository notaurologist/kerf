import { afterEach, describe, expect, it, vi } from 'vitest';
import { changeScreen, HOLD_MS, moveFor, startLoading } from './moves.ts';
import type { Route } from './route.ts';
import type { PlanSectionId } from './sections.ts';

const projects: Route = { screen: 'projects' };
const plan = (section?: PlanSectionId): Route => ({
  screen: 'project',
  id: 'p1',
  ...(section ? { section } : {}),
});

describe('moveFor', () => {
  it('moves forward going in and back coming out', () => {
    expect(moveFor(projects, plan())).toBe('forward');
    expect(moveFor(plan(), projects)).toBe('back');
    expect(moveFor(plan(), { screen: 'edit-project', id: 'p1' })).toBe('forward');
    expect(moveFor({ screen: 'tools' }, { screen: 'tools', tool: 'rafter-square' })).toBe(
      'forward',
    );
  });

  it("moves sideways through the plan's sections in their order", () => {
    expect(moveFor(plan(), plan('structural-review'))).toBe('forward');
    expect(moveFor(plan('cut-list'), plan('structural-review'))).toBe('back');
    expect(moveFor(plan('cut-list'), plan('cut-list'))).toBe('none');
  });

  it('fades between places, and rises into a mode and drops out of it', () => {
    expect(moveFor(plan('cut-list'), { screen: 'tools' })).toBe('place');
    expect(moveFor({ screen: 'glossary' }, projects)).toBe('place');
    expect(moveFor(plan(), { screen: 'build', id: 'p1' })).toBe('mode-in');
    expect(moveFor({ screen: 'shop', id: 'p1' }, plan())).toBe('mode-out');
    expect(moveFor({ screen: 'build', id: 'p1' }, { screen: 'build-steps', id: 'p1' })).toBe(
      'none',
    );
  });
});

describe('changeScreen', () => {
  const stubTransitions = () => {
    let updateDone: Promise<unknown> = Promise.resolve();
    const start = vi.fn((options: { update: () => Promise<void> }) => {
      updateDone = options.update();
      return {
        ready: updateDone,
        finished: updateDone,
        updateCallbackDone: updateDone,
        skipTransition: () => {},
      };
    });
    vi.stubGlobal('document', { startViewTransition: start });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    return { start, updateDone: () => updateDone };
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('changes at once with no move to play', () => {
    const update = vi.fn();
    changeScreen(plan('cut-list'), plan('cut-list'), update);
    expect(update).toHaveBeenCalledOnce();
  });

  it('holds the old screen until the new one has its data', async () => {
    const transitions = stubTransitions();
    let loaded = () => {};
    const update = vi.fn(() => {
      loaded = startLoading();
    });
    changeScreen(projects, plan(), update);
    expect(transitions.start).toHaveBeenCalledWith(expect.objectContaining({ types: ['forward'] }));
    expect(update).toHaveBeenCalledOnce();
    let held = true;
    void transitions.updateDone().then(() => {
      held = false;
    });
    await Promise.resolve();
    expect(held).toBe(true);
    loaded();
    await transitions.updateDone();
    expect(held).toBe(false);
  });

  it(`stops holding after ${HOLD_MS} ms`, async () => {
    vi.useFakeTimers();
    const transitions = stubTransitions();
    let loaded = () => {};
    changeScreen(projects, plan(), () => {
      loaded = startLoading();
    });
    let held = true;
    void transitions.updateDone().then(() => {
      held = false;
    });
    await vi.advanceTimersByTimeAsync(HOLD_MS - 1);
    expect(held).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(held).toBe(false);
    loaded();
  });
});
