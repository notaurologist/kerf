import { type ReactNode, useEffect, useState } from 'react';
import { HOLD_MS, moving } from '../lib/moves.ts';

// A screen waiting for its data (Stage 9, #266): blocks in the shape of what is coming, as NN/g
// advises for a full screen's wait, never the frame alone. A move holds the old screen for the
// first HOLD_MS, so the skeleton shows only after that; with no move holding, it waits as long
// before it appears, so a usual load (0.12 s) never flashes it. After a second a pencil line
// draws along its top, and after two a note says why the wait can be long: Neon wakes from
// sleep after 5 idle minutes (decision 0006). After ten, `stuck` takes its place.

export type SkeletonShape = 'list' | 'plan' | 'page' | 'line';

export const LONG_WAIT_MS = 2000;
export const STUCK_MS = 10_000;

const SHAPES: Record<SkeletonShape, readonly string[]> = {
  list: ['title', 'action', 'row', 'row', 'row'],
  plan: ['title', 'meta', 'bar', 'block', 'block', 'block'],
  page: ['title', 'line', 'line', 'short'],
  line: ['line'],
};

export function Skeleton(props: {
  /** What is loading, for screen readers: "Loading project…". */
  label: string;
  shape?: SkeletonShape;
  stuck: ReactNode;
}) {
  const [shown, setShown] = useState(moving);
  const [wait, setWait] = useState<'short' | 'long' | 'stuck'>('short');
  useEffect(() => {
    const timers = [
      setTimeout(() => setShown(true), HOLD_MS),
      setTimeout(() => setWait('long'), LONG_WAIT_MS),
      setTimeout(() => setWait('stuck'), STUCK_MS),
    ];
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, []);
  if (wait === 'stuck') return props.stuck;
  return (
    <div
      className="k-skeleton"
      data-shape={props.shape ?? 'page'}
      data-shown={shown || undefined}
      role="status"
    >
      <span className="k-visually-hidden">{props.label}</span>
      <span className="k-skeleton__pencil" aria-hidden="true" />
      <div className="k-skeleton__blocks" aria-hidden="true">
        {SHAPES[props.shape ?? 'page'].map((block, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the blocks never change order.
          <span key={i} className="k-skeleton__block" data-block={block} />
        ))}
      </div>
      {wait === 'long' && (
        <p className="k-skeleton__note">
          Still loading. The first screen after a few idle minutes takes a few seconds.
        </p>
      )}
    </div>
  );
}
