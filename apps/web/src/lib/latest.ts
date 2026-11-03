import { useMemo, useRef } from 'react';

/** Starts requests of which only the latest may apply its result. */
export interface Latest {
  /** Starts a request. The check it returns is true until a later one starts or `supersede` runs. */
  start: () => () => boolean;
  /** Makes every request in flight stale, such as when a newer value arrived some other way. */
  supersede: () => void;
}

/** Only the latest request applies its result, so a slow earlier one cannot overwrite a newer one. */
export function useLatest(): Latest {
  const latest = useRef(0);
  return useMemo(
    () => ({
      start: () => {
        const id = ++latest.current;
        return () => id === latest.current;
      },
      supersede: () => {
        latest.current++;
      },
    }),
    [],
  );
}
