import type { ReactNode } from 'react';
import { Loading, ProblemScreen } from '../ui/index.ts';
import { failureOf } from './api.ts';
import { href } from './route.ts';
import type { LoadState } from './useLoad.ts';

/**
 * What `useLoad` has so far: `loading` while it loads (after Loading's short delay), the problem
 * if it did not load, with Try again when the server could not be reached or failed, and
 * otherwise `children` with the value.
 */
export function Loaded<T>(props: {
  state: LoadState<T>;
  /** Such as "Loading project…" (docs/design/content.md, Status). */
  loading: string;
  /** `useLoad`'s `reload`. */
  onRetry: () => void;
  /** The heading for the problem, where the screen has none of its own while loading. */
  title?: string;
  children?: (value: T) => ReactNode;
}) {
  const { state } = props;
  if (state.state === 'loading') return <Loading>{props.loading}</Loading>;
  if (state.state === 'error') {
    const failure = failureOf(state.error);
    return (
      <ProblemScreen
        title={props.title}
        icon={failure.connection ? 'connection' : 'error'}
        onRetry={state.error.kind === 'failed' ? props.onRetry : undefined}
        back={{ href: href({ screen: 'projects' }), label: 'Projects' }}
      >
        {failure.message}
      </ProblemScreen>
    );
  }
  return <>{props.children?.(state.value)}</>;
}
