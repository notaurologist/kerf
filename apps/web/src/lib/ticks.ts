import { type ProgressKind, progressId } from '@kerf/core';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { type ApiResult, api, describeError, send } from './api.ts';
import type { ProjectStatus } from './types.ts';

// Ticks made in Shopping and Building (#57, #61). The server holds them, so every device sees the
// same ticks; a tick is sent at once and, when the connection drops, waits in memory and is sent
// again until it goes through (#39, Q5 a). Nothing is kept in the browser's storage (0005): a
// reload while ticks wait loses them, and the page asks first. Each project's queue lives for the
// page's life, so leaving a mode and coming back keeps what is waiting.

export interface Tick {
  kind: ProgressKind;
  key: string;
}
export interface SavedTick extends Tick {
  doneAt: string;
}
export interface TickChange extends Tick {
  done: boolean;
}

export interface TicksState {
  /** IDs (`progressId`) of the items done, counting ticks not saved yet. */
  done: ReadonlySet<string>;
  /** IDs of the items with a change not saved yet. */
  waiting: ReadonlySet<string>;
  /** The project's status as the server last answered it, which ticks can move (#61). */
  status: ProjectStatus | null;
  /** Why changes are waiting, in words; null when nothing failed. */
  problem: string | null;
  /** Changes the server refused and that were dropped, in words; cleared by the next tick. */
  dropped: string | null;
  /** True while the server cannot be reached. */
  offline: boolean;
}

export type TickSender = (
  changes: TickChange[],
) => Promise<ApiResult<{ ticks: SavedTick[]; status: ProjectStatus }>>;

interface Timers {
  set: (fn: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

const FIRST_RETRY_MS = 2_000;
const LAST_RETRY_MS = 30_000;

/** One project's ticks: what the server saved, and changes waiting to reach it. */
export class TickQueue {
  private saved = new Set<string>();
  private changes = new Map<string, TickChange>();
  private sending = false;
  private retryMs = FIRST_RETRY_MS;
  private timer: unknown = null;
  private status: ProjectStatus | null = null;
  private problem: string | null = null;
  private dropped: string | null = null;
  private offline = false;
  private state: TicksState;
  private readonly listeners = new Set<() => void>();
  private readonly sendChanges: TickSender;
  private readonly timers: Timers;

  constructor(
    sendChanges: TickSender,
    timers: Timers = {
      set: (fn, ms) => setTimeout(fn, ms),
      clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    },
  ) {
    this.sendChanges = sendChanges;
    this.timers = timers;
    this.state = this.snapshot();
  }

  /**
   * The ticks the server sent with the project. Waiting changes still count over them. Called
   * while a screen renders the response, so it tells no other listener: they show the same one.
   */
  seed(ticks: readonly Tick[]) {
    this.saved = new Set(ticks.map(progressId));
    this.state = this.snapshot();
  }

  set(tick: Tick, done: boolean) {
    this.changes.set(progressId(tick), { kind: tick.kind, key: tick.key, done });
    this.dropped = null;
    this.emit();
    void this.flush();
  }

  get hasWaiting() {
    return this.changes.size > 0;
  }

  /** Sends every waiting change; after a failure, tries again later. */
  async flush(): Promise<void> {
    if (this.sending || this.changes.size === 0) return;
    if (this.timer !== null) this.timers.clear(this.timer);
    this.timer = null;
    this.sending = true;
    const batch = new Map(this.changes);
    const result = await this.sendChanges([...batch.values()]);
    this.sending = false;
    // A change made while the batch was out replaces the one sent; only drop what was sent.
    const drop = (id: string) => {
      if (this.changes.get(id) === batch.get(id)) this.changes.delete(id);
    };
    if (result.ok) {
      for (const id of batch.keys()) drop(id);
      this.saved = new Set(result.value.ticks.map(progressId));
      this.status = result.value.status;
      this.problem = null;
      this.offline = false;
      this.retryMs = FIRST_RETRY_MS;
    } else if (result.error.kind === 'invalid' || result.error.kind === 'not-found') {
      // Sending again would be refused again. A tick on an item the plan no longer has (the plan
      // was regenerated elsewhere) is dropped and said; the rest of the batch goes again.
      const stale = result.error.kind === 'invalid' ? result.error.items : undefined;
      const refused = stale ? stale.map((t) => `${t.kind}:${t.key}`) : [...batch.keys()];
      for (const id of refused) drop(id);
      if (!stale) this.dropped = `Changes were not saved. ${describeError(result.error)}`;
      else if (refused.length === 1) {
        this.dropped = '1 change was not saved: the item is no longer in the plan.';
      } else {
        this.dropped = `${refused.length} changes were not saved: the items are no longer in the plan.`;
      }
      this.problem = null;
      this.offline = false;
    } else {
      this.problem = describeError(result.error);
      this.offline = result.error.kind === 'failed' && result.error.status === 0;
      this.timer = this.timers.set(() => void this.flush(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, LAST_RETRY_MS);
      this.emit();
      return;
    }
    this.emit();
    if (this.changes.size > 0) await this.flush();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = () => this.state;

  private snapshot(): TicksState {
    const done = new Set(this.saved);
    for (const [id, change] of this.changes) {
      if (change.done) done.add(id);
      else done.delete(id);
    }
    return {
      done,
      waiting: new Set(this.changes.keys()),
      status: this.status,
      problem: this.problem,
      dropped: this.dropped,
      offline: this.offline,
    };
  }

  private emit() {
    this.state = this.snapshot();
    for (const listener of this.listeners) listener();
  }
}

const queues = new Map<string, TickQueue>();

function sendTo(projectId: string): TickSender {
  return async (changes) =>
    send(api.api.projects[':id'].progress.$patch({ param: { id: projectId }, json: { changes } }));
}

/** Asks before a reload or closing the tab while any project has ticks waiting. */
function warnBeforeUnload() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeunload', (e) => {
    if ([...queues.values()].some((q) => q.hasWaiting)) e.preventDefault();
  });
}

/** The project's queue, seeded with the ticks of the latest project response. */
export function ticksFor(projectId: string, seed: readonly Tick[]): TickQueue {
  let queue = queues.get(projectId);
  if (!queue) {
    if (queues.size === 0) warnBeforeUnload();
    queue = new TickQueue(sendTo(projectId));
    queues.set(projectId, queue);
  }
  queue.seed(seed);
  return queue;
}

/**
 * A project's ticks for a screen: what is done, what is waiting, and `set` to tick or clear an
 * item. `seed` is the ticks the project response carried; a fresh response replaces the saved
 * ticks, and waiting changes still count over them.
 */
export function useTicks(projectId: string, seed: readonly Tick[]) {
  const queue = useMemo(() => ticksFor(projectId, seed), [projectId, seed]);
  useEffect(() => {
    const retry = () => void queue.flush();
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [queue]);
  const state = useSyncExternalStore(queue.subscribe, queue.getState, queue.getState);
  return {
    ...state,
    isDone: (tick: Tick) => state.done.has(progressId(tick)),
    isWaiting: (tick: Tick) => state.waiting.has(progressId(tick)),
    set: (tick: Tick, done: boolean) => queue.set(tick, done),
    ticked: (): Tick[] =>
      [...state.done].map((id) => {
        const at = id.indexOf(':');
        return { kind: id.slice(0, at) as ProgressKind, key: id.slice(at + 1) };
      }),
  };
}

/** The line saying how many changes wait, or null when none do. */
export function describeWaiting(state: Pick<TicksState, 'waiting' | 'offline'>): string | null {
  const n = state.waiting.size;
  if (n === 0) return null;
  const changes = n === 1 ? '1 change is not saved yet' : `${n} changes are not saved yet`;
  return state.offline
    ? `${changes}. Kerf cannot reach the server and will keep trying; keep this page open.`
    : `${changes}.`;
}
