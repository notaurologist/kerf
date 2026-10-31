import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiError, ApiResult } from './api.ts';
import { sameJson } from './sameJson.ts';

export type LoadState<T> =
  | { state: 'loading' }
  | { state: 'error'; error: ApiError }
  | { state: 'ready'; value: T };

/** Where a screen keeps the last value it loaded, so it can show it again at once. */
export interface Kept<T> {
  get: () => T | undefined;
  set: (value: T) => void;
}

/** A place in memory for one screen's last value. Nothing is kept in browser storage (0005). */
export function keep<T>(): Kept<T> & { forget: () => void } {
  let value: T | undefined;
  return {
    get: () => value,
    set: (next) => {
      value = next;
    },
    forget: () => {
      value = undefined;
    },
  };
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
 * last value shows at once and stays when a later request fails, and `update` keeps its change
 * too. A refresh that brings the same value leaves the screen as it is, so a form opened from
 * the kept value keeps what is being typed.
 */
export function useLoad<T>(load: () => Promise<ApiResult<T>>, key: string, kept?: Kept<T>) {
  const [loaded, setLoaded] = useState<LoadState<T>>(() => shown(kept));
  // Only the latest request may set the result, so a slow earlier one cannot overwrite it.
  const latest = useRef(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reloads when the key changes, not when the caller passes a new closure.
  const reload = useCallback(async () => {
    const request = ++latest.current;
    const result = await load();
    if (request !== latest.current) return;
    if (result.ok) kept?.set(result.value);
    setLoaded((onScreen) =>
      onScreen.state === 'ready' && result.ok && sameJson(onScreen.value, result.value)
        ? onScreen
        : settled(result, kept?.get()),
    );
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: `kept` belongs to `key`.
  const update = useCallback((change: (value: T) => T) => {
    latest.current++;
    setLoaded((s) => {
      if (s.state !== 'ready') return s;
      const value = change(s.value);
      kept?.set(value);
      return { state: 'ready', value };
    });
  }, []);
  return { loaded, reload, set, update };
}
