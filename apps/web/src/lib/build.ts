import { useSyncExternalStore } from 'react';

// The page compares the build it was loaded from with the API's (#701). Shopping and Building stay
// open for hours, so after a deploy an open page would read newer plans with older code. Vercel's
// Skew Protection, which would pin the page to its deployment, is not on the Hobby plan.

/** The commit this page was built from (vite.config.ts); empty in development and tests. */
declare const __KERF_BUILD__: string;

/** The API's response header naming its build (`BUILD_HEADER` in apps/api/src/app.ts). */
export const BUILD_HEADER = 'Kerf-Build';

export type BuildCheck = ReturnType<typeof createBuildCheck>;

/**
 * Whether the API has answered from another build than `own`. Either side without a build, as in
 * development, never differs. Once it differs it stays so until the page reloads.
 */
export function createBuildCheck(own: string) {
  let differs = false;
  const listeners = new Set<() => void>();
  return {
    note(headers: Pick<Headers, 'get'>) {
      const theirs = headers.get(BUILD_HEADER);
      if (differs || !own || !theirs || theirs === own) return;
      differs = true;
      for (const listener of listeners) listener();
    },
    differs: () => differs,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const buildCheck = createBuildCheck(__KERF_BUILD__);

export function useBuildDiffers(check: BuildCheck = buildCheck): boolean {
  return useSyncExternalStore(check.subscribe, check.differs, check.differs);
}
