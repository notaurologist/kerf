// @vitest-environment happy-dom
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { byText, click, mount } from '../test/dom.tsx';
import type { ApiResult } from './api.ts';
import { BUILD_HEADER, createBuildCheck } from './build.ts';
import { NewBuildNotice } from './NewBuild.tsx';
import { type SavedTick, TickQueue, ticksStorageKey } from './ticks.ts';
import type { ProjectStatus } from './types.ts';

// An open page offers a reload once the API answers from another build (#701), and ticks waiting
// to be sent are still there after it.

type Answer = ApiResult<{ ticks: SavedTick[]; status: ProjectStatus }>;

const OFFLINE: Answer = {
  ok: false,
  error: { kind: 'failed', status: 0, message: 'Kerf could not reach the server.' },
};
const noTimers = { set: () => 0, clear: () => {} };
const KEY = ticksStorageKey('p1');
const beam = { kind: 'step' as const, key: 'beam' };
const answer = (build?: string) =>
  new Headers(build === undefined ? {} : { [BUILD_HEADER]: build });

const PROMPT = 'Kerf was updated after this page opened. Reload it to use the new version.';

describe('the new build notice', () => {
  beforeEach(() => localStorage.clear());

  it('offers a reload when the API answers from another build, and waiting ticks survive it', async () => {
    const before = new TickQueue(async () => OFFLINE, noTimers, localStorage, KEY);
    before.set(beam, true);
    await before.flush();
    expect(before.getState().waiting.has('step:beam')).toBe(true);

    const check = createBuildCheck('aaa111');
    let reloads = 0;
    const { container } = mount(<NewBuildNotice check={check} reload={() => reloads++} />);
    act(() => check.note(answer('aaa111')));
    expect(container.textContent).toBe('');

    act(() => check.note(answer('bbb222')));
    expect(container.textContent).toContain(PROMPT);
    await click(byText(container, 'button', 'Reload page'));
    expect(reloads).toBe(1);

    // The reloaded page: a new queue over the same storage.
    const sent: unknown[] = [];
    const after = new TickQueue(
      async (changes) => {
        sent.push(changes);
        return { ok: true, value: { ticks: [], status: 'in-progress' } };
      },
      noTimers,
      localStorage,
      KEY,
    );
    expect(after.getState().waiting.has('step:beam')).toBe(true);
    await after.flush();
    expect(sent).toEqual([[{ kind: 'step', key: 'beam', done: true }]]);
  });

  it('shows nothing when either side has no build, as in development', () => {
    const noOwn = createBuildCheck('');
    const own = createBuildCheck('aaa111');
    const { container } = mount(
      <>
        <NewBuildNotice check={noOwn} reload={() => {}} />
        <NewBuildNotice check={own} reload={() => {}} />
      </>,
    );
    act(() => {
      noOwn.note(answer('bbb222'));
      own.note(answer());
      own.note(answer(''));
    });
    expect(noOwn.differs()).toBe(false);
    expect(own.differs()).toBe(false);
    expect(container.textContent).toBe('');
  });
});
