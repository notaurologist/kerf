import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ApiError, ApiResult } from './api.ts';
import { arrive, startLoading } from './moves.ts';

export type LoadState<T> =
  | { state: 'loading' }
  | { state: 'error'; error: ApiError }
  | { state: 'ready'; value: T };

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
    : { state: 'ready', value: kept };
}

const shown = <T>(kept: Kept<T> | undefined): LoadState<T> => {
  const value = kept?.get();
  return value === undefined ? { state: 'loading' } : { state: 'ready', value };
};

/**
 * Loads something from the API when the screen opens and whenever `key` changes. `set` replaces
 * the value with a newer one the API returned, such as the response to a save. With `kept`, the
 * last value shows at once and stays when a later request fails.
 */
export function useLoad<T>(load: () => Promise<ApiResult<T>>, key: string, kept?: Kept<T>) {
  const [loaded, setLoaded] = useState<LoadState<T>>(() => shown(kept));
  // Only the latest request may set the result, so a slow earlier one cannot overwrite it.
  const latest = useRef(0);
  // While the screen waits for its first value, a move holds the old screen for it (lib/moves.ts).
  const onScreen = useRef(loaded.state);
  onScreen.current = loaded.state;
  useLayoutEffect(() => (loaded.state === 'loading' ? startLoading() : undefined), [loaded.state]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reloads when the key changes, not when the caller passes a new closure.
  const reload = useCallback(async () => {
    const request = ++latest.current;
    const result = await load();
    if (request !== latest.current) return;
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: `kept` belongs to `key`.
  const set = useCallback((value: T) => {
    latest.current++;
    kept?.set(value);
    setLoaded({ state: 'ready', value });
  }, []);
  /** Changes the value on screen from the latest one, such as for a change still being sent. */
  const update = useCallback((change: (value: T) => T) => {
    latest.current++;
    setLoaded((s) => (s.state === 'ready' ? { state: 'ready', value: change(s.value) } : s));
  }, []);
  return { loaded, reload, set, update };
}
