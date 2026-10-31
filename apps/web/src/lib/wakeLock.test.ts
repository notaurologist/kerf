import { describe, expect, it } from 'vitest';
import { holdWakeLock, type WakeLockHost } from './wakeLock.ts';

// The screen stays on while a shop mode is shown (#54): asked for while visible, asked for again
// after the page is hidden and shown, let go when the mode closes, and quiet when refused.

const settle = () => new Promise((r) => setTimeout(r, 0));

function fakeHost(options: { refuse?: boolean } = {}) {
  const log: string[] = [];
  let listener: (() => void) | null = null;
  const document = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_: string, fn: () => void) => {
      listener = fn;
    },
    removeEventListener: () => {
      listener = null;
    },
  };
  let n = 0;
  const locks: { release(): Promise<void> }[] = [];
  const host = {
    wakeLock: {
      request: async () => {
        n++;
        log.push(`request ${n}`);
        if (options.refuse) throw new DOMException('Not allowed', 'NotAllowedError');
        const id = n;
        const onRelease: (() => void)[] = [];
        const lock = {
          release: async () => {
            log.push(`release ${id}`);
            for (const fn of onRelease) fn();
          },
          addEventListener: (_: 'release', fn: () => void) => {
            onRelease.push(fn);
          },
        };
        locks.push(lock);
        return lock;
      },
    },
    document,
  } as unknown as WakeLockHost;
  const setVisible = (visible: boolean) => {
    document.visibilityState = visible ? 'visible' : 'hidden';
    listener?.();
  };
  /** The browser letting go of the lock on its own, as when the battery runs low. */
  const browserReleases = () => locks.at(-1)?.release();
  return { host, log, setVisible, browserReleases, listening: () => listener !== null };
}

describe('holdWakeLock', () => {
  it('asks for the lock while visible and lets it go when the mode closes', async () => {
    const { host, log, listening } = fakeHost();
    const stop = holdWakeLock(host);
    await settle();
    expect(log).toEqual(['request 1']);
    stop();
    await settle();
    expect(log).toEqual(['request 1', 'release 1']);
    expect(listening()).toBe(false);
  });

  it('asks again when the browser releases the lock while the page is still shown', async () => {
    const { host, log, browserReleases } = fakeHost();
    const stop = holdWakeLock(host);
    await settle();
    await browserReleases();
    await settle();
    expect(log).toEqual(['request 1', 'release 1', 'request 2']);
    stop();
    await settle();
    expect(log).toEqual(['request 1', 'release 1', 'request 2', 'release 2']);
  });

  it('asks again when the page is shown after being hidden', async () => {
    const { host, log, setVisible } = fakeHost();
    const stop = holdWakeLock(host);
    await settle();
    // The browser releases the lock itself when the page is hidden.
    setVisible(false);
    setVisible(true);
    await settle();
    expect(log).toEqual(['request 1', 'request 2']);
    stop();
    await settle();
    expect(log.at(-1)).toBe('release 2');
  });

  it('lets go at once when the mode closes before the lock arrives', async () => {
    const { host, log } = fakeHost();
    holdWakeLock(host)();
    await settle();
    expect(log).toEqual(['request 1', 'release 1']);
  });

  it('is quiet when the request is refused or the browser has no wake lock', async () => {
    const refused = fakeHost({ refuse: true });
    const stop = holdWakeLock(refused.host);
    await settle();
    expect(refused.log).toEqual(['request 1']);
    expect(() => stop()).not.toThrow();

    const none = fakeHost();
    const stopNone = holdWakeLock({ document: none.host.document });
    expect(none.listening()).toBe(false);
    expect(() => stopNone()).not.toThrow();
  });

  it('does not ask while the page is hidden', async () => {
    const { host, log, setVisible } = fakeHost();
    setVisible(false);
    holdWakeLock(host);
    await settle();
    expect(log).toEqual([]);
  });
});
