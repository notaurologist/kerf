import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiError, ApiResult } from './api.ts';

export type LoadState<T> =
  | { state: 'loading' }
  | { state: 'error'; error: ApiError }
  | { state: 'ready'; value: T };

/**
 * Loads something from the API when the screen opens and whenever `key` changes. `set` replaces
 * the value with a newer one the API returned, such as the response to a save.
 */
export function useLoad<T>(load: () => Promise<ApiResult<T>>, key: string) {
  const [loaded, setLoaded] = useState<LoadState<T>>({ state: 'loading' });
  // Only the latest request may set the result, so a slow earlier one cannot overwrite it.
  const latest = useRef(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reloads when the key changes, not when the caller passes a new closure.
  const reload = useCallback(async () => {
    const request = ++latest.current;
    const result = await load();
    if (request !== latest.current) return;
    setLoaded(
      result.ok ? { state: 'ready', value: result.value } : { state: 'error', error: result.error },
    );
  }, [key]);
  useEffect(() => {
    setLoaded({ state: 'loading' });
    void reload();
  }, [reload]);
  const set = useCallback((value: T) => {
    latest.current++;
    setLoaded({ state: 'ready', value });
  }, []);
  /** Changes the value on screen from the latest one, such as for a change still being sent. */
  const update = useCallback((change: (value: T) => T) => {
    latest.current++;
    setLoaded((s) => (s.state === 'ready' ? { state: 'ready', value: change(s.value) } : s));
  }, []);
  return { loaded, reload, set, update };
}
