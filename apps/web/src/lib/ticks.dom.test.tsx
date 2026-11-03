// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiResult } from './api.ts';
import {
  describeWaiting,
  type SavedTick,
  type TickChange,
  TickQueue,
  type TickStorage,
  ticksStorageKey,
} from './ticks.ts';
import type { ProjectStatus } from './types.ts';

// Waiting ticks kept in local storage (#427, 0005): a reload does not lose them, a stored tick is
// sent like any other, and storage that fails leaves the in-memory queue as it was.

type Answer = ApiResult<{ ticks: SavedTick[]; status: ProjectStatus }>;

const OFFLINE: Answer = {
  ok: false,
  error: { kind: 'failed', status: 0, message: 'Kerf could not reach the server.' },
};
const STALE: Answer = { ok: false, error: { kind: 'stale', revision: 2 } };

function fakeServer(...answers: Answer[]) {
  const sent: { changes: TickChange[]; revision: number }[] = [];
  const sender = async (changes: TickChange[], revision: number): Promise<Answer> => {
    sent.push({ changes, revision });
    const answer = answers.shift();
    if (answer) return answer;
    const ticks = changes
      .filter((c) => c.done)
      .map((c) => ({ kind: c.kind, key: c.key, doneAt: 'then' }));
    return { ok: true, value: { ticks, status: 'in-progress' } };
  };
  return { sent, sender };
}

const noTimers = { set: () => 0, clear: () => {} };
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const KEY = ticksStorageKey('p1');
const beam = { kind: 'step' as const, key: 'beam' };
const site = { kind: 'step' as const, key: 'site' };

function open(sender: ReturnType<typeof fakeServer>['sender'], storage: TickStorage | null) {
  return new TickQueue(sender, noTimers, storage, KEY);
}

describe('TickQueue storage', () => {
  beforeEach(() => localStorage.clear());

  it('keeps a waiting tick through a reload and sends it', async () => {
    const before = open(fakeServer(OFFLINE).sender, localStorage);
    before.set(beam, true);
    await settle();
    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual([
      { kind: 'step', key: 'beam', done: true, revision: 1 },
    ]);

    // A new page: a new queue over the same storage.
    const server = fakeServer();
    const after = open(server.sender, localStorage);
    expect(after.getState().waiting.has('step:beam')).toBe(true);
    expect(after.getState().done.has('step:beam')).toBe(true);
    expect(after.hasWaiting).toBe(true);
    await after.flush();
    expect(server.sent).toEqual([
      { changes: [{ kind: 'step', key: 'beam', done: true }], revision: 1 },
    ]);
    expect(after.hasWaiting).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('removes a tick from storage once the server accepts it', async () => {
    const queue = open(fakeServer(OFFLINE).sender, localStorage);
    queue.set(beam, true);
    queue.set(site, true);
    await settle();
    expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toHaveLength(2);
    await queue.flush();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('sends a stored tick for an older revision and says it was refused', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([{ kind: 'step', key: 'beam', done: true, revision: 1 }]),
    );
    const server = fakeServer(STALE);
    const queue = open(server.sender, localStorage);
    queue.seed([], 2);
    await queue.flush();
    expect(server.sent.map((s) => s.revision)).toEqual([1]);
    expect(queue.getState().dropped).toBe(
      '1 change was not saved: the plan changed on another device. Reload to see it.',
    );
    expect(queue.getState().waiting.size).toBe(0);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('ignores stored data that does not parse', () => {
    for (const bad of [
      '{not json',
      '{"kind":"step"}',
      JSON.stringify([{ kind: 'nonsense', key: 'x', done: true, revision: 1 }]),
      JSON.stringify([{ kind: 'step', key: 'beam', done: true }]),
      JSON.stringify([{ kind: 'step', key: 'beam', done: true, revision: 0 }]),
    ]) {
      localStorage.setItem(KEY, bad);
      const queue = open(fakeServer().sender, localStorage);
      expect(queue.hasWaiting).toBe(false);
      expect(queue.getState().waiting.size).toBe(0);
    }
  });

  it('falls back to memory when storage throws', async () => {
    const blocked: TickStorage = {
      getItem: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
      removeItem: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
    };
    const server = fakeServer(OFFLINE);
    const queue = open(server.sender, blocked);
    queue.set(beam, true);
    await settle();
    expect(queue.getState().waiting.has('step:beam')).toBe(true);
    expect(queue.atRisk).toBe(true);
    expect(describeWaiting({ ...queue.getState(), offline: true })).toContain(
      'keep this page open',
    );
    await queue.flush();
    expect(queue.hasWaiting).toBe(false);
    expect(queue.atRisk).toBe(false);
  });

  it('works without storage', async () => {
    const server = fakeServer();
    const queue = open(server.sender, null);
    queue.set(beam, true);
    await settle();
    expect(server.sent).toHaveLength(1);
    expect(queue.hasWaiting).toBe(false);
  });

  it('says ticks are kept on this device when storage holds them', async () => {
    const queue = open(fakeServer(OFFLINE).sender, localStorage);
    queue.set(beam, true);
    await settle();
    expect(queue.atRisk).toBe(false);
    expect(describeWaiting(queue.getState())).toBe(
      '1 change is not saved yet. Kerf cannot reach the server and will keep trying. This device keeps it until it is sent.',
    );
  });
});
