import { type ReactNode, useState } from 'react';
import {
  Button,
  Cluster,
  Notice,
  ProblemScreen,
  Skeleton,
  type SkeletonShape,
} from '../ui/index.ts';
import { type ApiError, CONNECTION_MESSAGE, failureOf } from './api.ts';
import { href } from './route.ts';
import type { LoadState } from './useLoad.ts';

/**
 * What `useLoad` has so far: a skeleton in the screen's `shape` while it loads, named `loading`
 * for screen readers (Stage 9, #266); the problem if it did not load, or has not after 10 s, with
 * the connection icon when the server could not be reached; and otherwise `children` with the
 * value, under a line saying so when it is the kept copy after a failed refresh.
 */
export function Loaded<T>(props: {
  state: LoadState<T>;
  /** Such as "Loading project…" (docs/design/content.md, Status). */
  loading: string;
  /** The shape of what is coming; a page of text when absent. */
  shape?: SkeletonShape;
  onRetry: () => void;
  /** For screens with no heading of their own while loading. */
  title?: string;
  /** For Projects itself, where a link back to Projects would go nowhere. */
  noBack?: boolean;
  children?: (value: T) => ReactNode;
}) {
  const { state } = props;
  // Try again starts the wait over, with a fresh skeleton.
  const [attempt, setAttempt] = useState(0);
  const back = props.noBack ? undefined : { href: href({ screen: 'projects' }), label: 'Projects' };
  if (state.state === 'loading') {
    const retry = () => {
      setAttempt((n) => n + 1);
      props.onRetry();
    };
    return (
      <Skeleton
        key={attempt}
        label={props.loading}
        shape={props.shape}
        stuck={
          <ProblemScreen title={props.title} icon="connection" onRetry={retry} back={back}>
            {CONNECTION_MESSAGE}
          </ProblemScreen>
        }
      />
    );
  }
  if (state.state === 'error') {
    const failure = failureOf(state.error);
    return (
      <ProblemScreen
        title={props.title}
        icon={failure.connection ? 'connection' : 'error'}
        onRetry={state.error.kind === 'failed' || !back ? props.onRetry : undefined}
        back={back}
      >
        {failure.message}
      </ProblemScreen>
    );
  }
  return (
    <>
      {state.refreshFailed && <RefreshFailed error={state.refreshFailed} onRetry={props.onRetry} />}
      {props.children?.(state.value)}
    </>
  );
}

/** Says the screen shows the copy loaded earlier because loading it again failed, and why. */
export function RefreshFailed(props: { error: ApiError; onRetry: () => void }) {
  const failure = failureOf(props.error);
  return (
    <Notice icon={failure.connection ? 'connection' : 'error'} alert={false}>
      <Cluster>
        <span>Showing the copy loaded earlier. {failure.message}</span>
        <Button variant="secondary" onClick={props.onRetry}>
          Try again
        </Button>
      </Cluster>
    </Notice>
  );
}
