import type { ReactNode } from 'react';
import { useScreenHeading } from '../lib/screenChange.ts';
import { Cluster, Stack } from './layout.tsx';
import { Text } from './text.tsx';

// The top of a screen: its title with the screen's actions beside it, wrapping under it when
// there is no room, then a lede saying what the screen is for, a line of facts about what is
// shown, and what just happened.

/**
 * A screen's h1. It takes focus when the screen is changed to, and `title` names the document;
 * `children`, when given, are shown in its place, such as a title with an icon.
 */
export function ScreenHeading(props: { title: string; children?: ReactNode }) {
  const ref = useScreenHeading(props.title);
  return (
    <h1 ref={ref} tabIndex={-1}>
      {props.children ?? props.title}
    </h1>
  );
}

export function ScreenHeader(props: {
  /** The screen's name, for its heading and the document title. */
  title: string;
  /** Shown in place of `title` when the heading needs more, such as an icon. */
  heading?: ReactNode;
  /** The document title when it should say more than the heading, such as the plan's section. */
  pageTitle?: string;
  /** Actions for the whole screen, such as Edit and Print. */
  actions?: ReactNode;
  /** What the screen is for, in a sentence or two. */
  lede?: ReactNode;
  /** Facts about what is shown, such as a project's status and template version. */
  meta?: ReactNode;
  /** What just happened, usually a `StatusLine`. */
  status?: ReactNode;
}) {
  const title = (
    <ScreenHeading title={props.pageTitle ?? props.title}>
      {props.heading ?? props.title}
    </ScreenHeading>
  );
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
