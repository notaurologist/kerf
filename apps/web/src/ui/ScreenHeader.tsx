import type { ReactNode } from 'react';
import { Cluster, Stack } from './layout.tsx';
import { Text } from './text.tsx';

// The top of a screen: its title with the screen's actions beside it, wrapping under it when
// there is no room, then a lede saying what the screen is for, a line of facts about what is
// shown, and what just happened.

export function ScreenHeader(props: {
  title: ReactNode;
  /** Actions for the whole screen, such as Edit and Print. */
  actions?: ReactNode;
  /** What the screen is for, in a sentence or two. */
  lede?: ReactNode;
  /** Facts about what is shown, such as a project's status and template version. */
  meta?: ReactNode;
  /** What just happened, usually a `StatusLine`. */
  status?: ReactNode;
}) {
  const title = <h1>{props.title}</h1>;
  return (
    <Stack as="header" gap="2xs">
      {props.actions ? (
        <Cluster spread gap="s">
          {title}
          <Cluster>{props.actions}</Cluster>
        </Cluster>
      ) : (
        title
      )}
      {props.lede && <Text tone="muted">{props.lede}</Text>}
      {props.meta && <Text tone="muted">{props.meta}</Text>}
      {props.status}
    </Stack>
  );
}
