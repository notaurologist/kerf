import { useEffect } from 'react';

// Keeps the screen on in Shopping and Building (#54, requirement R21), so the phone or tablet
// does not sleep between cuts. The Screen Wake Lock API: the browser releases the lock whenever
// the page is hidden, so it is asked for again each time the page is shown, and let go when the
// mode closes. Where the API is missing or the request is refused (low battery, a browser
// setting), the screen sleeps as usual and nothing is said.

/** The parts of the browser this needs, so tests can pass their own. */
export interface WakeLockHost {
  wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> };
  document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
}

/** Holds a screen wake lock while the page is visible. Returns a function that lets it go. */
export function holdWakeLock(host: WakeLockHost): () => void {
  const { wakeLock, document } = host;
  if (!wakeLock) return () => {};
  let lock: { release(): Promise<void> } | null = null;
  let stopped = false;

  const request = async () => {
    if (stopped || lock || document.visibilityState !== 'visible') return;
    try {
      const granted = await wakeLock.request('screen');
      // Closed while the request was out: let go at once.
      if (stopped) void granted.release().catch(() => {});
      else lock = granted;
    } catch {
      // Refused: the screen sleeps as usual.
    }
  };
  const onVisibility = () => {
    // Hiding the page releases the lock; ask again when it is shown.
    if (document.visibilityState !== 'visible') lock = null;
    else void request();
  };

  document.addEventListener('visibilitychange', onVisibility);
  void request();
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisibility);
    void lock?.release().catch(() => {});
    lock = null;
  };
}

/** Keeps the screen on while the calling screen is shown. */
export function useWakeLock() {
  useEffect(() => holdWakeLock({ wakeLock: navigator.wakeLock, document }), []);
}
