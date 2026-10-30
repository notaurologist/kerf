import type { ReactNode } from 'react';
import { Loading, Notice } from '../ui/index.ts';
import { failureOf } from './api.ts';
import type { LoadState } from './useLoad.ts';

/**
 * What `useLoad` has so far: `loading` while it loads (after Loading's short delay), the problem
 * if it did not load, with the connection icon when the server could not be reached, and
 * otherwise `children` with the value.
 */
export function Loaded<T>(props: {
  state: LoadState<T>;
  /** Such as "Loading project…" (docs/design/content.md, Status). */
  loading: string;
  children?: (value: T) => ReactNode;
}) {
  const { state } = props;
  if (state.state === 'loading') return <Loading>{props.loading}</Loading>;
  if (state.state === 'error') {
    const failure = failureOf(state.error);
    return <Notice icon={failure.connection ? 'connection' : 'error'}>{failure.message}</Notice>;
  }
  return <>{props.children?.(state.value)}</>;
}
