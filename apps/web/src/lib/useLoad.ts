import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ApiError, ApiResult } from './api.ts';
import { useLatest } from './latest.ts';
import { arrive, startLoading } from './moves.ts';
import { SessionReturns } from './session.ts';

export type LoadState<T> =
  | { state: 'loading' }
  | { state: 'error'; error: ApiError }
  | {
      state: 'ready';
      value: T;
      /** Why the latest request failed, when the value on screen is the kept one from before it. */
      refreshFailed?: ApiError;
    };

/** Where a screen keeps the last value it loaded, so it can show it again at once. */
export interface Kept<T> {
  get: () => T | undefined;
  set: (value: T) => void;
}

/** What a finished request leaves on screen: its value, or else the kept one, or else the error. */
export function settled<T>(result: ApiResult<T>, kept: T | undefined): LoadState<T> {
  if (result.ok) return { state: 'ready', value: result.value };
  return kept === undefined
    ? { state: 'error', error: result.error }
    : { state: 'ready', value: kept, refreshFailed: result.error };
}

const shown = <T>(kept: Kept<T> | undefined): LoadState<T> => {
  const value = kept?.get();
  return value === undefined ? { state: 'loading' } : { state: 'ready', value };
};

/**
 * Loads something from the API when the screen opens and whenever `key` changes. `set` replaces
 * the value with a newer one the API returned, such as the response to a save. With `kept`, the
 * last value shows at once and stays when a later request fails. A screen with nothing to show
 * yet, or showing the kept value after a request failed, loads again when the session comes back,
 * so a load refused for want of one needs no retry.
 */
export function useLoad<T>(load: () => Promise<ApiResult<T>>, key: string, kept?: Kept<T>) {
  const [loaded, setLoaded] = useState<LoadState<T>>(() => shown(kept));
  const latest = useLatest();
  // While the screen waits for its first value, a move holds the old screen for it (lib/moves.ts).
  const onScreen = useRef(loaded.state);
  onScreen.current = loaded.state;
  const refreshFailed = useRef(false);
  refreshFailed.current = loaded.state === 'ready' && loaded.refreshFailed !== undefined;
  useLayoutEffect(() => (loaded.state === 'loading' ? startLoading() : undefined), [loaded.state]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reloads when the key changes, not when the caller passes a new closure.
  const reload = useCallback(async () => {
    const isLatest = latest.start();
    const result = await load();
    if (!isLatest()) return;
    if (result.ok) kept?.set(result.value);
    const next = settled(result, kept?.get());
    // Data arriving after the skeleton fades in over it (Stage 9, #266).
    if (onScreen.current === 'loading') arrive(() => setLoaded(next));
    else setLoaded(next);
  }, [key]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `kept` belongs to `key`.
  useEffect(() => {
    setLoaded(shown(kept));
    void reload();
  }, [reload]);
  const returns = useContext(SessionReturns);
  const returned = useRef(returns);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `kept` belongs to `key`.
  useEffect(() => {
    if (returned.current === returns) return;
    returned.current = returns;
    // A screen showing a value keeps it on screen while it loads again, and loads again only when
    // the value is the kept one after a failed request: a form on it keeps what was typed.
    if (onScreen.current === 'ready') {
      if (refreshFailed.current) void reload();
      return;
    }
    setLoaded(shown(kept));
    void reload();
  }, [returns, reload]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `kept` belongs to `key`.
  const set = useCallback(
    (value: T) => {
      latest.supersede();
      kept?.set(value);
      setLoaded({ state: 'ready', value });
    },
    [latest],
  );
  /** Changes the value on screen from the latest one, such as for a change still being sent. */
  const update = useCallback(
    (change: (value: T) => T) => {
      latest.supersede();
      setLoaded((s) => (s.state === 'ready' ? { state: 'ready', value: change(s.value) } : s));
    },
    [latest],
  );
  return { loaded, reload, set, update };
}
