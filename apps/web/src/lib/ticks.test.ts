import { describe, expect, it } from 'vitest';
import type { ApiResult } from './api.ts';
import { describeWaiting, type SavedTick, type TickChange, TickQueue } from './ticks.ts';
import type { ProjectStatus } from './types.ts';

// The write queue (#57): ticks go to the server at once, wait in memory through a dropped
// connection, and are never shown as saved until the server says so.

type Answer = ApiResult<{ ticks: SavedTick[]; status: ProjectStatus }>;

const OFFLINE: Answer = {
  ok: false,
  error: { kind: 'failed', status: 0, message: 'Kerf could not reach the server.' },
};

/** A server that answers each request with the next answer given, recording what it was sent. */
function fakeServer(...answers: Answer[]) {
  const sent: TickChange[][] = [];
  const revisions: number[] = [];
  const saved = new Map<string, SavedTick>();
  const sender = async (changes: TickChange[], revision: number): Promise<Answer> => {
    sent.push(changes);
    revisions.push(revision);
    const answer = answers.shift();
    if (answer) return answer;
    for (const c of changes) {
      const id = `${c.kind}:${c.key}`;
      if (c.done) saved.set(id, { kind: c.kind, key: c.key, doneAt: 'then' });
      else saved.delete(id);
    }
    return { ok: true, value: { ticks: [...saved.values()], status: 'in-progress' } };
  };
  return { sent, revisions, sender };
}

/** Timers the test fires by hand. */
function manualTimers() {
  const due: { fn: () => void; ms: number }[] = [];
  return {
    due,
    timers: {
      set: (fn: () => void, ms: number) => due.push({ fn, ms }),
      clear: () => {},
    },
  };
}

const beam = { kind: 'step' as const, key: 'beam' };
const site = { kind: 'step' as const, key: 'site' };

describe('TickQueue', () => {
  it('sends a tick at once and shows it saved only when the server answers', async () => {
    const server = fakeServer();
    const queue = new TickQueue(server.sender);
    queue.set(beam, true);
    // Counted as done straight away, but waiting.
    expect(queue.getState().done.has('step:beam')).toBe(true);
    expect(queue.getState().waiting.has('step:beam')).toBe(true);
    await queue.flush();
    await Promise.resolve();
    expect(server.sent).toEqual([[{ kind: 'step', key: 'beam', done: true }]]);
    expect(queue.getState()).toMatchObject({ waiting: new Set(), status: 'in-progress' });
    expect(queue.getState().done.has('step:beam')).toBe(true);
  });

  it('keeps ticks through a dropped connection, retries with a growing wait, and says so', async () => {
    const server = fakeServer(OFFLINE, OFFLINE);
    const { due, timers } = manualTimers();
    const queue = new TickQueue(server.sender, timers);
    queue.set(beam, true);
    await queue.flush();
    expect(queue.getState().offline).toBe(true);
    expect(describeWaiting(queue.getState())).toBe(
      '1 change is not saved yet. Kerf cannot reach the server and will keep trying; keep this page open.',
    );
    expect(due.map((d) => d.ms)).toEqual([2000]);

    // Another tick while offline waits too, and goes with the next try.
    queue.set(site, true);
    await queue.flush();
    expect(due.map((d) => d.ms)).toEqual([2000, 4000]);
    expect(describeWaiting(queue.getState())).toContain('2 changes are not saved yet.');

    due.at(-1)?.fn();
    await new Promise((r) => setTimeout(r, 0));
    expect(server.sent.at(-1)).toEqual([
      { kind: 'step', key: 'beam', done: true },
      { kind: 'step', key: 'site', done: true },
    ]);
    expect(queue.getState()).toMatchObject({ waiting: new Set(), offline: false, problem: null });
    expect(queue.hasWaiting).toBe(false);
  });

  it('sends the latest value when a tick changes while the first is out', async () => {
    const server = fakeServer();
    const queue = new TickQueue(server.sender);
    queue.set(beam, true);
    queue.set(beam, false);
    await new Promise((r) => setTimeout(r, 0));
    expect(server.sent.at(-1)).toEqual([{ kind: 'step', key: 'beam', done: false }]);
    expect(queue.getState().done.has('step:beam')).toBe(false);
    expect(queue.hasWaiting).toBe(false);
  });

  it('drops a tick the plan no longer has, says so, and sends the rest again', async () => {
    const server = fakeServer({
      ok: false,
      error: { kind: 'invalid', issues: [], items: [{ kind: 'step', key: 'beam' }] },
    });
    const queue = new TickQueue(server.sender);
    queue.set(beam, true);
    queue.set(site, true);
    await new Promise((r) => setTimeout(r, 0));
    expect(server.sent.at(-1)).toEqual([{ kind: 'step', key: 'site', done: true }]);
    expect(queue.getState().dropped).toBe(
      '1 change was not saved: the item is no longer in the plan.',
    );
    expect(queue.getState().done.has('step:beam')).toBe(false);
    expect(queue.hasWaiting).toBe(false);
    // The next tick clears the note.
    queue.set(site, false);
    expect(queue.getState().dropped).toBeNull();
  });

  it('counts waiting changes over the ticks the server sent', () => {
    const queue = new TickQueue(fakeServer(OFFLINE).sender, manualTimers().timers);
    queue.seed([beam, site], 1);
    queue.set(site, false);
    expect([...queue.getState().done]).toEqual(['step:beam']);
  });
});

describe('describeWaiting', () => {
  it('says nothing when nothing waits', () => {
    expect(describeWaiting({ waiting: new Set(), offline: false })).toBeNull();
  });

  it('sends each tick with the revision of the plan it was made on', async () => {
    const server = fakeServer();
    const queue = new TickQueue(server.sender);
    queue.seed([], 3);
    queue.set(beam, true);
    await queue.flush();
    expect(server.revisions).toEqual([3]);
  });

  it('drops ticks made on a plan another device changed, says so, and sends the newer ones', async () => {
    const STALE: Answer = { ok: false, error: { kind: 'stale', revision: 2 } };
    const server = fakeServer(OFFLINE, STALE);
    const { timers, due } = manualTimers();
    const queue = new TickQueue(server.sender, timers);
    queue.seed([], 1);
    queue.set(beam, true);
    await queue.flush();
    // Offline: the tick waits. The screen then shows the plan regenerated elsewhere.
    queue.seed([], 2);
    queue.set(site, true);
    due.shift()?.fn();
    await Promise.resolve();
    await queue.flush();
    // The tick made on revision 1 went alone and was refused; the one made on revision 2 went
    // next, on its own revision.
    expect(server.revisions).toEqual([1, 1, 2]);
    expect(server.sent.at(-1)).toEqual([{ kind: 'step', key: 'site', done: true }]);
    const state = queue.getState();
    expect(state.waiting.size).toBe(0);
    expect(state.done.has('step:beam')).toBe(false);
    expect(state.done.has('step:site')).toBe(true);
    expect(state.dropped).toBe(
      '1 change was not saved: the plan changed on another device. Reload to see it.',
    );
  });
});
